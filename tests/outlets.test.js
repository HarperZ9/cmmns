// The suggested outlets for Other coverage (src/core/outlets.js) meet the documented criteria: own
// feed on https, an entry in the bundled site tables, a spread of countries and owner types,
// and an order that says nothing.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FEED_OUTLETS, feedOrigin, cleanFeedUrl, chosenFeeds, MAX_CUSTOM_FEEDS } from "../src/core/outlets.js";
import { setSiteTable, siteFacts, ownerType } from "../src/core/sites.js";
import { setOwnerRows, ownerOfDomain } from "../src/core/owners.js";
import { setStateRows, stateLinksOfDomain } from "../src/core/state.js";

const json = (f) => JSON.parse(readFileSync(new URL(`../src/ext/${f}`, import.meta.url), "utf8"));
setSiteTable(json("sites.json")); setOwnerRows(json("owners.json").rows); setStateRows(json("state.json").rows);

test("every suggested feed is https, on a host of its own, with a unique id", () => {
  const ids = new Set();
  for (const [id, name, url, site, country] of FEED_OUTLETS) {
    assert.ok(!ids.has(id), "duplicate " + id); ids.add(id);
    assert.ok(name && country, id);
    assert.equal(new URL(url).protocol, "https:", id);
    assert.ok(feedOrigin(url), id);
    assert.ok(!/feedburner|feedproxy|google|rss\.app|feedly/i.test(new URL(url).hostname), `${id}: no third-party feed host`);
    assert.ok(site && !site.includes("/"), id);
  }
});

test("every suggested outlet is in the bundled site tables, and most have a named owner", () => {
  for (const [id, , , site] of FEED_OUTLETS) assert.ok(siteFacts(site), `${id}: ${site} is not in the site tables`);
  const owned = FEED_OUTLETS.filter(([, , , site]) => ownerOfDomain(site)).length;
  assert.ok(owned / FEED_OUTLETS.length >= 0.75, `${owned} of ${FEED_OUTLETS.length} have a named owner`);
});

test("the list spans countries and owner types", () => {
  const countries = new Set(FEED_OUTLETS.map((o) => o[4]));
  assert.ok(countries.size >= 15, `${countries.size} countries`);
  const types = new Set(FEED_OUTLETS.map(([, , , site]) => ownerType({ facts: siteFacts(site), state: stateLinksOfDomain(site) })));
  for (const t of ["public broadcaster", "state media", "commercial", "nonprofit", "not stated"]) assert.ok(types.has(t), t);
  const us = FEED_OUTLETS.filter((o) => o[4] === "United States").length;
  assert.ok(us / FEED_OUTLETS.length < 0.5, "no single country is the majority");
});

test("the order is alphabetical by id, so position says nothing", () => {
  const ids = FEED_OUTLETS.map((o) => o[0]);
  assert.deepEqual(ids, [...ids].sort());
});

test("typed feed addresses: https only, no credentials, no fragment", () => {
  assert.equal(cleanFeedUrl(" https://news.example/rss.xml#x "), "https://news.example/rss.xml");
  for (const bad of ["http://news.example/rss", "javascript:alert(1)", "https://a:b@news.example/rss", "https://localhost/feed", "", "x".repeat(600)]) assert.equal(cleanFeedUrl(bad), null, bad);
});

test("chosen feeds: switched-on outlets then the user's own, nothing else", () => {
  const list = chosenFeeds({ outlets: { bbc: true, npr: false }, customFeeds: ["https://mine.example/feed", "http://bad.example/feed"] });
  assert.deepEqual(list.map((f) => f.id), ["bbc", "custom:https://mine.example/feed"]);
  assert.deepEqual(chosenFeeds({}), []);
  assert.equal(chosenFeeds({ customFeeds: Array.from({ length: 40 }, (_, i) => `https://f${i}.example/rss`) }).length, MAX_CUSTOM_FEEDS);
});
