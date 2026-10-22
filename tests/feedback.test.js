// "This was wrong" / "This was right" feedback: what is stored, how the per-user calibration is
// counted, and what the export holds. Pure functions over the stored object (src/core/feedback.js).
import test from "node:test";
import assert from "node:assert/strict";
import {
  FEEDBACK_KEY, CALIBRATION_MIN, MAX_ENTRIES, TEXT_MAX, signId, makeEntry, addFeedback, removeFeedback,
  verdictOf, calibration, calibrationLine, calibrationAll, buildExport,
} from "../src/core/feedback.js";

const sign = { fam: "slur", label: "slur or coded hate term" };
const at = Date.UTC(2026, 9, 21, 12);
const entry = (over = {}) => makeEntry({ sign, postId: "123", threadKey: "x:999", verdict: "wrong", at, ...over });

test("the key is a Daylight Commons data key, so Clear all deletes it", () => {
  assert.ok(FEEDBACK_KEY.startsWith("pb.") && FEEDBACK_KEY !== "pb.settings");
});

test("a sign id is stable for the same sign on the same post and differs across posts and signs", () => {
  assert.equal(signId(sign, "123"), signId({ ...sign }, "123"));
  assert.notEqual(signId(sign, "123"), signId(sign, "124"));
  assert.notEqual(signId(sign, "123"), signId({ fam: "slur", label: "other label" }, "123"));
  assert.ok(signId(sign, "123").startsWith("slur:"));
});

test("an entry holds the sign id, the family, the thread key and the verdict, and no text by default", () => {
  const e = entry({ text: "the post text" });
  assert.deepEqual(Object.keys(e).sort(), ["at", "family", "id", "threadKey", "verdict"]);
  assert.equal(e.family, "slur");
  assert.equal(e.threadKey, "x:999");
  assert.equal(e.verdict, "wrong");
  assert.ok(!JSON.stringify(e).includes("the post text"));
});

test("the text is kept only when the user ticks include the text, and is cut to TEXT_MAX", () => {
  const e = entry({ text: "the post text", includeText: true });
  assert.equal(e.text, "the post text");
  const long = entry({ text: "a".repeat(TEXT_MAX + 50), includeText: true });
  assert.equal(long.text.length, TEXT_MAX);
  assert.equal(entry({ includeText: true }).text, undefined, "no text to include, no text field");
});

test("a verdict other than right or wrong, or a sign without a family, makes no entry", () => {
  assert.equal(entry({ verdict: "maybe" }), null);
  assert.equal(makeEntry({ sign: { label: "x" }, postId: "1", threadKey: "k", verdict: "right", at }), null);
});

test("marking the same sign again replaces the earlier mark", () => {
  let s = addFeedback({}, entry());
  s = addFeedback(s, entry({ verdict: "right", at: at + 1 }));
  assert.equal(Object.keys(s.entries).length, 1);
  assert.equal(verdictOf(s, signId(sign, "123")), "right");
});

test("adding never changes the stored object it was given", () => {
  const before = addFeedback({}, entry());
  const copy = JSON.stringify(before);
  addFeedback(before, entry({ postId: "9" }));
  assert.equal(JSON.stringify(before), copy);
});

test("undo removes one mark", () => {
  const s = removeFeedback(addFeedback({}, entry()), signId(sign, "123"));
  assert.equal(verdictOf(s, signId(sign, "123")), null);
});

test("the store keeps at most MAX_ENTRIES marks, dropping the oldest", () => {
  let s = {};
  for (let i = 0; i < MAX_ENTRIES + 3; i++) s = addFeedback(s, entry({ postId: String(i), at: at + i }));
  assert.equal(Object.keys(s.entries).length, MAX_ENTRIES);
  assert.equal(verdictOf(s, signId(sign, "0")), null);
  assert.equal(verdictOf(s, signId(sign, String(MAX_ENTRIES + 2))), "wrong");
});

function marks(family, right, wrong) {
  let s = {};
  for (let i = 0; i < right + wrong; i++) s = addFeedback(s, makeEntry({ sign: { fam: family, label: family }, postId: family + i, threadKey: "x:1", verdict: i < right ? "right" : "wrong", at: at + i }));
  return s;
}

test("calibration needs CALIBRATION_MIN marks on a family before it shows", () => {
  assert.equal(calibration(marks("slur", 3, CALIBRATION_MIN - 4), "slur"), null);
  const c = calibration(marks("slur", 7, CALIBRATION_MIN - 7), "slur");
  assert.deepEqual(c, { right: 7, total: CALIBRATION_MIN });
});

test("calibration counts only the asked family", () => {
  const s = { entries: { ...marks("slur", 10, 2).entries, ...marks("violence", 1, 0).entries } };
  assert.deepEqual(calibration(s, "slur"), { right: 10, total: 12 });
  assert.equal(calibration(s, "violence"), null);
  assert.deepEqual(Object.keys(calibrationAll(s)), ["slur"]);
});

test("the calibration line reads 'Your feedback: N of M right'", () => {
  assert.equal(calibrationLine(marks("slur", 9, 3), "slur"), "Your feedback: 9 of 12 right");
  assert.equal(calibrationLine(marks("slur", 1, 1), "slur"), null);
  assert.equal(calibrationLine({}, "slur"), null);
  assert.equal(calibrationLine(undefined, "slur"), null);
});

test("the export lists every mark, a per-family count and what it leaves out, with no text unless ticked", () => {
  let s = addFeedback({}, entry());
  s = addFeedback(s, entry({ postId: "2", verdict: "right", text: "kept text", includeText: true }));
  s = addFeedback(s, entry({ postId: "3", text: "dropped text" }));
  const x = buildExport(s, { version: "2.0.0", now: at });
  assert.equal(x.format, "radar-feedback/1");
  assert.equal(x.radarVersion, "2.0.0");
  assert.equal(x.exported, "2026-10-21T12:00:00.000Z");
  assert.equal(x.entries.length, 3);
  assert.deepEqual(x.byFamily.slur, { right: 1, wrong: 2 });
  const json = JSON.stringify(x);
  assert.ok(json.includes("kept text"));
  assert.ok(!json.includes("dropped text"));
  assert.match(x.about, /not sent/);
});
