// Secret coercion (src/core/theories-coercion.js), added 2026-10-23 from feed test 3. The rule names
// the technique, never a side: every template must give the same answer whichever state, leader,
// agency, party, people, lobby or company is named. Feed-test posts are paraphrased, never copied.
import test from "node:test";
import assert from "node:assert/strict";
import { score } from "../src/core/rhetoric.js";
import { COERCION_ACTORS, COERCION_ADJ } from "../src/core/theories-coercion.js";

const coercion = (t) => score(t).markers.filter((m) => m.family === "conspiracy-theory" && m.theory === "secret-coercion").length > 0;

const TEMPLATES = [
  "One explanation for all of it: the president is being blackmailed by {A}",
  "it is obvious he is owned by {A}",
  "{A} has dirt on him, that is why he folds every time",
  "the senator is totally compromised by {A}",
  "{A} is blackmailing her",
  "{A} owns congress now",
];

for (const tpl of TEMPLATES) {
  test(`"${tpl}" fires for every actor alike`, () => {
    const missed = COERCION_ACTORS.filter((a) => !coercion(tpl.replace("{A}", a)));
    assert.deepEqual(missed, []);
  });
}

test("\"a <adjective> asset\" fires for every adjective alike", () => {
  const missed = COERCION_ADJ.filter((a) => !coercion(`everyone knows she is a ${a} asset`));
  assert.deepEqual(missed, []);
});

// Mirrored pairs: one shape, the entity swapped. Israel, Russia, China, the US, a party, a company.
const PAIRS = [
  ["he is being blackmailed by Israel", "he is being blackmailed by Russia"],
  ["he is being blackmailed by China", "he is being blackmailed by the US"],
  ["she is being blackmailed by the Democrats", "she is being blackmailed by the Republicans"],
  ["the prime minister is owned by Pfizer", "the prime minister is owned by BlackRock"],
  ["Mossad has kompromat on him", "the CIA has kompromat on him"],
  ["Beijing has dirt on the speaker", "Washington has dirt on the speaker"],
  ["the president is controlled by the Kremlin", "the president is controlled by Tel Aviv"],
  ["the GOP owns him", "the DNC owns him"],
  ["she's a Chinese puppet", "she's an Israeli puppet"],
];
for (const [a, b] of PAIRS) {
  test(`secret coercion pair matches both: "${a}" / "${b}"`, () => {
    assert.ok(coercion(a), a);
    assert.equal(coercion(b), coercion(a), b);
  });
}

test("the same guards hold whichever entity is named", () => {
  const near = [
    "if he were being blackmailed by {A}, he would act exactly like this",
    "what if {A} has dirt on him",
    "Is the president being blackmailed by {A}?",
    "The host says the president is being blackmailed by {A}",
    "According to one columnist, the president is owned by {A}",
    "The senator was accused of being compromised by {A}",
    "He is allegedly being blackmailed by {A}",
    "The aide was convicted after the court found he had been blackmailed by {A}",
    "The jury heard he was blackmailed by {A}",
    "His phone was compromised by {A} hackers",
    "There is no evidence he is being blackmailed by {A}",
    "The claim that he is owned by {A} is baseless",
  ];
  // The same sentences without the conditional, the question, the allegation or the record: each fires,
  // so the near misses above are skipped by a guard and not by a pattern that never matched.
  const control = [
    "he is being blackmailed by {A}, he acts exactly like this",
    "{A} has dirt on him",
    "The president is being blackmailed by {A}.",
    "The president is being blackmailed by {A}",
    "the president is owned by {A}",
    "The senator is compromised by {A}",
    "He is being blackmailed by {A}",
    "he had been blackmailed by {A}",
    "he was blackmailed by {A}",
    "He was compromised by {A}",
  ];
  for (const a of ["Israel", "Russia", "China", "the US", "the Democrats", "the Republicans", "Pfizer", "BlackRock"]) {
    for (const t of near) assert.equal(coercion(t.replace("{A}", a)), false, t.replace("{A}", a));
    for (const t of control) assert.equal(coercion(t.replace("{A}", a)), true, t.replace("{A}", a));
  }
});

test("ordinary uses of the same words do not fire", () => {
  for (const t of [
    "My ex tried to blackmail me with old photos",
    "The firm is owned by BlackRock and Vanguard",
    "Crimea is controlled by Russia since 2014",
    "The region is controlled by the cartels",
    "Our network was compromised by Chinese hackers last year",
    "Frozen Russian assets could pay for the rebuild",
    "Parliament is controlled by the Tories after the election",
    "The board is now controlled by the founders",
    "she has dirt on her shoes",
    "a blackmail scene in the new film",
  ]) assert.equal(coercion(t), false, t);
});

test("a party holding an office after an election is not coercion", () => {
  for (const t of ["the GOP controls the White House, Congress and the Senate", "Democrats control the Senate now",
    "Labour controls parliament after the vote", "the Tories own the majority"]) assert.equal(coercion(t), false, t);
});
