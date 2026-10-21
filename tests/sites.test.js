// Site keys, archive unwrapping and the fact-check record line (src/core/sites.js, hosts.js).
import test from "node:test";
import assert from "node:assert/strict";
import { hostOf, siteKey, unwrapArchive, hostedKind } from "../src/core/hosts.js";
import { setSiteTable, siteFacts, siteRecord, recordLine, siteInfoRows, ownerType, SITE_RECORD_DOES_NOT_PROVE } from "../src/core/sites.js";

test("hosts lose www, m. and mobile. prefixes and keep everything else", () => {
  assert.equal(hostOf("https://www.nytimes.com/2026/a.html"), "nytimes.com");
  assert.equal(hostOf("https://m.facebook.com/x"), "facebook.com");
  assert.equal(hostOf("https://mobile.twitter.com/x"), "twitter.com");
  assert.equal(hostOf("https://transcripts.cnn.com/show"), "transcripts.cnn.com");
  assert.equal(hostOf("ftp://example.com/x"), null);
  assert.equal(hostOf("not a url"), null);
});

test("a site key is the registrable domain, with two-part suffixes", () => {
  assert.equal(siteKey("transcripts.cnn.com"), "cnn.com");
  assert.equal(siteKey("news.bbc.co.uk"), "bbc.co.uk");
  assert.equal(siteKey("www.abc.net.au"), "abc.net.au");
  assert.equal(siteKey("g1.globo.com"), "globo.com");
  assert.equal(siteKey("48months.mygov.in"), "mygov.in");
  assert.equal(siteKey("192.168.0.1"), null);
});

test("on shared hosts every subdomain is its own site", () => {
  assert.equal(siteKey("someone.blogspot.com"), "someone.blogspot.com");
  assert.equal(siteKey("a.b.substack.com"), "b.substack.com");
  assert.equal(siteKey("abcnews.go.com"), "abcnews.go.com");
  assert.equal(siteKey("blogspot.com"), null, "the shared host itself is not a site");
});

test("archive links unwrap to the page they archived when the address carries it", () => {
  assert.equal(unwrapArchive("https://web.archive.org/web/20240101000000/https://www.example.org/story"), "https://www.example.org/story");
  assert.equal(unwrapArchive("https://web.archive.org/web/20240101000000*/example.org/story"), "http://example.org/story");
  assert.equal(unwrapArchive("https://archive.ph/2024.01.01-000000/https://news.example.com/a"), "https://news.example.com/a");
  assert.equal(unwrapArchive("https://archive.ph/AbC12"), null, "a short archive id hides the original");
  assert.equal(unwrapArchive("https://www.example.org/web/x"), null);
});

test("platforms, archives and shorteners are recognised as hosting other people's posts", () => {
  for (const h of ["facebook.com", "web.facebook.com", "x.com", "twitter.com", "youtube.com", "youtu.be", "tiktok.com", "t.me", "vk.com", "weibo.com", "rumble.com", "truthsocial.com", "gab.com", "threads.net", "bsky.app"]) assert.equal(hostedKind(h), "platform", h);
  for (const h of ["archive.org", "archive.ph", "perma.cc", "ghostarchive.org"]) assert.equal(hostedKind(h), "archive", h);
  for (const h of ["bit.ly", "tinyurl.com"]) assert.equal(hostedKind(h), "shortener", h);
  assert.equal(hostedKind("nytimes.com"), null);
});

const TABLE = {
  checkers: ["Checker A", "Checker B", "Checker C"],
  facts: { "example-news.com": ["Example News", "1998", "Exampleland", "commercial", "Q1"], "pub.example": ["Example Public", "1936", "Otherland", "public broadcaster", "Q2"] },
  records: {
    "example-news.com": { n: 3, m: 2, since: "2024-05-01", until: "2026-09-30", reviews: [["Claim one is said", "False", 0, "https://a.example/1", "2026-09-30"], ["Claim two is said", "Misleading", 1, "https://b.example/2", "2025-01-02"], ["Claim three is said", "Mostly true", 0, "https://a.example/3", "2024-05-01"]] },
  },
};

test("facts resolve for subdomains, records by site key", () => {
  setSiteTable(TABLE);
  assert.equal(siteFacts("edition.example-news.com").name, "Example News");
  assert.equal(siteRecord("live.example-news.com").n, 3);
  assert.equal(siteRecord("live.example-news.com").reviews[1].checker, "Checker B");
  assert.equal(siteRecord("unknown.example"), null);
  assert.equal(siteFacts("unknown.example"), null);
});

