// False-attribution controls for the site fact-check record. A review counts toward a site only
// when the fact-checker listed a page on that site as where the claim appeared. Posts on platforms,
// archives without the original address, link shorteners, the fact-checker's own pages and other
// fact-checkers' pages never count toward any site.
import test from "node:test";
import assert from "node:assert/strict";
import { reviewSites, appearanceSite } from "../src/core/hosts.js";

const CHECKERS = new Set(["checker.example", "politifact.com", "factly.in"]);
const item = (urls, first, url = "https://checker.example/review/1") => ({
  "@type": "ClaimReview", url,
  itemReviewed: { "@type": "Claim", appearance: urls.map((u) => ({ "@type": "CreativeWork", url: u })), ...(first ? { firstAppearance: { url: first } } : {}) },
});

test("a post on a platform is the poster's, not the platform's", () => {
  const r = reviewSites(item(["https://www.facebook.com/reel/1", "https://x.com/someone/status/2", "https://t.me/channel/3"]), CHECKERS);
  assert.deepEqual(r.sites, []);
  assert.deepEqual(r.hosted.sort(), ["platform", "platform", "platform"]);
});

test("an archived copy counts for the archived site only when the address carries it", () => {
  assert.deepEqual(reviewSites(item(["https://web.archive.org/web/2024/https://www.example-news.com/a"]), CHECKERS).sites, ["example-news.com"]);
  const short = reviewSites(item(["https://archive.ph/AbC12"]), CHECKERS);
  assert.deepEqual(short.sites, []);
  assert.deepEqual(short.hosted, ["archive"]);
});

test("the fact-checker's own pages and other fact-checkers' pages never count", () => {
  assert.deepEqual(reviewSites(item(["https://checker.example/earlier-review"]), CHECKERS).sites, []);
  assert.deepEqual(reviewSites(item(["https://www.politifact.com/factchecks/x"]), CHECKERS).sites, []);
  assert.equal(appearanceSite("https://factly.in/x", CHECKERS).excluded, "fact-checker");
});

test("shortened links are not followed, so they count for no site", () => {
  assert.deepEqual(reviewSites(item(["https://bit.ly/abc"]), CHECKERS).sites, []);
});

test("one review counts once per site, even when it lists several pages there", () => {
  const r = reviewSites(item(["https://www.example-news.com/a", "https://live.example-news.com/b"], "https://example-news.com/c"), CHECKERS);
  assert.deepEqual(r.sites, ["example-news.com"]);
});

test("a blog on a shared host counts for that blog, never for the host", () => {
  const r = reviewSites(item(["https://someone.blogspot.com/2024/x.html"]), CHECKERS);
  assert.deepEqual(r.sites, ["someone.blogspot.com"]);
});

test("a review with no appearance counts for nothing", () => {
  assert.deepEqual(reviewSites({ "@type": "ClaimReview", url: "https://checker.example/r", itemReviewed: { author: { name: "Someone" } } }, CHECKERS), { sites: [], hosted: [], excluded: 0, urls: 0 });
});

test("transcripts, aggregators, fact-check tools and hosting are not filed as the claim's site", () => {
  for (const [u, kind] of [["https://www.rev.com/blog/transcripts/x", "transcript"], ["https://factba.se/transcript/y", "transcript"], ["https://www.c-span.org/video/?1", "transcript"],
    ["https://news.yahoo.com/a", "aggregator"], ["https://www.msn.com/en-us/news/b", "aggregator"], ["https://checkmedia.org/x/media/1", "fact-check tool"], ["https://lh3.googleusercontent.com/p", "hosting"], ["https://i0.wp.com/x.jpg", "hosting"]]) {
    const r = reviewSites(item([u]), CHECKERS);
    assert.deepEqual(r.sites, [], u);
    assert.deepEqual(r.hosted, [kind], u);
  }
});
