// Learn core: the lesson path, the pages the worker will open, the first-week tour rules and the
// self-check's discernment score.
import test from "node:test";
import assert from "node:assert/strict";
import { lessonPath, safePage, nextTip, markShown, stopTips, normalizeTour, TIPS, TOUR_DAYS, TOUR_GAP_MS,
  recordAnswer, normalizeLearn, discernment } from "../src/core/learn.js";

const H = 3600000, D = 86400000;

test("lesson paths are learn.html#<id>, and odd ids give none", () => {
  assert.equal(lessonPath("loaded-language"), "learn.html#loaded-language");
  for (const bad of [null, "", "A", "x", "../options", "a b", "javascript:alert(1)"]) assert.equal(lessonPath(bad), null, String(bad));
});

test("the worker opens only Daylight Commons' lesson and self-check pages", () => {
  assert.equal(safePage("learn.html#same-upload"), "learn.html#same-upload");
  assert.equal(safePage("quiz.html"), "quiz.html");
  assert.equal(safePage("learn.html#"), "learn.html");
  for (const bad of ["options.html", "https://example.com", "learn.html#a#b", "learn.html#<b>", "//evil", "learn.html?x=1", 7]) assert.equal(safePage(bad), null, String(bad));
});

test("the tour shows its three tips in order, one surface at a time, at most one an hour", () => {
  let s = {}, t = 0;
  assert.equal(nextTip(s, "panel", t), null, "the first tip is in the window");
  const first = nextTip(s, "window", t);
  assert.equal(first.id, "hover");
  s = markShown(s, first.id, t);
  assert.equal(nextTip(s, "panel", t + 10 * 60000), null, "not within the hour");
  t += TOUR_GAP_MS;
  assert.equal(nextTip(s, "panel", t).id, "report");
  s = markShown(s, "report", t);
  t += TOUR_GAP_MS;
  assert.equal(nextTip(s, "window", t, { hasSignal: false }), null, "the lesson tip waits for a sign");
  assert.equal(nextTip(s, "window", t, { hasSignal: true }).id, "lesson");
  s = markShown(s, "lesson", t);
  assert.equal(nextTip(s, "window", t + D, { hasSignal: true }), null, "three tips, then none");
  assert.equal(TIPS.length, 3);
});

test("a shown tip is done, the tour ends after a week, and No more tips is forever", () => {
  const s = markShown({}, "hover", 0);
  assert.deepEqual(s.shown, ["hover"]);
  assert.equal(nextTip(s, "panel", TOUR_DAYS * D + H), null, "past the first week");
  const off = stopTips(s);
  assert.equal(off.off, true);
  assert.equal(nextTip(off, "panel", 2 * H), null);
  assert.equal(normalizeTour(off).off, true, "kept through a reload");
  assert.equal(nextTip(stopTips({}), "window", 0), null, "No more tips before any tip shows");
});

test("tour state from storage is cleaned", () => {
  assert.deepEqual(normalizeTour({ shown: ["hover", "hover", "nope"], start: "x", off: "yes" }), { off: false, start: null, lastAt: null, shown: ["hover"] });
  assert.deepEqual(normalizeTour(null).shown, []);
});

test("self-check answers keep the latest answer per question, and drop bad rows", () => {
  let s = recordAnswer({}, "q-one", true, 5);
  s = recordAnswer(s, "q-one", false, 6);
  assert.deepEqual(s.answers["q-one"], { at: 6, said: false });
  assert.deepEqual(normalizeLearn({ answers: { "q-x": { said: "y", at: 1 }, "<b>": { said: true, at: 1 } } }).answers, {});
});

const items = [1, 2, 3, 4].flatMap((i) => [{ id: `q-s${i}`, leans: true }, { id: `q-n${i}`, leans: false }]);
const answer = (f) => ({ answers: Object.fromEntries(items.map((it) => [it.id, { at: 1, said: f(it) }])) });

test("discernment: calling every post leaning catches every fake and scores zero", () => {
  const d = discernment(items, answer(() => true));
  assert.equal(d.hits, 4); assert.equal(d.falseAlarms, 4);
  assert.equal(d.difference, 0);
  assert.ok(Math.abs(d.dPrime) < 1e-9, "d' is 0");
  assert.ok(d.bias < 0, "and the bias shows the lean toward leaning");
});

test("discernment: telling the two apart scores high, and the reverse scores below zero", () => {
  const good = discernment(items, answer((it) => it.leans)), bad = discernment(items, answer((it) => !it.leans));
  assert.equal(good.difference, 1);
  assert.ok(good.dPrime > 1.5, `d' ${good.dPrime}`);
  assert.ok(Math.abs(good.bias) < 1e-9);
  assert.ok(bad.dPrime < -1.5);
});

test("discernment waits for one answer of each kind", () => {
  assert.equal(discernment(items, { answers: { "q-s1": { at: 1, said: true } } }), null);
  assert.equal(discernment(items, {}), null);
});
