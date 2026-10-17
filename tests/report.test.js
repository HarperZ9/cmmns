import test from "node:test";
import assert from "node:assert/strict";
import { threadReport, wilson, MIN_EXTREME } from "../src/core/report.js";

const flagged = [{ id: "new-account", evidence: "2 days old" }];
const clean = [];
const reply = (i, text, flags) => ({ id: String(i), author: "u" + i, text, flags });
const EXTREME = "these people are vermin and they should all be shot";
const CALM = "I think the march was mostly peaceful from what I saw";

test("Wilson interval brackets the share and stays in [0, 1]", () => {
  const [lo, hi] = wilson(19, 50);
  assert.ok(lo < 0.38 && hi > 0.38 && lo >= 0 && hi <= 1);
  assert.deepEqual(wilson(0, 0), [0, 0]);
});

test("extreme replies mostly from flagged accounts reads as skewed", () => {
  const rows = [];
  for (let i = 0; i < 16; i++) rows.push(reply(i, "immigrants are " + EXTREME, i < 13 ? flagged : clean));
  for (let i = 16; i < 216; i++) rows.push(reply(i, CALM, i < 26 ? flagged : clean));
  const r = threadReport(rows);
  assert.equal(r.extreme.n, 16);
  assert.equal(r.extreme.flagged, 13);
  assert.equal(r.others.flagged, 10);
  assert.equal(r.verdict, "skewed-to-flagged");
  assert.match(r.sentence, /13 of 16 extreme replies \(81%\)/);
});

test("too few extreme replies gives no comparison", () => {
  const rows = [reply(0, "billionaires are " + EXTREME, flagged)];
  for (let i = 1; i < 50; i++) rows.push(reply(i, CALM, clean));
  const r = threadReport(rows);
  assert.ok(r.extreme.n < MIN_EXTREME);
  assert.equal(r.verdict, "too-few");
});

test("accounts not looked up are left out and counted", () => {
  const rows = [reply(0, CALM, null), reply(1, CALM, clean)];
  const r = threadReport(rows);
  assert.equal(r.notLookedUp, 1);
  assert.equal(r.lookedUp, 1);
  assert.match(r.sentence, /1 reply is left out/);
});

test("equal flagged shares read as no clear difference", () => {
  const rows = [];
  for (let i = 0; i < 20; i++) rows.push(reply(i, "the rich are " + EXTREME, i < 4 ? flagged : clean));
  for (let i = 20; i < 120; i++) rows.push(reply(i, CALM, i < 40 ? flagged : clean));
  assert.equal(threadReport(rows).verdict, "no-clear-difference");
});
