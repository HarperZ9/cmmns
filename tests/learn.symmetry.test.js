// Symmetry for the lessons and the self-check: examples are drawn evenly from left, right and
// centre, and spread across topics. Counted here, so a new example cannot tilt the set.
import test from "node:test";
import assert from "node:assert/strict";
import { LESSONS } from "../src/ext/learn/index.js";
import { ITEMS, ORDERED } from "../src/ext/learn/quiz.js";

const POL = ["left", "right", "centre"];
const count = (xs, key) => xs.reduce((m, x) => ((m[x[key]] = (m[x[key]] || 0) + 1), m), {});

test("lesson examples: left, right and centre appear equally often", () => {
  const c = count(LESSONS.flatMap((l) => l.examples), "side");
  assert.ok(c.left > 0);
  assert.equal(c.left, c.right, JSON.stringify(c));
  assert.equal(c.left, c.centre, JSON.stringify(c));
});

test("each lesson with a political example has exactly one sign example from each direction", () => {
  for (const l of LESSONS) {
    const pol = l.examples.filter((e) => POL.includes(e.side));
    if (!pol.length) continue;
    const c = count(pol.filter((e) => e.kind === "sign"), "side");
    assert.deepEqual(POL.map((s) => c[s] || 0), [1, 1, 1], l.id);
    assert.equal(pol.length, 3, `${l.id}: political examples are the three sign examples`);
  }
});

test("lesson examples span many topics, none more than 15% of them", () => {
  const ex = LESSONS.flatMap((l) => l.examples), c = count(ex, "topic");
  assert.ok(Object.keys(c).length >= 10, JSON.stringify(c));
  for (const [t, n] of Object.entries(c)) assert.ok(n / ex.length <= 0.15, `${t}: ${n} of ${ex.length}`);
});

test("each direction's examples cover at least five topics", () => {
  const ex = LESSONS.flatMap((l) => l.examples);
  for (const s of POL) assert.ok(new Set(ex.filter((e) => e.side === s).map((e) => e.topic)).size >= 5, s);
});

test("self-check: half lean and half give support, each half balanced across directions", () => {
  const lean = ITEMS.filter((i) => i.leans), fair = ITEMS.filter((i) => !i.leans);
  assert.equal(lean.length, fair.length);
  for (const half of [lean, fair]) {
    const c = count(half, "side");
    assert.deepEqual(POL.map((s) => c[s] || 0), [half.length / 3, half.length / 3, half.length / 3]);
  }
});

test("self-check: every difficulty level holds both kinds, and the order runs hard to easy", () => {
  for (const lv of [1, 2, 3]) {
    const at = ITEMS.filter((i) => i.level === lv);
    assert.ok(at.some((i) => i.leans) && at.some((i) => !i.leans), `level ${lv}`);
  }
  const levels = ORDERED.map((i) => i.level);
  assert.deepEqual(levels, [...levels].sort((a, b) => b - a));
});
