// The X adapters against the shapes seen live on 2026-10-22 (tests/fixtures/x-live-shapes.js) and
// against markup with its class names and test ids rotated away. Every account here is synthetic.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { usersIn, tweetsIn } from "../src/core/xdata.js";
import { postsFromHtml } from "../src/core/import-html.js";
import { liveUser, liveTweet, retweetersResponse } from "./fixtures/x-live-shapes.js";

test("a User with no legacy block still gives counts, website, bio and join date", () => {
  const [u] = usersIn(retweetersResponse(["sample_one"]));
  assert.equal(u.handle, "sample_one");
  assert.equal(u.followersCount, 4210);
  assert.equal(u.followingCount, 380);
  assert.equal(u.postsCount, 9120);
  assert.equal(u.mediaCount, 640);
  assert.equal(u.likesCount, 15200);
  assert.equal(u.website, "https://example.org/me");
  assert.equal(u.joinDate, "2019-03-04");
  assert.match(u.bio, /Sharing insights/);
  assert.equal(u.defaultAvatar, undefined);
});

test("the older legacy shape still reads, and the newer block wins when both are present", () => {
  const old = { __typename: "User", core: { screen_name: "older_shape" }, legacy: { followers_count: 12, statuses_count: 40, favourites_count: 3 } };
  const [a] = usersIn({ u: old });
  assert.deepEqual([a.followersCount, a.postsCount, a.likesCount], [12, 40, 3]);
  const both = { ...old, relationship_counts: { followers: 99 } };
  assert.equal(usersIn({ u: both })[0].followersCount, 99);
  const zero = liveUser("zero_counts", { relationship_counts: { followers: 0, following: 0 } });
  assert.equal(usersIn({ u: zero })[0].followersCount, 0);
});

test("X's paid mark in the response is read as X's claim; its absence is not a claim either way", () => {
  const paid = liveTweet("901", "promo_one", { content_disclosure: { advertising_disclosure: { is_paid_promotion: true } } });
  const plain = liveTweet("902", "plain_one");
  const notPaid = liveTweet("903", "plain_two", { content_disclosure: { advertising_disclosure: { is_paid_promotion: false } } });
  const byId = new Map(tweetsIn({ list: [paid, plain, notPaid] }).map((t) => [t.id, t]));
  assert.equal(byId.get("901").paidPartnership, true);
  assert.equal(byId.get("902").paidPartnership, undefined);
  assert.equal(byId.get("903").paidPartnership, undefined);
  assert.equal(byId.get("901").quotedId, "900");
  assert.equal(byId.get("901").author, "promo_one");
});

test("a post's text comes from the response, long posts from note_tweet, so scrolled-past quotes keep it", () => {
  const long = liveTweet("904", "long_one", { note_tweet: { note_tweet_results: { result: { text: "the full long text of the post" } } } });
  const [l, s] = tweetsIn({ list: [long, liveTweet("905", "short_one")] }).sort((a, b) => a.id.localeCompare(b.id));
  assert.equal(l.text, "the full long text of the post");
  assert.equal(s.text, "short text https://t.co/xyz");
});

// Markup rotation: the saved X fixture with every class name, test id and tag that a redesign
// could change replaced, one layer at a time.
const SAVED = readFileSync(new URL("./fixtures/integration/x-saved.html", import.meta.url), "utf8");
const seeded = (seed) => () => (seed = (seed * 1103515245 + 12345) >>> 0).toString(36);
const rotations = {
  "random class names": (h, r) => h.replace(/<(article|div|span|a)\b/g, (m) => `${m} class="${r()} ${r()}"`),
  "test ids renamed": (h, r) => h.replace(/data-testid="[^"]*"/g, () => `data-testid="${r()}"`),
  "test ids removed": (h) => h.replace(/\sdata-testid="[^"]*"/g, ""),
  "attribute names obfuscated": (h, r) => h.replace(/\sdata-testid="([^"]*)"/g, (m, v) => ` data-${r()}="${v}"`),
  "article tags become role=article": (h) => h.replace(/<article\b/g, '<div role="article"').replace(/<\/article>/g, "</div>"),
};

test("the saved-page X reader survives rotated or obfuscated markup", () => {
  const base = postsFromHtml(SAVED);
  assert.equal(base.site, "X");
  const want = [base.root, ...base.replies].map((p) => [p.id, p.author, p.text, p.posted]);
  let all = SAVED;
  for (const [name, rot] of Object.entries(rotations)) {
    for (const seed of [1, 7, 42]) {
      const got = postsFromHtml(rot(SAVED, seeded(seed)));
      assert.equal(got.site, "X", name);
      assert.deepEqual([got.root, ...got.replies].map((p) => [p.id, p.author, p.text, p.posted]), want, `${name}, seed ${seed}`);
    }
    all = rot(all, seeded(3));
  }
  const stacked = postsFromHtml(all);
  assert.deepEqual([stacked.root, ...stacked.replies].map((p) => [p.id, p.author, p.text, p.posted]), want, "every rotation at once");
});

test("a page that only links to X is not read as an X thread", () => {
  const page = '<html><body><main><article><p>See <a href="https://x.com/someone/status/1">this post</a> for more.</p></article></main></body></html>';
  assert.equal(postsFromHtml(page).site, null);
});
