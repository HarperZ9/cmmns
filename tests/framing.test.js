// Episodic and thematic framing (src/core/framing.js): person-story and structural cues, the hold
// while no licensed labelled corpus exists, and the feed balance that stays held with it.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { framingOf, feedFrame, framingShown, framingStatus, MEASURED_FRAMING, FRAMING_MIN_WORDS, FRAMING_DOES_NOT_PROVE } from "../src/core/framing.js";
import { addFeedPosts, feedDashboard } from "../src/core/feed.js";
import { FAMILIES, measuredLine } from "../src/core/families.js";

const NOW = Date.parse("2026-10-20T12:00:00Z");

test("a post told only through one person's case reads as a person-story", () => {
  for (const t of [
    "A 34-year-old nurse lost her job on Monday after she spoke up about the night shifts at the ward.",
    "My neighbour was evicted last week and now she sleeps in her car with two kids and a dog outside town.",
    "Meet Dana, who waited eleven hours in the emergency room before anyone looked at her broken arm.",
  ]) assert.equal(framingOf(t).frame, "person-story", t);
});

test("a post that gives numbers, trends or policy reads as structural", () => {
  for (const t of [
    "Evictions rose 14% since 2023 across the state, and court data show most cases follow a rent rise.",
    "The funding formula has not changed in a decade, so rural hospitals close at a rate of four a year.",
  ]) assert.equal(framingOf(t).frame, "structural", t);
});

test("both kinds of cue read as mixed; neither, or a short post, reads as nothing", () => {
  assert.equal(framingOf("A 71-year-old tenant was evicted this week; evictions rose 14% since 2023 across the county.").frame, "mixed");
  assert.equal(framingOf("I think the council got this one wrong and I will say so at the meeting on Thursday night.").frame, null);
  assert.equal(framingOf("A 34-year-old nurse lost her job.").frame, null, "under the minimum length");
  assert.ok(framingOf("A 34-year-old nurse lost her job.").words < FRAMING_MIN_WORDS);
});

test("the feed keeps none for long posts with no cue and nothing for short ones", () => {
  assert.equal(feedFrame("I think the council got this one wrong and I will say so at the meeting on Thursday night."), "none");
  assert.equal(feedFrame("so true"), null);
});

test("the person-story sign is held back while no licensed labelled corpus exists", () => {
  assert.equal(MEASURED_FRAMING, null);
  assert.equal(framingShown(), false);
  assert.match(framingStatus().text, /^held back: not measured/);
  assert.equal(framingShown({ precision: 0.8, low: 0.69, high: 0.9, n: 50, split: "test" }), false, "lower bound under 0.7");
  assert.equal(framingShown({ precision: 0.9, low: 0.75, high: 0.95, n: 19, split: "test" }), false, "fewer than 20");
  assert.equal(framingShown({ precision: 0.9, low: 0.75, high: 0.95, n: 40, split: "test" }), true);
  assert.equal(measuredLine("person-story").text, "not measured yet");
  assert.ok(FAMILIES.some((f) => f.id === "person-story"));
  assert.match(FRAMING_DOES_NOT_PROVE, /can be true/);
});

test("the feed balance stays held with no counts, and shows shares with intervals once measured", () => {
  const posts = [["1", "person-story"], ["2", "person-story"], ["3", "structural"], ["4", "none"], ["5", null]].map(([id, frame]) => ({ id, domains: [], techniques: [], frame }));
  const log = addFeedPosts({}, "X", posts, NOW);
  const held = feedDashboard({}, log, {}, { now: NOW }).framing;
  assert.equal(held.shown, false);
  assert.equal(held.personStory, undefined, "no count while held");
  const row = { precision: 0.9, low: 0.75, high: 0.95, n: 40, split: "test" };
  const f = feedDashboard({}, log, {}, { now: NOW, framingRow: row }).framing;
  assert.equal(f.shown, true);
  assert.equal(f.read, 4, "short posts are left out of the denominator");
  assert.deepEqual([f.personStory.k, f.personStory.n, f.structural.k], [2, 4, 1]);
  assert.ok(f.personStory.ci[0] < 0.5 && f.personStory.ci[1] > 0.5);
});

test("the organic rates on PHEME are committed with source and licence", () => {
  const r = JSON.parse(readFileSync(new URL("../project-docs/evidence/framing-results.json", import.meta.url), "utf8"));
  assert.equal(r.source.licence, "CC BY 4.0");
  assert.match(r.source.sha256, /^[0-9a-f]{64}$/);
  assert.ok(r.replies.longEnough > 50000);
  assert.ok(r.replies.personStory.share < 0.05 && r.replies.structural.share < 0.05);
});
