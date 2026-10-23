// The antisemitic "noticing" code, from misses in the 2026-10-23 feed test (a development set).
// Sources: project-docs/evidence/LEXICON-SOURCES.md, "English coded terms added from the 2026-10-23
// feed test". The sentences paraphrase the missed posts; none is copied. Near misses must not fire.
import test from "node:test";
import assert from "node:assert/strict";
import { score } from "../src/core/rhetoric.js";

const families = (t) => score(t).markers.map((m) => m.family).sort().join(",");

test("the noticing code beside a mocking cue is a coded term", () => {
  assert.equal(families("Oy vey, quit noticing!"), "slur");
  assert.equal(families("the goys keep noticing, and that scares them"), "slur");
  assert.equal(families("stop noticing things, goyim"), "slur");
  assert.equal(families("#TheNoticing is only getting louder"), "slur");
  assert.equal(families("the noticing will continue"), "slur");
});

test("near misses: quoting to criticise, reporting, counter-speech", () => {
  assert.equal(families('He replied "oy vey, stop noticing" under the photo, which is antisemitic'), "");
  assert.equal(families("Researchers track replies like oy vey stop noticing as coded hate"), "");
  assert.equal(families("Telling people oy vey stop noticing is just antisemitism with a smirk"), "");
});

test("near misses: the same words aimed at no group", () => {
  assert.equal(families("I can't stop noticing typos in this book"), "");
  assert.equal(families("Oy vey, did you notice the rain?"), "");
  assert.equal(families("oy vei, I noticed the leak too late"), "");
  assert.equal(families("Oy vey, I forgot my keys again"), "");
  assert.equal(families("people keep noticing the new mural downtown"), "");
});
