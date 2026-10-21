// Persuasion techniques: span offsets, the ship gate, and the line the window shows.
import test from "node:test";
import assert from "node:assert/strict";
import { techniqueSpans, persuasion, shownTechniques, techniqueStatus, TECHNIQUES, SHIP_LOW,
  PERSUASION_DOES_NOT_PROVE } from "../src/core/persuasion.js";
import { MEASURED_PERSUASION } from "../src/core/measured.js";

const kinds = (t) => [...new Set(techniqueSpans(t).map((h) => h.technique))].sort().join(",");

test("spans index into the text, curly apostrophes included", () => {
  const t = "Honestly, it’s a smear. Everyone knows that, before it’s too late.";
  const spans = techniqueSpans(t);
  assert.ok(spans.length >= 3);
  for (const h of spans) assert.equal(t.slice(h.start, h.end).replace(/’/g, "'"), h.match.replace(/’/g, "'"));
  assert.equal(kinds(t), "appeal-to-fear,bandwagon,loaded-language");
});

test("each named technique has cues that find it", () => {
  const cases = {
    "loaded-language": "That speech was disgusting.", "name-calling": "They are a bunch of liars.",
    "bandwagon": "Everyone knows the answer.", "appeal-to-fear": "Act now, before it's too late.",
    "flag-waving": "The American people deserve better.", "thought-terminating": "It is what it is.",
    "whataboutism": "But what about the other scandal?", "black-and-white": "You're either with us or against us.",
    "doubt": "Can we really trust this report?", "appeal-to-authority": "Experts say the plan works.",
    "exaggeration": "The worst deal in history.",
  };
  assert.deepEqual(Object.keys(cases).sort(), Object.keys(TECHNIQUES).sort());
  for (const [t, text] of Object.entries(cases)) assert.ok(kinds(text).split(",").includes(t), `${t}: ${text}`);
});

test("plain disagreement and reporting find no technique", () => {
  for (const t of ["I disagree with this policy and will vote against it.", "The council met on Tuesday and approved the budget.",
    "Fraud charges were filed against the company.", "The study was published in March.", "the american people", "Je ne suis pas d'accord avec cette loi."]) {
    assert.equal(kinds(t), "", t);
  }
});

test("the ship gate needs a held-out lower bound at 0.7 from at least 20 hits", () => {
  const row = (low, n, split = "test") => ({ precision: low + 0.05, low, high: low + 0.1, n, split });
  const table = { "loaded-language": row(0.72, 40), "name-calling": row(0.69, 400), "bandwagon": row(0.9, 10), "doubt": row(0.8, 50, "dev") };
  assert.equal(SHIP_LOW, 0.7);
  assert.deepEqual(shownTechniques(table), ["loaded-language"]);
  assert.equal(techniqueStatus("loaded-language", table).shown, true);
  assert.match(techniqueStatus("name-calling", table).text, /^held back \(interval starts below 70%\)/);
  assert.match(techniqueStatus("bandwagon", table).text, /^held back \(fewer than 20 hits\)/);
  assert.equal(techniqueStatus("exaggeration", table).text, "held back: not measured");
});

test("the committed measurement decides what ships, and every shown row passes the gate", () => {
  for (const t of shownTechniques()) {
    const r = MEASURED_PERSUASION[t];
    assert.ok(r.split === "test" && r.n >= 20 && r.low >= SHIP_LOW, t);
  }
  for (const t of Object.keys(TECHNIQUES).filter((x) => !shownTechniques().includes(x))) {
    assert.equal(persuasion("smear, liars, everyone knows, before it's too late", shownTechniques()).some((e) => e.technique === t), false, t);
  }
});

test("a shown technique carries its name, definition and the matched words", () => {
  const out = persuasion("What a disgusting smear.", ["loaded-language"]);
  assert.equal(out.length, 1);
  assert.equal(out[0].name, "Loaded language");
  assert.equal(out[0].match, "disgusting");
  assert.ok(out[0].definition.length > 20);
  assert.equal(PERSUASION_DOES_NOT_PROVE, "A technique can carry a true claim; it describes how the post argues.");
  for (const x of Object.values(TECHNIQUES)) assert.ok(!/—/.test(x.definition + x.name), "no em dashes");
});
