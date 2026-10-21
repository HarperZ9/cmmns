// Precision and recall fixes found on the dev split of the labelled corpora (2026-10-21,
// project-docs/EVALUATION.md). The sentences are constructed with the structure of the errors;
// corpus text is not copied here. Every case keeps the symmetry rule.
import test from "node:test";
import assert from "node:assert/strict";
import { score } from "../src/core/rhetoric.js";

const families = (t) => score(t).markers.map((m) => m.family).sort().join(",");
const TARGETS = ["immigrants", "muslims", "jews", "christians", "blacks", "whites", "white people", "men", "women",
  "leftists", "conservatives", "republicans", "democrats", "communists", "billionaires", "police", "evangelicals",
  "gay people", "straight people", "trans people"];
const same = (tpl, expected) => {
  const differing = TARGETS.map((g) => [g, families(tpl.replace("{G}", g))]).filter(([, f]) => f !== expected);
  assert.deepEqual(differing, [], tpl);
};

test("reported speech is not the speaker's marker, for every target", () => {
  same("he called {G} vermin on live television", "");
  same("the senator compared {G} to cockroaches in a speech", "");
  same("the article describes {G} as animals and that is disgusting", "");
  same("{G} are vermin", "dehumanise");
});

test("a quoted slur is a mention, an unquoted one is a use", () => {
  assert.equal(families('he was fired for saying "faggot" on air'), "");
  assert.equal(families("what a faggot"), "slur");
  assert.equal(families('the word "kike" is in the dictionary'), "");
  assert.equal(families("dumb kike"), "slur");
});

test("the echo marks need a name inside them; smileys are not slurs", () => {
  assert.equal(families("thanks so much :)))"), "");
  assert.equal(families("ok ((( hugs"), "");
  assert.equal(families("of course it was (((them)))"), "slur");
  assert.equal(families("the (((globalists))) again"), "slur");
});

test("marker words near a group but not about it are not dehumanising", () => {
  for (const t of [
    "women with cancer face long waits for care",
    "white people love their dogs",
    "he rats her out to the police",
    "the police dogs found the bag",
    "refugees who rescue abandoned animals",
    "men can carry the virus without symptoms",
  ]) assert.equal(families(t), "", t);
});

test("dehumanising grammar still registers for every target", () => {
  same("{G} are nothing but vile rats", "dehumanise");
  same("{G} are literally a disease", "dehumanise");
  same("an infestation of {G} in this city", "dehumanise");
  same("those {G} scum again", "dehumanise");
  same("{G} are horrible, cruel, useless rats", "dehumanise");
  same("{G} - savages, all of them", "dehumanise");
  same("vermin like these {G}", "dehumanise");
  same("{G} are losing money to rats in the barn", "");
});

test("genocide and death wishes are violence markers for every target", () => {
  same("we should genocide the {G}", "violence");
  same("{G} deserve to die", "violence");
  same("{G} should all die", "violence");
  same("I hope {G} never die young", "");
});

test("intensified stereotypes register for every target", () => {
  same("{G} are fucking stupid", "stereotype");
  same("{G} are so disgusting", "stereotype");
  same("{G} are inherently violent", "stereotype");
  same("{G} are not stupid", "");
});

test("declared hatred of a whole group is a weak marker for every target", () => {
  same("I fucking hate {G}", "contempt");
  same("fuck all the {G}", "contempt");
  same("{G} are the worst people on earth", "contempt");
  same("I don't hate {G}", "");
  same("I hate what {G} said about the budget", "");
  assert.equal(score("I hate whites").extreme, false);
  assert.equal(score("I hate muslims").extreme, false);
});

test("torture and murder wishes are violence markers for every target", () => {
  same("{G} should be tortured", "violence");
  same("we need to murder the {G}", "violence");
});

test("a slogan needs to stand as a slogan", () => {
  assert.equal(families("death to the tyrants"), "violence");
  assert.equal(families("they beat the dog to death to make a point"), "");
  assert.equal(families("he loves helicopter rides for publicity shots"), "");
  assert.equal(families("free helicopter rides for the commies"), "violence");
});

test("slurs whose dev-split precision was low count as context-dependent, in both directions", () => {
  assert.equal(families("dumb honky"), "slurSoft");
  assert.equal(families("dindu nuffin"), "slurSoft");
});
