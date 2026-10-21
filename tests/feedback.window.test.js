// The window's feedback rows: the user's count sits under the measured line, never in its place,
// and only once a family has enough marks. Runs src/ext/feedback.js in node over a fake storage.
import test from "node:test";
import assert from "node:assert/strict";

const stored = {};
globalThis.chrome = { storage: { local: { get: async (k) => ({ [k]: stored[k] }), set: async (o) => Object.assign(stored, o), remove: async (k) => { delete stored[k]; } }, onChanged: { addListener() {} } } };
await import("../src/ext/core.bundle.js");
const { PB } = globalThis;
let seed = {};
for (let i = 0; i < 12; i++) seed = PB.addFeedback(seed, PB.makeEntry({ sign: { fam: "dehumanise", label: "x" }, postId: "p" + i, threadKey: "x:1", verdict: i < 9 ? "right" : "wrong", at: i }));
stored[PB.FEEDBACK_KEY] = seed;
await import("../src/ext/feedback.js");
await import("../src/ext/signals.js");
const { PBFeedback, PBSignals } = globalThis;
await PBFeedback.ready;

const X = { id: "x", name: "X", hasLocation: true };
const model = (text) => ({ site: X, handle: "a", postId: "777", threadKey: "x:42", text, markers: PB.score(text).markers, machine: {}, flags: [] });

test("a sign with enough marks shows the user's count after the measured figure", () => {
  const s = PBSignals.all(model("Migrants are vermin")).find((x) => x.fam === "dehumanise");
  const heads = s.rows.map(([h]) => h);
  const m = heads.indexOf("Measured"), y = heads.indexOf("Your feedback");
  assert.ok(m >= 0 && y > m, "measured first, then the user's count");
  assert.match(s.rows[y][1], /^9 of 12 right/);
  assert.match(s.rows[m][1], /precision/);
});

test("every family sign gets the controls, carrying the sign id parts and the thread key", () => {
  const sig = PBSignals.all(model("Migrants are vermin"));
  for (const s of sig.filter((x) => x.fam)) {
    const row = s.rows.find(([h]) => h === "Was this right?");
    assert.ok(row, s.label);
    assert.equal(row[1].feedback.postId, "777");
    assert.equal(row[1].feedback.threadKey, "x:42");
    assert.equal(row[1].feedback.sign.fam, s.fam);
  }
});

test("a family with too few marks shows no count", () => {
  const sig = PBSignals.all({ ...model("hello"), flags: [{ id: "new-account", evidence: "e", doesNotProve: "d" }] });
  const s = sig.find((x) => x.fam === "new-account");
  assert.ok(s && !s.rows.some(([h]) => h === "Your feedback"));
});
