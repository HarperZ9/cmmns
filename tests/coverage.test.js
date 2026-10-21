// "Other coverage" (src/core/coverage.js): the query Radar would send, how GDELT's answer is read,
// and how each outlet is labelled. Only the title's main words are sent; outlets are labelled by
// owner type as the site tables state it, never by a side.
import test from "node:test";
import assert from "node:assert/strict";
import { coverageTerms, coverageUrl, coverageList, coverageGroups, COVERAGE_PRIVACY, COVERAGE_HOST } from "../src/core/coverage.js";

test("the query keeps the title's four longest words, in order, and drops the site name", () => {
  assert.equal(coverageTerms("Floods force thousands from homes in the river valley - Example News"), "floods force thousands valley");
  assert.equal(coverageTerms("Floods force thousands | Example News"), "floods force thousands");
  assert.equal(coverageTerms("A to Z"), null, "too few usable words");
});

test("quotes, operators and odd characters cannot reach the query", () => {
  const t = coverageTerms('"Minister" resigns OR (sourcecountry:xx) after vote -leak');
  assert.doesNotMatch(t, /["():]|\bor\b|-/i);
});

test("the URL carries the terms and nothing about the page or the user", () => {
  const u = new URL(coverageUrl("Floods force thousands from homes in the river valley"));
  assert.equal(u.host, COVERAGE_HOST);
  assert.equal(u.searchParams.get("query"), "floods force thousands valley");
  assert.deepEqual([...u.searchParams.keys()].sort(), ["format", "maxrecords", "mode", "query", "sort", "timespan"]);
  assert.equal(coverageUrl("A to Z"), null);
});

test("the privacy text says what is sent and to whom", () => {
  assert.match(COVERAGE_PRIVACY, /title/);
  assert.match(COVERAGE_PRIVACY, /GDELT/);
  assert.match(COVERAGE_PRIVACY, /api\.gdeltproject\.org/);
  assert.match(COVERAGE_PRIVACY, /off/i);
});

const GDELT = { articles: [
  { url: "https://www.self.example/a", title: "Same story", domain: "self.example", seendate: "20261015T194500Z", language: "English", sourcecountry: "Exampleland" },
  { url: "https://pub.example/b", title: "Floods", domain: "pub.example", seendate: "20261016T101500Z", language: "English", sourcecountry: "Otherland" },
  { url: "https://news.pub.example/c", title: "Floods again", domain: "news.pub.example", seendate: "20261016T111500Z", language: "English", sourcecountry: "Otherland" },
  { url: "https://plain.example/d", title: "Valley floods", domain: "plain.example", seendate: "20261017T000000Z", language: "French", sourcecountry: "Thirdland" },
  { url: "javascript:alert(1)", title: "bad", domain: "bad.example" },
] };
const INFO = { "pub.example": { facts: { ownerType: "public broadcaster" }, state: [] } };

test("outlets are listed once each, without the page's own site, each with its owner type", () => {
  const list = coverageList(GDELT, { self: "self.example", infoOf: (d) => INFO[d] || { facts: null, state: [] } });
  assert.deepEqual(list.map((x) => x.site), ["pub.example", "plain.example"]);
  assert.equal(list[0].type, "public broadcaster");
  assert.equal(list[1].type, "not stated");
  assert.equal(list[0].seen, "2026-10-16");
  assert.ok(list.every((x) => /^https:\/\//.test(x.url)));
});

test("groups follow a fixed order of owner types, not a ranking", () => {
  const g = coverageGroups([{ type: "commercial" }, { type: "state media" }, { type: "commercial" }, { type: "not stated" }]);
  assert.deepEqual(g.map((x) => x.type), ["state media", "commercial", "not stated"]);
  assert.deepEqual(g.map((x) => x.n), [1, 2, 1]);
});

test("an answer that is not GDELT's article list gives an empty list", () => {
  assert.deepEqual(coverageList(null, {}), []);
  assert.deepEqual(coverageList({ error: "x" }, {}), []);
});
