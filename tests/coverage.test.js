// "Other coverage" (src/core/coverage.js): headlines from the outlets' own feeds are matched with
// the article's title on this device. Nothing from the page is sent anywhere; outlets are labelled
// by owner and owner type as the site tables state them, never by a side.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { titleWords, bestMatch, coverageFromFeeds, coverageGroups, coveragePlan, feedOrigins, feedStatus, COVERAGE_PRIVACY, COVERAGE_DOES_NOT_PROVE, FEED_ERRORS } from "../src/core/coverage.js";
import { parseFeed } from "../src/core/feeds.js";

const fx = (n) => parseFeed(readFileSync(new URL(`./fixtures/feeds/${n}`, import.meta.url), "utf8")).items;
const TITLE = "Floods force thousands from homes in the river valley - Example News";
const feed = (id, site, url) => ({ id, name: id, url, site, country: null, custom: false });

test("headline words: main words only, plain plurals folded, the site name dropped", () => {
  assert.deepEqual(titleWords(TITLE), ["flood", "force", "thousand", "home", "river", "valley"]);
  assert.deepEqual(titleWords("A to Z"), []);
  assert.doesNotMatch(titleWords('"Minister" resigns OR (x:y) after vote').join(" "), /["():]/);
});

test("a match needs shared words in the entry's own headline, not just its summary", () => {
  const w = titleWords(TITLE);
  assert.ok(bestMatch(w, fx("rss.xml")), "the same story in another wording matches");
  assert.ok(bestMatch(w, fx("atom.xml")));
  assert.equal(bestMatch(w, [{ title: "Markets close higher", summary: "floods thousands homes river valley", link: "https://a.example/x" }]), null);
  assert.equal(bestMatch(["one"], fx("rss.xml")), null, "one word is never enough");
});

test("one entry per outlet, without the page's own site, labelled from the tables", () => {
  const results = [
    { feed: feed("courier", "courier.example", "https://courier.example/world/rss.xml"), items: fx("rss.xml") },
    { feed: feed("herald", "herald.example", "https://herald.example/atom.xml"), items: fx("atom.xml") },
    { feed: feed("wave", "wave.example", "https://wave.example/rss"), items: fx("rdf.xml") },
    { feed: feed("self", "self.example", "https://self.example/rss"), items: fx("rss.xml") },
    { feed: feed("down", "down.example", "https://down.example/rss"), items: [], error: "timeout" },
  ];
  const info = { "herald.example": { facts: { ownerType: "nonprofit", country: "Otherland" }, state: [], owner: { owner: "Herald Trust" } } };
  const { list } = coverageFromFeeds(TITLE, results, { self: "self.example", infoOf: (d) => info[d] || { facts: null, state: [] } });
  assert.deepEqual(list.map((x) => x.site), ["courier.example", "herald.example", "wave.example"]);
  assert.equal(list[1].type, "nonprofit");
  assert.equal(list[1].owner, "Herald Trust");
  assert.equal(list[1].country, "Otherland");
  assert.equal(list[0].type, "not stated");
  assert.equal(list[1].url, "https://herald.example/2026/10/valley-floods");
  assert.ok(list.every((x) => x.shared.length >= 2 && /^https:\/\//.test(x.url)));
});

test("every feed asked shows up in the status, including the silent and broken ones", () => {
  const st = feedStatus([{ feed: feed("a", "a.example", "https://a.example/rss"), items: fx("rss.xml"), ms: 12 }, { feed: feed("b", "b.example", "https://b.example/rss"), items: [] }, { feed: feed("c", "c.example", "https://c.example/rss"), items: [], error: "redirect" }]);
  assert.deepEqual(st.map((x) => x.state), ["ok", "empty", "redirect"]);
  assert.ok(FEED_ERRORS.redirect && FEED_ERRORS["no-permission"] && FEED_ERRORS.timeout);
});

test("the plan names each host once and asks for each host only", () => {
  const feeds = [feed("a", "a.example", "https://feeds.a.example/rss"), feed("b", "a.example", "https://feeds.a.example/other"), feed("c", "c.example", "https://c.example/f")];
  assert.deepEqual(coveragePlan(feeds), ["c.example", "feeds.a.example"]);
  assert.deepEqual(feedOrigins(feeds), ["https://c.example/*", "https://feeds.a.example/*"]);
});

test("groups follow a fixed order of owner types, not a ranking", () => {
  const g = coverageGroups([{ type: "commercial" }, { type: "state media" }, { type: "commercial" }, { type: "not stated" }]);
  assert.deepEqual(g.map((x) => x.type), ["state media", "commercial", "not stated"]);
  assert.deepEqual(g.map((x) => x.n), [1, 2, 1]);
});

test("the privacy text says what is requested, from whom, and that nothing from the page is sent", () => {
  assert.match(COVERAGE_PRIVACY, /off unless you turn it on/);
  assert.match(COVERAGE_PRIVACY, /each outlet you chose/);
  assert.match(COVERAGE_PRIVACY, /sends nothing from the page/);
  assert.match(COVERAGE_PRIVACY, /IP address/);
  assert.match(COVERAGE_PRIVACY, /No aggregator/);
  assert.doesNotMatch(COVERAGE_PRIVACY + COVERAGE_DOES_NOT_PROVE, /GDELT|—/);
});

test("empty or broken answers give an empty list", () => {
  assert.deepEqual(coverageFromFeeds(TITLE, null).list, []);
  assert.deepEqual(coverageFromFeeds(TITLE, [{ feed: null }, null]).list, []);
});
