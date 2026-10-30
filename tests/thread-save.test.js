// Save the thread (src/core/thread-save.js): one Markdown note or JSON Lines, each reply with its
// time and badges, and nothing per reply that would turn the thread comparison into a label.
import test from "node:test";
import assert from "node:assert/strict";
import { threadRecords, threadJsonl, threadMarkdown, THREAD_SAVE_FORMAT } from "../src/core/thread-save.js";
import { DOES_NOT_PROVE } from "../src/core/flags.js";

const at = (s) => new Date(Date.UTC(2026, 9, 29, 14, 0, 0) + s * 1000).toISOString();
const input = () => ({
  site: "X", page: "https://x.com/a/status/1", savedAt: at(9999), tool: "CMMNS test",
  root: { id: "1", author: "a", text: "The post", posted: at(0) },
  replies: [
    { id: "2", author: "b", display: "B", text: "first\nsecond line", posted: at(10), domains: ["example.org"] },
    { id: "3", author: "c", text: "same words", posted: at(20) },
    { id: "4", author: "d", text: "same words", posted: at(21) },
    { id: "5", author: "e", text: "no time" },
  ],
  rows: [{ id: "3", flags: [{ id: "new-account", evidence: "joined 3 days ago" }], extreme: 0.9, markers: ["x"] }, { id: "2", flags: [] }],
  clusters: [{ ids: ["3", "4"], authors: ["c", "d"] }],
  bursts: [{ from: at(19), to: at(22), authors: ["c", "d", "z"], p: 0.0001 }],
});

test("JSONL: the thread first, then the post, then one line per reply, each valid JSON", () => {
  const lines = threadJsonl(input()).trimEnd().split("\n").map((l) => JSON.parse(l));
  assert.deepEqual(lines.map((l) => l.type), ["thread", "post", "reply", "reply", "reply", "reply"]);
  assert.equal(lines[0].format, THREAD_SAVE_FORMAT);
  assert.equal(lines[0].replies, 4);
  assert.equal(lines[0].bursts[0].accounts, 3);
  assert.ok(lines[0].doesNotProve.length >= 1);
});

test("each reply keeps its time, its badges with what they do not prove, and its groups", () => {
  const { replies } = threadRecords(input());
  const c = replies.find((r) => r.id === "3"), b = replies.find((r) => r.id === "2"), e = replies.find((r) => r.id === "5");
  assert.equal(c.posted, at(20));
  assert.deepEqual(c.badges, [{ id: "new-account", evidence: "joined 3 days ago", doesNotProve: DOES_NOT_PROVE["new-account"] || null }]);
  assert.equal(c.sameTextGroup, 1);
  assert.equal(c.burst, 1);
  assert.equal(b.burst, null, "outside the burst's span");
  assert.deepEqual(b.domains, ["example.org"]);
  assert.equal(e.posted, null);
  assert.deepEqual(e.badges, []);
});

test("stance-neutral: no extremity score or rhetoric markers per reply", () => {
  const text = threadJsonl(input()) + threadMarkdown(input());
  assert.doesNotMatch(text, /extreme|markers|rhetoric/i);
});

test("the note reads top-down: the page, the post, each reply quoted with its badges, the limits", () => {
  const md = threadMarkdown(input());
  assert.match(md, /^# Thread on X/);
  assert.match(md, /- Page: https:\/\/x\.com\/a\/status\/1/);
  assert.match(md, /- Burst 1: 3 accounts/);
  assert.match(md, /### @b \(B\) · 2026-10-29 14:00:10 UTC/);
  assert.match(md, /> first\n> second line/);
  assert.match(md, /- new-account: joined 3 days ago/);
  assert.match(md, /In: same-text group 1, burst 1/);
  assert.match(md, /### @e · no time shown/);
  assert.ok(md.indexOf("## What this does not prove") > md.indexOf("## Replies"));
});

test("a thread with no post replied to and no timed replies still saves", () => {
  const rec = threadRecords({ site: "YouTube", page: "p", replies: [{ id: "a", author: "u", text: "t" }] });
  assert.equal(rec.root, null);
  assert.equal(rec.head.timeline, null);
  assert.equal(threadJsonl({ replies: [] }).trimEnd().split("\n").length, 1);
});
