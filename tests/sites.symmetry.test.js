// Symmetry for site cards and other coverage: outlets from every direction and many countries get
// the same rows, the same wording and the same labels from the same facts. Nothing in the site or
// coverage code reads or names a political side.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { siteInfoRows, siteGlance, siteChips, ownerType } from "../src/core/sites.js";
import { coverageFromFeeds } from "../src/core/coverage.js";
import { hostedKind, siteKey } from "../src/core/hosts.js";

// Outlets across the spectrum and across countries, by domain only.
const OUTLETS = ["foxnews.com", "msnbc.com", "breitbart.com", "jacobin.com", "dailywire.com", "theguardian.com", "telegraph.co.uk", "rt.com", "dw.com",
  "cgtn.com", "aljazeera.com", "timesofindia.indiatimes.com", "thewire.in", "folha.uol.com.br", "lefigaro.fr", "liberation.fr", "nationalreview.com", "motherjones.com"];
const same = (domain) => ({ domain, owner: { name: "Outlet", owner: "Holding Co" }, state: [], facts: { name: "Outlet", founded: "1990", country: "Somewhere", ownerType: "commercial" }, record: { n: 5, m: 2, since: "2025-01-01", latest: [{ rating: "False", checker: "Checker", date: "2026-01-01" }] } });
const strip = (rows, domain) => JSON.stringify(rows.map(([h, v]) => [h, typeof v === "string" ? v.split(domain).join("D") : typeof v === "object" && v && v.action ? v.action[0] : v]));

test("the same facts give the same card for every outlet", () => {
  const base = strip(siteInfoRows(same(OUTLETS[0])), OUTLETS[0]);
  for (const d of OUTLETS) assert.equal(strip(siteInfoRows(same(d)), d), base, d);
  const chips = JSON.stringify(siteChips(same(OUTLETS[0])));
  for (const d of OUTLETS) assert.equal(JSON.stringify(siteChips(same(d))), chips, d);
  for (const d of OUTLETS) assert.equal(siteGlance(same(d)).fact.split(d).join("D"), siteGlance(same(OUTLETS[0])).fact.split(OUTLETS[0]).join("D"), d);
});

test("the same state basis gives the same owner type in every country", () => {
  for (const state of ["Russia", "China", "United States", "United Kingdom", "Qatar", "Iran", "France", "Israel", "India", "Türkiye"]) {
    assert.equal(ownerType({ state: [{ basis: "state-owned", state }] }), "state media", state);
    assert.equal(ownerType({ state: [{ basis: "public-broadcaster", state }] }), "public broadcaster", state);
    assert.equal(ownerType({ state: [{ basis: "named-in-report", state }] }), "not stated", state);
  }
});

test("other coverage labels every outlet by the same rule, in the order the feeds were asked", () => {
  const headline = "Floods force thousands from river valley homes";
  const results = OUTLETS.map((d, i) => ({ feed: { id: d, name: d, url: `https://${d}/feed`, site: d }, items: [{ title: headline, link: `https://${d}/story-${i}`, summary: "" }], error: null }));
  const { list } = coverageFromFeeds(headline, results, { self: "self.example", infoOf: () => ({ facts: { ownerType: "commercial" }, state: [] }) });
  assert.deepEqual(list.map((x) => x.site), OUTLETS.map((d) => siteKey(d)));
  assert.ok(list.every((x) => x.type === "commercial"));
  assert.ok(list.every((x) => x.shared.join() === list[0].shared.join()), "the same headline matches by the same words everywhere");
});

test("posting services from every direction count as platforms alike", () => {
  for (const h of ["facebook.com", "x.com", "truthsocial.com", "gab.com", "rumble.com", "bsky.app", "threads.net", "mastodon.social", "vk.com", "weibo.com", "t.me"]) assert.equal(hostedKind(h), "platform", h);
});

test("no site or coverage code reads or names a side", () => {
  for (const f of ["sites.js", "coverage.js", "hosts.js", "outlets.js", "feeds.js", "feedfetch.js", "generic.js", "health.js"]) {
    const src = readFileSync(new URL(`../src/core/${f}`, import.meta.url), "utf8").replace(/^\s*\/\/.*$/gm, "");
    assert.doesNotMatch(src, /\bleft\b|\bright[- ](?:wing|leaning)\b|\b(?:liberal|conservative|progressive|partisan|bias(?:ed)?|centrist)\b/i, f);
  }
});
