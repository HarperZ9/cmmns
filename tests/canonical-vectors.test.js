// captureCanonical against the canonical-record/1 golden vectors (tests/fixtures/canonical_vectors.json,
// CC0 1.0, copied from Flywheel tests/data/canonical_vectors.json). The spec is RFC 8785 (JCS); the
// capture form writes it for every valid case. Two inputs the spec refuses are still accepted here,
// a lone surrogate and an integer above 2^53 - 1; this test pins that so a change is seen.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { captureCanonical } from "../src/core/capture.js";

const V = JSON.parse(readFileSync(new URL("./fixtures/canonical_vectors.json", import.meta.url), "utf8"));

test("every valid vector serialises to the canonical bytes and digest", () => {
  assert.ok(V.cases.length >= 30);
  for (const c of V.cases) {
    const out = captureCanonical(JSON.parse(c.input));
    assert.equal(out, c.canonical, c.id);
    assert.equal(createHash("sha256").update(out, "utf8").digest("hex"), c.sha256, c.id);
  }
});

test("the inputs the spec refuses: what the capture form does with each is pinned", () => {
  const accepted = [];
  for (const c of V.invalid) {
    let parsed;
    try { parsed = JSON.parse(c.input); } catch { continue; } // NaN and Infinity are not JSON
    try { captureCanonical(parsed); accepted.push(c.id); } catch { /* refused */ }
  }
  assert.deepEqual(accepted.sort(), ["lone-surrogate", "unsafe-int"]);
  assert.equal(V.invalid.find((c) => c.id === "unsafe-int").implementations.cmmns_capture.startsWith("accepts"), true);
});
