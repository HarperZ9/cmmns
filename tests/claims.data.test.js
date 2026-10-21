// The bundled fact-check table (src/ext/claims.json): within its size cap, sourced, licensed, and
// carrying only the fields Radar shows. The person a fact-checker says made a claim is not kept.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildClaimIndex } from "../src/core/claims.js";
import { joinClaims, CLAIMS_PART_MAX } from "../src/core/claims-parts.js";

const file = join(dirname(fileURLToPath(import.meta.url)), "../src/ext/claims.json");
const main = JSON.parse(readFileSync(file, "utf8"));
const partFiles = (main.parts || []).map((n) => join(dirname(file), n));
const table = joinClaims(main, partFiles.map((f) => JSON.parse(readFileSync(f, "utf8"))));

test("claims.json stays within the 6 MB cap, each file under the add-on linter's 5 MB", () => {
  const sizes = [file, ...partFiles].map((f) => statSync(f).size);
  assert.ok(sizes.reduce((a, b) => a + b, 0) <= 6000000 + 1000 * sizes.length, `${sizes} bytes`);
  for (const s of sizes) assert.ok(s <= CLAIMS_PART_MAX, `${s} bytes`);
});

test("claims.json names its source and licence", () => {
  assert.equal(table.source.licence, "CC BY 4.0");
  assert.match(table.source.url, /^https:\/\/datacommons\.org\//);
  assert.deepEqual(table.fields, ["claim", "rating", "checker", "url", "date", "langGuess", "appearedOn"]);
});

test("every row has a claim, a rating, a fact-checker and a review link, and nothing else", () => {
  const perChecker = new Map();
  for (const r of table.rows) {
    assert.equal(r.length, 7);
    assert.ok(r[6] === null || /^[a-z0-9.-]+\.[a-z]{2,}$/.test(r[6]), `appearedOn ${r[6]}`);
    const [claim, rating, ci, url, date] = r;
    assert.ok(claim && rating && table.checkers[ci], JSON.stringify(r));
    assert.match(url, /^https?:\/\//);
    assert.ok(date === null || /^\d{4}-\d\d-\d\d$/.test(date));
    perChecker.set(ci, (perChecker.get(ci) || 0) + 1);
  }
  assert.ok(Math.max(...perChecker.values()) <= 1500, "one fact-checker over the per-checker cap");
});

test("the table indexes with almost every row usable", () => {
  const idx = buildClaimIndex(table);
  assert.ok(idx.n >= table.rows.length * 0.99, `${idx.n} of ${table.rows.length}`);
});
