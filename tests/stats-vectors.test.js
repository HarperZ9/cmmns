// The Wilson interval in src/core/discourse/stats.js against the shared statistics vectors
// (analysis/vectors/stats_vectors.json, CC0 1.0). analysis/tests/test_stats_vectors.py reads the same
// file from Python, so the JS and Python homes are held to one contract.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { wilson } from "../src/core/discourse/stats.js";

const V = JSON.parse(readFileSync(new URL("../analysis/vectors/stats_vectors.json", import.meta.url), "utf8"));

test("wilson matches every vector to 1e-12", () => {
  assert.ok(V.wilson.length >= 5);
  for (const row of V.wilson) {
    const [lo, hi] = wilson(row.k, row.n, row.z);
    assert.ok(Math.abs(lo - row.interval[0]) <= 1e-12, `${row.k}/${row.n} low`);
    assert.ok(Math.abs(hi - row.interval[1]) <= 1e-12, `${row.k}/${row.n} high`);
  }
});

test("wilson refuses what the vectors never contain", () => {
  assert.equal(wilson(1, 0), null);
  assert.equal(wilson(3, 2), null);
});
