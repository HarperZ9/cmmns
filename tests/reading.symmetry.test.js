// The reading lens names a technique, never a side: every targeted template must give the same
// technique and the same weight whichever nation, people, party, actor or leader it names
// (src/core/reading-lists.js). Templates are paraphrases, never copied posts.
import test from "node:test";
import assert from "node:assert/strict";
import { readPost, READING_SHIP_PRECISION } from "../src/core/reading.js";
import { READING_TECHNIQUES } from "../src/core/reading-cues.js";
import { NATIONS, TARGET_GROUPS, STRONGMEN } from "../src/core/reading-lists.js";
import { COERCION_ACTORS } from "../src/core/theories-coercion.js";

const ALL = new Set(READING_TECHNIQUES.map((t) => t.id));
const title = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
// [technique, template, slot list]
const TEMPLATES = [
  ["punitive-annexation", "we should take {X} and turn it into a prison colony", NATIONS],
  ["nation-denial", "{X} is not a real country, never was", NATIONS],
  ["punitive-annexation", "honestly just nuke {X}", NATIONS],
  ["case-to-group", "typical {X}, every time", TARGET_GROUPS],
  ["case-to-group", "{X} always do this", TARGET_GROUPS],
  ["essentialism", "{X} are inherently like that", TARGET_GROUPS],
  ["punitive-annexation", "time to criminalize {X}", TARGET_GROUPS],
  ["secret-coercion", "the senator is owned by {X}", COERCION_ACTORS],
  ["secret-coercion", "she is a puppet of {X}", COERCION_ACTORS],
  ["strongman", "we need our own {X}", STRONGMEN],
  ["strongman", "{X} did it right", STRONGMEN],
];

const result = (text, technique) => {
  const f = readPost(text, { on: ALL }).filter((x) => x.technique === technique);
  return f.length ? { shown: f[0].shown, weight: f[0].weight } : null;
};

for (const [technique, tpl, list] of TEMPLATES) {
  test(`"${tpl}" gives one answer for every target (${technique})`, () => {
    for (const cased of [(x) => x, title]) {
      const answers = new Map();
      for (const x of list) answers.set(x, JSON.stringify(result(tpl.replace("{X}", cased(x)), technique)));
      const distinct = new Set(answers.values());
      assert.equal(distinct.size, 1, `different answers: ${[...distinct].map((a) => `${a} for ${[...answers].filter(([, v]) => v === a).slice(0, 3).map(([k]) => k).join(", ")}`).join(" | ")}`);
      assert.notEqual([...distinct][0], "null", "the template should fire");
    }
  });
}

// Mirrored pairs from both directions, same shape.
const PAIRS = [
  ["the Democrats rigged the election", "the Republicans rigged the election"],
  ["Muslims are like cockroaches, they are everywhere", "Christians are like cockroaches, they are everywhere"],
  ["they want to replace white voters", "they want to replace native voters"],
  ["globohomo is everywhere now", "magats are everywhere now"],
  ["he is in the pocket of AIPAC", "he is in the pocket of Qatar"],
];
for (const [a, b] of PAIRS) {
  test(`mirrored: "${a}" and "${b}" read alike`, () => {
    const pick = (t) => readPost(t, { on: ALL }).map((f) => [f.technique, f.weight, f.shown]);
    assert.deepEqual(pick(a), pick(b));
  });
}

test("the ship bar is 80% held-out precision", () => assert.equal(READING_SHIP_PRECISION, 0.8));
