// Recall gaps found on a live X thread (2026-10-21, replies about the riots in France):
// active calls for violence ("we should exterminate X"), a violent fate carried over to a named
// group, a variant spelling, and French replies X had not translated (26 of 44). Each case keeps
// the symmetry rule: every target gets the same markers, and policy positions stay at zero.
import test from "node:test";
import assert from "node:assert/strict";
import { score } from "../src/core/rhetoric.js";

const families = (t) => score(t).markers.map((m) => m.family).sort().join(",");

const TARGETS = ["immigrants", "muslims", "jews", "christians", "blacks", "whites", "leftists", "conservatives",
  "communists", "nationalists", "billionaires", "the rich", "police", "protesters", "journalists", "women", "men"];

const ACTIVE = [
  ["we should exterminate the {G}", "violence"],
  ["let's kill all the {G}", "violence"],
  ["time to wipe out the {G}", "violence"],
  ["we need to shoot every one of the {G}", "violence"],
  // controls: no call, or a negated one
  ["we should not kill the {G}", ""],
  ["soldiers killed {G} in that war and it was a crime", ""],
  ["we should talk to the {G} before voting", ""],
];

for (const [tpl, expected] of ACTIVE) {
  test(`active call scores alike for every target: "${tpl}"`, () => {
    const differing = TARGETS.map((g) => [g, families(tpl.replace("{G}", g))]).filter(([, f]) => f !== expected);
    assert.deepEqual(differing, []);
  });
}

test("a violent fate carried over to a named group is a violence marker", () => {
  // Constructed with the live reply's structure (other people's posts are not committed).
  const t = "Some states exterminated their dissenters and have no unrest. Maybe we should reserve the same fate " +
    "for our Africans";
  assert.equal(families(t), "violence");
  // the same words with no violence named are not a marker
  assert.equal(families("we reserved the same fate for our Africans as for everyone: a fair trial"), "");
});

test("variant spelling Moslems is a group", () => {
  assert.equal(families("Moslems are terrorists"), "stereotype");
  assert.equal(families("Muslims are terrorists"), "stereotype");
});

const CIBLES = ["immigrés", "musulmans", "juifs", "chrétiens", "noirs", "blancs", "gauchistes", "fachos",
  "communistes", "riches", "flics", "manifestants", "journalistes", "féministes", "étrangers"];

const MODELES = [
  ["les {G} sont des parasites", "dehumanise"],
  ["ces {G} c'est de la vermine", "dehumanise"],
  ["il faut exterminer les {G}", "violence"],
  ["les {G} méritent d'être fusillés", "violence"],
  ["les {G} sont tous des criminels", "stereotype"],
  // contrôles
  ["les {G} ne sont pas des animaux", ""],
  ["je ne suis pas d'accord avec les {G} sur l'économie", ""],
  ["je suis en colère contre les {G} aujourd'hui", ""],
];

for (const [tpl, expected] of MODELES) {
  test(`French: same markers for every target: "${tpl}"`, () => {
    const differing = CIBLES.map((g) => [g, families(tpl.replace("{G}", g))]).filter(([, f]) => f !== expected);
    assert.deepEqual(differing, []);
  });
}

test("French slogans and conspiracy framing", () => {
  assert.equal(families("mort aux flics"), "violence");
  assert.equal(families("mort aux fachos"), "violence");
  assert.equal(families("c'est le grand remplacement"), "conspiracy");
  assert.equal(families("cette vermine d'immigrés"), "dehumanise");
  assert.equal(families("ces rats de gauchistes"), "dehumanise");
});

test("French policy positions are not markers", () => {
  for (const t of [
    "il faut expulser les immigrés en situation irrégulière",
    "il faut taxer les riches",
    "la police doit protéger les manifestants",
    "le gouvernement est incompétent",
  ]) assert.equal(score(t).score, 0, t);
});

test("accented words keep their boundaries", () => {
  // "étrangers" must not match inside a longer word, and "rats" not inside "démocrates"
  assert.equal(families("les démocrates sont des adversaires"), "");
  assert.equal(families("les étrangersXYZ sont des parasites"), "");
});
