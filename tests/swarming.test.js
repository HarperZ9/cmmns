// The swarming sign (src/core/swarming.js): many new or flagged accounts replying to one post within
// minutes. Counts only, never handles; the same result whatever the accounts are called and in
// whatever order they load; and the organic rate on PHEME is committed beside it.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { swarmSign, SWARM_MIN, SWARM_MIN_KNOWN, SWARM_WINDOW_SEC, SWARM_DOES_NOT_PROVE } from "../src/core/swarming.js";
import { TECHNIQUE_BASELINES } from "../src/core/techniques-data.js";
import { baselineLine } from "../src/core/baselines.js";
import { SIZE_BINS } from "../src/core/baselines-bins.js";

const T0 = Date.parse("2026-10-01T12:00:00Z");
const at = (s) => new Date(T0 + s * 1000).toISOString();
// n replies `gap` seconds apart; the first `marked` accounts are new.
function thread(n, marked, gap = 30, name = (i) => `acct${i}`) {
  const rows = [], marks = {};
  for (let i = 0; i < n; i++) { rows.push({ author: name(i), posted: at(i * gap) }); marks[name(i).toLowerCase()] = { new: i < marked, flagged: false }; }
  return { rows, markOf: (h) => marks[h] || null };
}

test("fires when enough new or flagged accounts converge within the window", () => {
  const { rows, markOf } = thread(SWARM_MIN_KNOWN + 2, SWARM_MIN + 1);
  const s = swarmSign(rows, markOf);
  assert.ok(s);
  assert.equal(s.marked, SWARM_MIN + 1);
  assert.equal(s.windowSec, SWARM_WINDOW_SEC);
  assert.ok(!JSON.stringify(s).includes("acct"), "no handles in the result");
});

test("does not fire on ordinary replies, too few accounts read, or a slow trickle", () => {
  assert.equal(swarmSign(...Object.values(thread(20, 2))), null, "mostly established accounts");
  assert.equal(swarmSign(...Object.values(thread(SWARM_MIN_KNOWN - 1, SWARM_MIN_KNOWN - 1))), null, "too few read");
  assert.equal(swarmSign(...Object.values(thread(20, 20, SWARM_WINDOW_SEC))), null, "one reply every ten minutes");
  const { rows } = thread(20, 20);
  assert.equal(swarmSign(rows, () => null), null, "unread accounts are unknown, not marked");
});

test("the same thread gives the same result whatever the accounts are called and in any order", () => {
  const a = thread(14, 9), b = thread(14, 9, 30, (i) => `Zz_${(i * 7919) % 1000}_name`);
  const sa = swarmSign(a.rows, a.markOf), sb = swarmSign([...b.rows].reverse(), b.markOf);
  assert.deepEqual(sa, sb);
});

test("the organic rate on PHEME is committed and under 1% for threads under 100 replies", () => {
  const r = JSON.parse(readFileSync(new URL("../project-docs/evidence/technique-baselines.json", import.meta.url), "utf8"));
  assert.deepEqual(TECHNIQUE_BASELINES.swarm, r.swarm);
  for (const b of SIZE_BINS.filter((x) => x.max < 100)) assert.ok(r.swarm[b.id].share < 0.01, b.id);
  assert.match(baselineLine("swarm", { replies: 30 }), /^In ordinary threads with 20 to 49 replies, many new or flagged accounts replying within ten minutes showed up in/);
  assert.match(SWARM_DOES_NOT_PROVE, /how the replies arrived/);
});
