import test from "node:test";
import assert from "node:assert/strict";
import { timingBursts, poissonTail } from "../src/core/timing.js";
import { languageFits } from "../src/core/langs.js";

const t0 = Date.parse("2026-10-18T08:00:00Z");
const at = (s) => new Date(t0 + s * 1000).toISOString();

test("poisson tail", () => {
  assert.equal(poissonTail(0, 2), 1);
  assert.ok(Math.abs(poissonTail(1, 1) - (1 - Math.exp(-1))) < 1e-12);
});

test("a tight burst in a slow thread is found", () => {
  // 20 replies spread over 10 hours, plus 5 accounts inside 10 seconds
  const rows = Array.from({ length: 20 }, (_, i) => ({ author: "u" + i, posted: at(i * 1800) }));
  for (let i = 0; i < 5; i++) rows.push({ author: "b" + i, posted: at(15000 + i * 2) });
  // Synthetic times, exact to the second; spaced on round half hours they would otherwise read as rounded.
  const b = timingBursts(rows, { precision: "second" });
  assert.equal(b.length, 1);
  assert.deepEqual(b[0].authors.filter((a) => a.startsWith("b")).length, 5);
  assert.ok(b[0].p < 0.001);
});

test("a busy thread at a steady pace has no bursts", () => {
  const rows = Array.from({ length: 300 }, (_, i) => ({ author: "u" + i, posted: at(i * 4) }));
  assert.deepEqual(timingBursts(rows), []);
});

test("one account posting fast is not a burst of accounts", () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({ author: "u" + i, posted: at(i * 1800) }));
  for (let i = 0; i < 6; i++) rows.push({ author: "same", posted: at(15000 + i) });
  assert.deepEqual(timingBursts(rows), []);
});

test("language fits the labelled country", () => {
  assert.equal(languageFits("French", "France"), true);
  assert.equal(languageFits("Russian", "France"), false);
  assert.equal(languageFits("French", "Canada"), true);
  assert.equal(languageFits("Klingon", "France"), null);
  assert.equal(languageFits("French", null), null);
});
