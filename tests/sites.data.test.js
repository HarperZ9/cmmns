// The bundled site table (src/ext/sites.json): sourced, licensed, under the add-on linter's 5 MB,
// and complete: every site a shipped fact-check review names as where its claim appeared has a
// record, and no platform, archive, shortener or fact-checker is filed as a site.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { joinClaims } from "../src/core/claims-parts.js";
import { hostedKind, siteKey } from "../src/core/hosts.js";
import { setSiteTable, siteRecord, siteFacts, OWNER_TYPES } from "../src/core/sites.js";

const path = (f) => new URL(`../src/ext/${f}`, import.meta.url);
const table = JSON.parse(readFileSync(path("sites.json"), "utf8"));
const main = JSON.parse(readFileSync(path("claims.json"), "utf8"));
const claims = joinClaims(main, (main.parts || []).map((f) => JSON.parse(readFileSync(path(f), "utf8"))));

test("sites.json is under 5 MB and names its sources and licences", () => {
  assert.ok(statSync(path("sites.json")).size <= 5000000, `${statSync(path("sites.json")).size} bytes`);
  assert.equal(table.sources.facts.licence, "CC0 1.0");
  assert.equal(table.sources.records.licence, "CC BY 4.0");
  assert.match(table.sources.records.url, /^https:\/\/datacommons\.org\//);
});

test("every site a shipped review names has a record (target: 100%)", () => {
  setSiteTable(table);
  const named = [...new Set(claims.rows.map((r) => r[6]).filter(Boolean))];
  const missing = named.filter((d) => !siteRecord(d));
  assert.ok(named.length > 100, `${named.length} sites named`);
  assert.deepEqual(missing, []);
});

test("no record is filed under a platform, archive, shortener or fact-checker", () => {
  const checkers = new Set(claims.rows.map((r) => siteKey(new URL(r[3]).hostname)));
  for (const key of Object.keys(table.records)) {
    assert.equal(hostedKind(key), null, key);
    assert.ok(!checkers.has(key), `fact-checker filed as a site: ${key}`);
    assert.equal(siteKey(key), key, `record key is not a site key: ${key}`);
  }
});

test("records count what they list, newest first, with ratings and links kept", () => {
  for (const [key, r] of Object.entries(table.records)) {
    assert.ok(r.n >= r.reviews.length && r.reviews.length > 0, key);
    assert.ok(r.m >= 1 && r.m <= r.n, key);
    for (const [claim, rating, ci, url] of r.reviews) assert.ok(claim && rating && table.checkers[ci] && /^https?:\/\//.test(url), key);
    const dates = r.reviews.map((x) => x[4] || "");
    assert.deepEqual(dates, [...dates].sort().reverse(), key);
  }
});

test("facts carry only Wikidata's owner types, years and Q-ids", () => {
  for (const [host, [name, founded, , type, qid]] of Object.entries(table.facts)) {
    assert.ok(name, host);
    assert.ok(founded === null || /^-?\d{4}$/.test(founded), host);
    assert.ok(type === null || OWNER_TYPES.includes(type), host);
    assert.match(qid, /^Q\d+$/, host);
  }
});

test("a known outlet resolves with its facts", () => {
  setSiteTable(table);
  const f = siteFacts("www.theguardian.com");
  assert.equal(f.name, "The Guardian");
  assert.equal(f.founded, "1821");
  assert.match(f.country, /United Kingdom/);
});
