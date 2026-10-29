// The reply timeline strip (src/core/reply-timeline.js): counts per stretch of time, bursts marked
// where the timing test found them, never finer than the times behind it, and one sentence that says
// what the strip shows.
import test from "node:test";
import assert from "node:assert/strict";
import { replyTimeline, timelineSentence, spanWords, TIMELINE_BINS } from "../src/core/reply-timeline.js";
import { timingBursts } from "../src/core/timing.js";

const at = (s) => new Date(Date.UTC(2026, 9, 29, 14, 0, 0) + s * 1000).toISOString();
// Second-precise times: no two share a second of the minute often enough to look rounded.
const spread = (n, step, start = 0) => Array.from({ length: n }, (_, i) => ({ author: `a${start + i}`, posted: at(start * 7 + i * step + (i % 7)) }));

test("fewer than two timed replies give no strip", () => {
  assert.equal(replyTimeline([]), null);
  assert.equal(replyTimeline([{ author: "a", posted: at(0) }, { author: "b", posted: null }]), null);
});

test("every timed reply lands in exactly one bar, and untimed ones are counted apart", () => {
  const rows = [...spread(30, 61), { author: "x", posted: "not a time" }];
  const t = replyTimeline(rows);
  assert.equal(t.bins.reduce((s, b) => s + b.n, 0), 30);
  assert.equal(t.timed, 30);
  assert.equal(t.untimed, 1);
  assert.ok(t.bins.length <= TIMELINE_BINS);
  assert.equal(t.peak, Math.max(...t.bins.map((b) => b.n)));
});

test("a burst the timing test finds is marked on the bars it covers, and only there", () => {
  // A slow thread (one reply every 90 s) with six accounts inside ten seconds in the middle.
  const slow = Array.from({ length: 40 }, (_, i) => ({ author: `s${i}`, posted: at(i * 90 + (i % 7)) }));
  const rush = Array.from({ length: 6 }, (_, i) => ({ author: `r${i}`, posted: at(1800 + i * 2 + (i % 2)) }));
  const rows = [...slow, ...rush];
  const bursts = timingBursts(rows, { precision: "second" });
  assert.ok(bursts.length >= 1, "the rush is a burst");
  const t = replyTimeline(rows, bursts);
  const marked = t.bins.filter((b) => b.burst);
  assert.ok(marked.length >= 1 && marked.length <= 2, `${marked.length} bars marked`);
  for (const b of marked) assert.ok(Date.parse(b.to) >= Date.parse(bursts[0].from) && Date.parse(b.from) <= Date.parse(bursts[0].to));
  assert.equal(t.bursts, bursts.length);
  // The marked bar holds the rush, so it is the busiest.
  assert.equal(Math.max(...marked.map((b) => b.n)), t.peak);
});

test("control: without bursts nothing is marked", () => {
  const t = replyTimeline(spread(20, 45));
  assert.equal(t.bins.filter((b) => b.burst).length, 0);
  assert.match(timelineSentence(t), /no burst marked/);
});

test("times good only to the hour are never spread across minutes", () => {
  const hourly = Array.from({ length: 12 }, (_, i) => ({ author: `h${i}`, posted: new Date(Date.UTC(2026, 9, 29, 8 + (i % 4))).toISOString() }));
  const t = replyTimeline(hourly);
  assert.equal(t.precision, "hour");
  assert.ok(t.binMs >= 3600000, `bars of ${t.binMs} ms`);
  assert.match(timelineSentence(t), /to the hour/);
});

test("the sentence names the count, the span, the bar size and the bursts", () => {
  const t = replyTimeline(spread(10, 60));
  const s = timelineSentence(t);
  assert.match(s, /^10 replies over \d+ min/);
  assert.match(s, /each bar is/);
  assert.match(s, /UTC/);
  assert.equal(timelineSentence(null), null);
  assert.equal(spanWords(40000), "40 s");
  assert.equal(spanWords(3 * 3600000 + 5 * 60000), "3 h 5 min");
  assert.equal(spanWords(3 * 86400000), "3 days");
});

test("the strip names no account", () => {
  const t = replyTimeline(spread(10, 60));
  assert.doesNotMatch(JSON.stringify(t) + timelineSentence(t), /a\d/);
});
