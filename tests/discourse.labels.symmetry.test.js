// The label marker reads no side. Mirrored pairs, built from the lexicon's own mirror field and from
// party words traded for their counterparts, must give the same hits, statuses, counts and severity on
// both members; the lexicon must cover each side equally; and the shipped rule must name no side.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { labelsIn } from "../src/core/discourse/labels.js";
import { claimTypes } from "../src/core/discourse/claimtype.js";
import { moduleText } from "../scripts/labels-data.mjs";

const lex = JSON.parse(readFileSync(new URL("../data/discourse/labels.json", import.meta.url), "utf8"));
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const plural = (e) => e.plural || (/[^aeiou]y$/.test(e.word) ? e.word.slice(0, -1) + "ies" : /(?:s|sh|ch|x|z)$/.test(e.word) ? e.word + "es" : e.word + "s");
const art = (w) => (/^[aeiou]/i.test(w) ? "an" : "a");
const cap = (w) => w[0].toUpperCase() + w.slice(1);
const PARTY = [["Democrat", "Republican"], ["Labour", "Tory"], ["liberal", "conservative"], ["progressive", "traditionalist"]];

const HEAD_T = [
  (e, p) => `${p}, ${e.word} Jane Talbot wants your vote.`,
  (e) => `Pat Doe, ${art("known")} known ${e.word}, spoke first.`,
  (e) => `This woman is ${art(e.word)} ${e.word}.`,
  (e) => `They are ${plural(e)}.`,
  (e, p) => `The ${p} mayor is not ${art(e.word)} ${e.word}.`,
  (e) => `I am ${art(e.word)} proud ${e.word}.`,
  (e) => `Critics said she is ${art(e.word)} ${e.word}.`,
  (e) => `He denied being ${art(e.word)} ${e.word}.`,
  (e) => `She called him ${art(e.word)} ${e.word}.`,
  (e) => `The ${cap(e.word)} Party of Ruritania met today.`,
  (e, p) => `Ana Ruiz, ${art(p)} ${p} from Ohio, is ${art(e.word)} ${e.word}.`,
];
const MOD_T = [(m) => `He is ${art(m.word)} ${m.word} lunatic.`, (m) => `We watched ${m.word} extremist Mel Okafor.`, (m) => `You are a lying, ${m.word} fraud.`, (m) => `She is not ${art(m.word)} ${m.word} crook.`];
const view = (s) => labelsIn(s).map((h) => [h.kind, h.status, h.severity]);
const pairs = (list) => list.filter((e) => e.aim === "aimed-left").map((e) => [e, list.find((x) => x.word === e.mirror)]);

function mirroredPairs() {
  const out = [];
  pairs(lex.heads).forEach(([a, b], i) => { const [pa, pb] = PARTY[i % PARTY.length]; for (const t of HEAD_T) out.push([t(a, pa), t(b, pb)]); });
  for (const [a, b] of pairs(lex.modifiers)) for (const t of MOD_T) out.push([t(a), t(b)]);
  return out;
}

test("every mirrored pair gives the same hits, statuses and severity on both members", () => {
  const all = mirroredPairs(), totals = [{}, {}];
  assert.ok(all.length >= 120, `${all.length} pairs`);
  for (const [a, b] of all) {
    assert.notEqual(a, b);
    assert.deepEqual(view(a), view(b), `${a} | ${b}`);
    [a, b].forEach((s, i) => { for (const h of labelsIn(s)) { totals[i][h.status] = (totals[i][h.status] || 0) + 1; totals[i].severity = (totals[i].severity || 0) + h.severity; } });
  }
  assert.deepEqual(totals[0], totals[1]);
  assert.ok(totals[0].label > 0 && totals[0].negated > 0 && totals[0].self > 0 && totals[0].reported > 0, JSON.stringify(totals[0]));
});

test("the study's two shapes, with the sides swapped, type and label the same", () => {
  const posts = [["Democrat, communist Jane Talbot wants your guns. This woman is a liar.", "Republican, fascist Jane Talbot wants your guns. This woman is a liar."],
    ["He is a radical-left lunatic, and they are socialists.", "He is a radical-right lunatic, and they are reactionaries."],
    ["Far-left extremist Mel Okafor is a Marxist.", "Far-right extremist Mel Okafor is a Nazi."]];
  const read = (s) => claimTypes(s).map((t) => [t.type, t.labels.map((h) => [h.kind, h.status, h.severity])]);
  for (const [a, b] of posts) assert.deepEqual(read(a), read(b), a);
});

test("the lexicon covers each side equally, and every aimed entry has a mirror on the other side", () => {
  for (const list of [lex.heads, lex.modifiers]) {
    const left = list.filter((e) => e.aim === "aimed-left"), right = list.filter((e) => e.aim === "aimed-right");
    assert.equal(left.length, right.length);
    assert.ok(left.length >= 6, "more than a token set per side");
    for (const e of [...left, ...right]) {
      const m = list.find((x) => x.word === e.mirror);
      assert.ok(m, `${e.word}: mirror ${e.mirror}`);
      assert.equal(m.mirror, e.word);
      assert.notEqual(m.aim, e.aim);
    }
    for (const e of list) { assert.match(e.source, /^https:\/\//, e.word); assert.ok(e.why.length > 10, e.word); assert.ok(["aimed-left", "aimed-right", "none"].includes(e.aim), e.word); }
  }
  const heads = new Set(lex.heads.map((e) => e.word));
  for (const w of ["liar", "crook", "traitor", "fraud", "thug", "extremist", "fascist", "communist", "socialist"]) assert.ok(heads.has(w), w);
  assert.ok(lex.heads.filter((e) => e.aim === "none").length >= 20, "non-political insults");
});

test("the rule gets words only: the shipped module carries no side, and the rule names none", () => {
  assert.equal(src("src/core/discourse/labels-data.js"), moduleText(lex), "run node scripts/labels-data.mjs");
  assert.doesNotMatch(src("src/core/discourse/labels-data.js"), /aimed|mirror|"aim"|wiktionary/);
  const SIDED = /\b(?:democrat|republican|labour|tory|communis|fascis|socialis|marxis|nazi|maga|woke|liberal|conservative|progressive|(?:far|hard|ultra|alt|radical)[\s-](?:left|right)|(?:left|right)[\s-]wing)/i;
  for (const f of ["src/core/discourse/labels.js", "src/core/discourse/claimtype.js"]) assert.doesNotMatch(src(f), SIDED, f);
  assert.match(src("src/core/discourse/labels.js"), /export function labelsIn\(text, \{ lexicon \} = \{\}\)/, "the only option is a word list");
});
