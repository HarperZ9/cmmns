// The inflection layer: each cue match is weighted by what surrounds it. Stance (asserts, quotes,
// mocks, rebuts), target class, intensity, irony, thread context, genre and the author's own usage
// in the thread each become a number, and one logistic weight vector (reading-weights.js, fitted
// on feed tests 1 to 5 only by scripts/eval-reading.mjs) turns them into a weight between 0 and 1.
// The same vector applies to every technique and every target: target enters only as a class
// (a people or nation, a person), never as which one. Deterministic: same input, same weight.

import { NATIONS, TARGET_GROUPS, STRONGMEN, REPORT_VERBS, REBUT_WORDS, MOCK_WORDS, IRONY_WORDS, NEWS_WORDS, PROFANITY } from "./reading-lists.js";
import { COERCION_ACTORS } from "./theories-coercion.js";
import { READING_WEIGHTS } from "./reading-weights.js";

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const words = (list, flags = "iu") => new RegExp(`(?<![\\p{L}\\p{N}])(?:${[...list].map(esc).sort((a, b) => b.length - a.length).join("|")})(?![\\p{L}\\p{N}])`, flags);
// Every name a targeted cue can carry: peoples, nations, parties, states, agencies, firms and leaders.
// Target enters the weight only as this one class, so every name in it weighs the same.
const NAMED = [...new Set([...TARGET_GROUPS, ...NATIONS, ...COERCION_ACTORS, ...STRONGMEN])];
const RE = {
  report: words(REPORT_VERBS), rebut: words(REBUT_WORDS), mock: words(MOCK_WORDS), irony: words(IRONY_WORDS),
  news: words(NEWS_WORDS), profane: words(PROFANITY), named: words(NAMED), namedAll: words(NAMED, "giu"),
  pronoun: /\b(?:he|she|him|her|his)\b/iu, capitalised: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/u, joke: /walk into a|knock knock|😂|🤣|\blol\b|\blmao\b/iu,
};
// The text with every listed name replaced by one neutral word, so a name's length or capitals
// never change a factor.
const neutral = (s) => s.replace(RE.namedAll, "x");
// A person: a pronoun, or a capitalised two-word name outside the lists.
const person = (s) => RE.pronoun.test(s) || RE.capitalised.test(neutral(s));

// Factor ids, in a fixed order, with the words the window shows for each.
export const FACTORS = [
  ["quotes", "stance: quotes or reports"], ["mocks", "stance: mocks"], ["rebuts", "stance: rebuts"], ["irony", "irony cue"],
  ["question", "asked as a question"], ["target-group", "target: a named people, nation or power"], ["target-person", "target: a person"],
  ["intensity", "intensity"], ["echo", "thread: other authors use it"], ["root", "thread: the opening post uses it"],
  ["news", "genre: news or excerpt"], ["joke", "genre: joke"], ["repeat", "author: uses it again in the thread"],
  ["author-rebuts", "author: rebuts elsewhere in the thread"], ["short", "very short post"],
  ["mention", "stance: names the term to criticise it"],
];
export const FACTOR_IDS = FACTORS.map(([id]) => id);
// Use and mention: a coded term or dog-whistle named inside a sentence that criticises it is a
// mention. This weight is fixed from that distinction, not fitted (the dev sets hold one example).
export const MENTION_WEIGHT = -3;
const LEXICAL = new Set(["coded-term", "dog-whistle"]);
const LABEL = new Map(FACTORS);

// The sentence around [start, end) in s.
function sentence(s, start, end) {
  const head = s.slice(0, start), tail = s.slice(end);
  const a = Math.max(head.lastIndexOf("."), head.lastIndexOf("!"), head.lastIndexOf("?"), head.lastIndexOf("\n")) + 1;
  const m = tail.match(/[.!?\n]/);
  return { before: head.slice(a), after: m ? tail.slice(0, m.index + 1) : tail };
}

// True when the span sits inside quotation marks.
function quoted(s, start) {
  const head = s.slice(0, start);
  const open = (head.match(/[“"]/g) || []).length - (head.match(/”/g) || []).length;
  return /“[^”]*$/.test(head) || open % 2 === 1;
}

function intensity(s) {
  const letters = s.replace(/[^A-Za-z]/g, ""), caps = s.replace(/[^A-Z]/g, "").length;
  let x = 0;
  if (letters.length >= 12 && caps / letters.length > 0.3) x += 0.4;
  if (/!!|!\?|\?!/.test(s)) x += 0.3;
  if (RE.profane.test(s)) x += 0.3;
  return Math.min(1, x);
}

// Context-free factors of one post, shared by every match in it.
export function postFactors(text) {
  const s = String(text || "");
  return { mocks: RE.mock.test(s) ? 1 : 0, rebuts: RE.rebut.test(s) ? 1 : 0, irony: RE.irony.test(s) ? 1 : 0,
    "target-group": RE.named.test(s) ? 1 : 0, "target-person": person(s) ? 1 : 0, intensity: intensity(s),
    news: RE.news.test(s) || /^\s*[“"]/.test(s) ? 1 : 0, joke: RE.joke.test(s) ? 1 : 0,
    short: (neutral(s).match(/[\p{L}\p{N}]+/gu) || []).length < 6 ? 1 : 0 };
}

// Factors of one match: the post's own, the span's sentence, and the thread context.
// ctx: { echo: other authors in the thread with this technique, root: 0|1, repeat: 0|1, authorRebuts: 0|1 }
export function matchFactors(text, hit, base = postFactors(text), ctx = {}) {
  const s = String(text || ""), { before, after } = sentence(s, hit.start, hit.end);
  // A question is the technique itself for question insinuation, so it is context only elsewhere.
  const question = hit.technique !== "question-insinuation" && /\?/.test(after) ? 1 : 0;
  const mention = LEXICAL.has(hit.technique) && RE.rebut.test(before + after) ? 1 : 0;
  return { ...base, quotes: quoted(s, hit.start) || RE.report.test(before) ? 1 : 0, question, mention,
    echo: Math.min(3, ctx.echo || 0) / 3, root: ctx.root ? 1 : 0, repeat: ctx.repeat ? 1 : 0, "author-rebuts": ctx.authorRebuts ? 1 : 0 };
}

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

// { weight, shown, top } for one match. top: the two factors that moved the weight most, each
// { id, label, effect } with effect "raises" or "lowers".
export function inflect(factors, W = READING_WEIGHTS) {
  let z = W.bias;
  const parts = [];
  for (const id of FACTOR_IDS) {
    const c = (id === "mention" ? MENTION_WEIGHT : W.w[id] || 0) * (factors[id] || 0);
    z += c;
    if (c) parts.push({ id, label: LABEL.get(id), c });
  }
  parts.sort((a, b) => Math.abs(b.c) - Math.abs(a.c) || a.id.localeCompare(b.id));
  const weight = sigmoid(z);
  return { weight: Math.round(weight * 1000) / 1000, shown: weight >= W.threshold,
    top: parts.slice(0, 2).map((p) => ({ id: p.id, label: p.label, effect: p.c > 0 ? "raises" : "lowers" })) };
}
