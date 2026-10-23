// Dehumanising similes, from misses in the 2026-10-23 feed test (82 X posts, a development set).
// The sentences paraphrase the structure of the missed posts; no post is copied. Near misses must
// not fire: quoting to criticise, reporting on hate, counter-speech, and the same words aimed at
// nothing human. Every group gets the same treatment (tests/rhetoric.symmetry.test.js).
import test from "node:test";
import assert from "node:assert/strict";
import { score } from "../src/core/rhetoric.js";

const families = (t) => score(t).markers.map((m) => m.family).sort().join(",");
const TARGETS = ["immigrants", "muslims", "jews", "christians", "blacks", "whites", "leftists", "conservatives",
  "communists", "republicans", "democrats", "billionaires", "police", "men", "women", "trans people"];

test("a group likened to vermin or disease through a verb of spreading, for every group", () => {
  for (const tpl of ["{G} are spreading like a plague across the west", "{G} keep multiplying like rats in every city",
    "{G} are just infesting the suburbs like cockroaches"]) {
    const differing = TARGETS.map((g) => [g, families(tpl.replace("{G}", g))]).filter(([, f]) => f !== "dehumanise");
    assert.deepEqual(differing, [], tpl);
  }
});

test("a target named only as they or these people", () => {
  assert.equal(families("look at their numbers, they are infecting every nation like parasites"), "dehumanise");
  assert.equal(families("these people breed like rats and nobody does anything"), "dehumanise");
  assert.equal(families("they're swarming the coast like locusts"), "dehumanise");
});

test("near misses: quoting to criticise, reporting, counter-speech", () => {
  assert.equal(families('He wrote that they are "infecting every country like parasites", which is vile'), "");
  assert.equal(families("The study collected posts saying refugees are spreading like a plague"), "");
  assert.equal(families("Saying migrants spread like a disease is dehumanising and wrong"), "");
  assert.equal(families("Nobody should say that they are breeding like rats"), "");
  assert.equal(families("communists are not spreading like a plague, calm down"), "");
});

test("near misses: the same words aimed at nothing human", () => {
  assert.equal(families("the mould is spreading like a cancer through the walls"), "");
  assert.equal(families("rumours spread like a virus online"), "");
  assert.equal(families("the weeds, they are spreading like a plague this year"), "");
  assert.equal(families("these ideas spread like wildfire"), "");
});
