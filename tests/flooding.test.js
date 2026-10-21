// The flooding sign (src/core/flooding.js): a thread where several very high-rate accounts carry a
// large share of the replies, or a timing burst made of them. It describes posting behaviour in
// one thread, never who runs any account.
import test from "node:test";
import assert from "node:assert/strict";
import { floodSign, ratePerDay, FLOOD_MIN_ACCOUNTS, FLOOD_SHARE, MIN_KNOWN, FLOOD_DOES_NOT_PROVE } from "../src/core/flooding.js";
import { HIGH_VOLUME_PER_DAY } from "../src/core/flags.js";

const T0 = Date.parse("2026-10-01T12:00:00Z");
const at = (s) => new Date(T0 + s * 1000).toISOString();
// n replies, one per minute, from distinct accounts; `hot` of them post `rate` a day.
function thread(n, hot, rate = 400) {
  const rows = [], rates = {};
  for (let i = 0; i < n; i++) { const a = `acct${i}`; rows.push({ author: a, posted: at(i * 60) }); rates[a] = i < hot ? rate : 5; }
  return { rows, rateOf: (h) => rates[h] ?? null };
}

test("rate per day is posts since joining over the account's age", () => {
  assert.equal(ratePerDay({ postsCount: 3000, joinDate: "2026-09-01T12:00:00Z" }, T0), 100);
  assert.equal(ratePerDay({ postsCount: 10, joinDate: "2026-10-01T11:00:00Z" }, T0), 10, "under a day counts as one day");
  assert.equal(ratePerDay({ postsCount: null, joinDate: "2026-09-01" }, T0), null);
  assert.equal(ratePerDay({ postsCount: 5 }, T0), null);
});

test("fires when enough high-rate accounts carry enough of the thread", () => {
  const need = Math.ceil(20 * FLOOD_SHARE);
  const { rows, rateOf } = thread(20, Math.max(FLOOD_MIN_ACCOUNTS, need));
  const f = floodSign(rows, rateOf);
  assert.ok(f, "fires");
  assert.equal(f.volume.accounts.length, Math.max(FLOOD_MIN_ACCOUNTS, need));
  assert.ok(f.volume.share >= FLOOD_SHARE);
  assert.equal(f.volume.known, 20);
  assert.equal(f.threshold, HIGH_VOLUME_PER_DAY);
});

test("does not fire on a thread of ordinary accounts, too few high-rate accounts, or too little known", () => {
  assert.equal(floodSign(thread(20, 0).rows, thread(20, 0).rateOf), null);
  const two = thread(6, FLOOD_MIN_ACCOUNTS - 1);
  assert.equal(floodSign(two.rows, two.rateOf), null, "two accounts are not a flood even at a third of the thread");
  const few = thread(MIN_KNOWN - 1, MIN_KNOWN - 1);
  assert.equal(floodSign(few.rows, few.rateOf), null, "too few known rates to judge a share");
  const big = thread(100, FLOOD_MIN_ACCOUNTS);
  assert.equal(floodSign(big.rows, big.rateOf), null, "three in a hundred is under the share");
});

test("a burst made of high-rate accounts fires even under the share", () => {
  const { rows, rateOf } = thread(100, 2);
  const burst = { from: at(0), to: at(10), authors: ["acct0", "acct1", "acct50"], p: 1e-5 };
  const f = floodSign(rows, rateOf, { bursts: [burst] });
  assert.ok(f && f.speed, "fires through the burst");
  assert.equal(f.speed.highRate, 2);
  assert.equal(floodSign(rows, rateOf, { bursts: [{ ...burst, authors: ["acct50", "acct51", "acct52"] }] }), null);
});

test("symmetry: account names and order do not change the answer", () => {
  const a = thread(20, 6), b = thread(20, 6);
  const rename = (h) => h.replace("acct", "z_");
  const rows = [...b.rows].reverse().map((r) => ({ ...r, author: rename(r.author) }));
  const fb = floodSign(rows, (h) => b.rateOf(h.replace("z_", "acct")));
  const fa = floodSign(a.rows, a.rateOf);
  assert.equal(fa.volume.share, fb.volume.share);
  assert.equal(fa.volume.accounts.length, fb.volume.accounts.length);
  assert.match(FLOOD_DOES_NOT_PROVE, /news|alert/i);
});

test("repeat posters are context only and never fire the sign", () => {
  const rows = Array.from({ length: 30 }, (_, i) => ({ author: i % 2 ? "a" : "b", posted: at(i * 30) }));
  const f = floodSign(rows, () => 5);
  assert.equal(f, null);
});
