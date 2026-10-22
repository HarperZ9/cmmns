// The persuasion symmetry test: one template sentence must find the same techniques whoever it is
// about, for targets from every political direction, in English and in French. A technique
// describes how a post argues, so the target can never change the result.
import test from "node:test";
import assert from "node:assert/strict";
import { techniqueSpans } from "../src/core/persuasion.js";

const kinds = (t) => [...new Set(techniqueSpans(t).map((h) => h.technique))].sort().join(",");

const SUITES = [
  {
    name: "English",
    targets: ["immigrants", "muslims", "jews", "christians", "black people", "white people", "trans people", "feminists",
      "leftists", "liberals", "communists", "democrats", "conservatives", "republicans", "nationalists", "fascists",
      "billionaires", "the rich", "landlords", "police", "protesters", "journalists", "men", "women", "farmers", "the government"],
    templates: [
      ["everyone knows {G} are behind this", "bandwagon"],
      ["{G} are a bunch of liars", "name-calling"],
      ["what {G} did was disgusting", "loaded-language"],
      ["stop {G} before it's too late", "appeal-to-fear"],
      ["but what about the {G} who did the same", "whataboutism"],
      ["you're either with us or with {G}", "black-and-white"],
      ["experts say {G} are wrong", "appeal-to-authority"],
      ["{G} made the worst decision in history", "exaggeration"],
      ["{G} won the vote, it is what it is", "thought-terminating"],
      ["can we really trust {G} on this", "doubt"],
      ["the real reason {G} backed the plan is money", "motive-attribution"],
      ["{G} call it reform, but it is masked as reform and it was never about the vote", "motive-attribution"],
      ["isn't it strange that {G} said nothing? I'm just asking", "just-asking"],
      ["{G} met the minister twice. Is it just a coincidence?", "just-asking"],
      ["the smear against {G} is disgusting, everyone knows it", "bandwagon,loaded-language"],
      // controls: disagreement without a technique cue
      ["I disagree with {G} about taxes", ""],
      ["{G} are wrong about the economy and I will vote against them", ""],
      ["{G} held a meeting on Tuesday", ""],
      ["{G} asked the council a question about the budget", ""],
      ["the reason {G} gave was the cost of fuel", ""],
    ],
  },
  {
    name: "French",
    targets: ["les immigrés", "les musulmans", "les juifs", "les chrétiens", "les noirs", "les blancs", "les personnes trans",
      "les féministes", "la gauche", "la droite", "les communistes", "les socialistes", "les conservateurs", "les nationalistes",
      "les fascistes", "les milliardaires", "les riches", "les policiers", "les manifestants", "les journalistes",
      "les hommes", "les femmes", "les agriculteurs", "le gouvernement"],
    templates: [
      ["tout le monde sait que {G} sont derrière tout ça", "bandwagon"],
      ["{G} sont des menteurs", "name-calling"],
      ["ce que {G} ont fait est scandaleux", "loaded-language"],
      ["il faut arrêter {G} avant qu'il ne soit trop tard", "appeal-to-fear"],
      ["vous êtes avec nous ou contre nous, comme {G}", "black-and-white"],
      ["les experts disent que {G} ont tort", "appeal-to-authority"],
      ["{G} ont pris la pire décision de l'histoire", "exaggeration"],
      ["{G} ont gagné, c'est comme ça", "thought-terminating"],
      ["peut-on vraiment croire {G}", "doubt"],
      // controls
      ["je ne suis pas d'accord avec {G} sur les impôts", ""],
      ["{G} se sont réunis mardi", ""],
    ],
  },
];

for (const s of SUITES) {
  assert.ok(s.targets.length >= 20, `${s.name}: at least 20 targets`);
  for (const [tpl, expected] of s.templates) {
    test(`${s.name}: same techniques for every target: "${tpl}"`, () => {
      const differing = s.targets.map((g) => [g, kinds(tpl.replace("{G}", g))]).filter(([, k]) => k !== expected);
      assert.deepEqual(differing, [], `targets scored differently from "${expected}"`);
    });
  }
  test(`${s.name}: a target alone finds no technique`, () => {
    for (const g of s.targets) assert.equal(kinds(g), "", g);
  });
}
