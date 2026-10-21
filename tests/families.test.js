// Badge families and the measured-accuracy hook. Each family shows its measured precision from
// src/core/measured.js when the evaluation has one, and "not measured yet" otherwise.
import test from "node:test";
import assert from "node:assert/strict";
import { FAMILIES, familyOf, measuredLine } from "../src/core/families.js";
import { MEASURED } from "../src/core/measured.js";
import { AREA_IDS } from "../src/core/settings.js";

test("every family has a name, a known area and a kind", () => {
  const ids = new Set();
  for (const f of FAMILIES) {
    assert.ok(f.id && f.name, JSON.stringify(f));
    assert.ok(AREA_IDS.includes(f.area), f.id + " area " + f.area);
    assert.ok(["detector", "platform", "table", "technique", "file"].includes(f.kind), f.id);
    assert.ok(!ids.has(f.id), "duplicate " + f.id);
    ids.add(f.id);
  }
});

test("account flags and rhetoric families map to a family", () => {
  assert.equal(familyOf("flag", "based-elsewhere"), "mismatch");
  assert.equal(familyOf("flag", "same-text"), "duplicates");
  assert.equal(familyOf("flag", "new-account"), "new-account");
  assert.equal(familyOf("marker", "dehumanise"), "dehumanise");
  assert.equal(familyOf("flag", "never-heard-of"), null);
});

test("an unmeasured detector says so plainly", () => {
  const line = measuredLine("mismatch", {});
  assert.equal(line.measured, false);
  assert.equal(line.text, "not measured yet");
});

test("a measured detector shows precision with its interval and sample", () => {
  const table = { mismatch: { precision: 0.912, low: 0.84, high: 0.955, n: 120, split: "test" } };
  const line = measuredLine("mismatch", table);
  assert.equal(line.measured, true);
  assert.equal(line.text, "precision 91% (95% interval 84 to 96%), 120 badges checked, held-out test set");
});

test("a measurement with no sample size is not shown as a measurement", () => {
  assert.equal(measuredLine("mismatch", { mismatch: { precision: 0.9 } }).measured, false);
  assert.equal(measuredLine("mismatch", { mismatch: { precision: 1.4, n: 10 } }).measured, false);
});

test("platform-reported families say whose label it is", () => {
  const line = measuredLine("x-spam", {});
  assert.equal(line.measured, false);
  assert.match(line.text, /site's own label/);
});

test("measured.js exports a table keyed by known families", () => {
  assert.equal(typeof MEASURED, "object");
  const known = new Set(FAMILIES.map((f) => f.id));
  for (const k of Object.keys(MEASURED)) assert.ok(known.has(k), "unknown family in measured.js: " + k);
});

test("table lookups point at their cited source instead of a precision", () => {
  const line = measuredLine("state-link", {});
  assert.equal(line.measured, false);
  assert.match(line.text, /cited/);
});

test("persuasion techniques are families in the Language area with a held-back or measured line", async () => {
  const { TECHNIQUES } = await import("../src/core/persuasion.js");
  for (const id of Object.keys(TECHNIQUES)) {
    const f = FAMILIES.find((x) => x.id === id);
    assert.ok(f && f.kind === "technique" && f.area === "language", id);
    assert.match(measuredLine(id).text, /^(held back|precision)/, id);
  }
});
