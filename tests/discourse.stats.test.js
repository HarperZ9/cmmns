// Counts with their sample size (src/core/discourse/stats.js).
import test from "node:test";
import assert from "node:assert/strict";
import { wilson, findCounts, compareArms, countRows } from "../src/core/discourse/stats.js";

const r3 = (x) => Math.round(x * 1000) / 1000;

test("the Wilson interval matches the published values for the study's neuron post", () => {
  assert.deepEqual(wilson(45, 50).map(r3), [0.786, 0.957]);
  assert.deepEqual(wilson(3, 50).map(r3), [0.021, 0.162]);
  assert.deepEqual(wilson(8, 25).map(r3), [0.172, 0.516]);
  assert.deepEqual(wilson(0, 25).map(r3), [0, 0.133]);
  assert.equal(wilson(5, 0), null);
});

test("the neuron post's counts are found, with two arms whose intervals do not overlap", () => {
  const counts = findCounts("45/50 replies mention green, against 3/50 unsteered. 8/25 say they are green, 0/25 unsteered.");
  assert.deepEqual(counts.map((c) => [c.k, c.n]), [[45, 50], [3, 50], [8, 25], [0, 25]]);
  const arms = compareArms(counts);
  assert.equal(arms.find((x) => x.a.k === 45).overlap, false);
  assert.equal(arms.find((x) => x.a.k === 8).overlap, false);
  assert.equal(compareArms(findCounts("12/40 people chose A and 15/40 people chose B.")).at(0).overlap, true);
  assert.ok(counts.find((c) => c.n === 25).small);
  assert.match(countRows(counts)[2][1], /fewer than 30/);
});

test("'k of n' and a percentage with its n are read; dates, scores and ratios without a count are not", () => {
  assert.deepEqual(findCounts("It found 8 of 47 moves.").map((c) => [c.k, c.n]), [[8, 47]]);
  assert.deepEqual(findCounts("62% of 1,200 respondents agreed").map((c) => [c.k, c.n]), [[744, 1200]]);
  assert.deepEqual(findCounts("Posted 10/23, rated 9/10, mixed 3/4 cup").map((c) => [c.k, c.n]), []);
  assert.deepEqual(findCounts("The Fed meets on 12/17 and 1/28."), []);
});