test("the record line counts reviews and fact-checkers and quotes nothing as Radar's", () => {
  setSiteTable(TABLE);
  assert.equal(recordLine(siteRecord("example-news.com")), "3 reviews by 2 fact-checkers since 2024-05-01, ratings as the checkers wrote them");
  assert.equal(recordLine({ n: 1, m: 1, since: "2025-02-03" }), "1 review by 1 fact-checker since 2025-02-03, ratings as the checkers wrote them");
  assert.equal(recordLine(null), null);
});

test("the site rows show owner, type, founding, country, state links and the record, each sourced", () => {
  setSiteTable(TABLE);
  const rows = siteInfoRows({ domain: "example-news.com", owner: { name: "Example News", owner: "Example Holdings", source: "http://www.wikidata.org/entity/Q1" }, state: [], facts: siteFacts("example-news.com"), record: siteRecord("example-news.com") }, { onList: () => {} });
  const get = (h) => (rows.find((r) => r[0] === h) || [])[1];
  assert.equal(get("Owned by"), "Example Holdings (Wikidata)");
  assert.equal(get("Owner type"), "commercial, as Wikidata states it");
  assert.equal(get("Founded"), "1998 (Wikidata)");
  assert.equal(get("Country"), "Exampleland (Wikidata)");
  assert.match(get("Fact-check record"), /^3 reviews by 2 fact-checkers since 2024-05-01/);
  assert.ok(get("Reviews").action, "a button opens the list");
  assert.equal(get("Does not prove"), SITE_RECORD_DOES_NOT_PROVE);
});

test("a site with nothing on file says so instead of a blank card", () => {
  const rows = siteInfoRows({ domain: "nothing.example", owner: null, state: [], facts: null, record: null });
  assert.ok(rows.some(([, v]) => typeof v === "object" && v.note && /no Wikidata entry/.test(v.note)));
  assert.ok(rows.some(([h, v]) => h === "Fact-check record" && /No review in Radar's table/.test(v)));
});

test("owner type comes from state links first, then what Wikidata states", () => {
  assert.equal(ownerType({ facts: { ownerType: "commercial" }, state: [{ basis: "state-owned", state: "Exampleland" }] }), "state media");
  assert.equal(ownerType({ facts: null, state: [{ basis: "state-owned", level: "regional", state: "Exampleland" }] }), "regional govt");
  assert.equal(ownerType({ facts: null, state: [{ basis: "public-broadcaster", state: "Exampleland" }] }), "public broadcaster");
  assert.equal(ownerType({ facts: { ownerType: "nonprofit" }, state: [] }), "nonprofit");
  assert.equal(ownerType({ facts: null, state: [{ basis: "named-in-report", state: "Exampleland" }] }), "not stated", "a report naming a site is not an owner type");
  assert.equal(ownerType({ facts: null, state: [] }), "not stated");
});

test("redirects resolve to the real address; X's t.co links use the visible text", async () => {
  const { realLink } = await import("../src/core/hosts.js");
  assert.equal(realLink("https://t.co/abc", "nytimes.com/2026/10/x…"), "https://nytimes.com/2026/10/x");
  assert.equal(realLink("https://t.co/abc", "pic.x"), null);
  assert.equal(realLink("https://l.facebook.com/l.php?u=https%3A%2F%2Fexample.org%2Fa&h=1"), "https://example.org/a");
  assert.equal(realLink("https://www.youtube.com/redirect?q=https%3A%2F%2Fexample.org%2Fb"), "https://example.org/b");
  assert.equal(realLink("https://www.google.com/url?q=https://example.org/c&sa=U"), "https://example.org/c");
  assert.equal(realLink("https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.org%2Fd"), "https://example.org/d");
  assert.equal(realLink("https://www.bing.com/ck/a?!&&p=1&u=a1" + btoa("https://example.org/e").replace(/=+$/, "") + "&ntb=1"), "https://example.org/e");
  assert.equal(realLink("https://l.facebook.com/l.php?u=javascript%3Aalert(1)"), null);
  assert.equal(realLink("https://example.org/f"), "https://example.org/f");
});

test("a publisher or parent organisation is named as what it is, never as an owner", async () => {
  const { ownerHeading, siteChips } = await import("../src/core/sites.js");
  assert.equal(ownerHeading({ owner: "A" }), "Owned by");
  assert.equal(ownerHeading({ owner: "A", via: "parent" }), "Parent organisation");
  assert.equal(ownerHeading({ owner: "A", via: "publisher" }), "Published by");
  assert.deepEqual(siteChips({ domain: "a.example", owner: { owner: "B Group", via: "publisher" }, state: [], facts: null, record: { n: 2 } }), ["published by B Group"], "the count stays in the card, beside its limit");
  assert.deepEqual(siteChips({ domain: "a.example", owner: null, state: [], facts: { ownerType: "nonprofit" }, record: null }), ["nonprofit"]);
  assert.deepEqual(siteChips({ domain: "a.example", owner: null, state: [], facts: null, record: null }), []);
});
