// Look-alike letters (src/core/confusables.js). The seeded set measures the duplicates sign's
// recall on copies with one letter swapped for a Cyrillic or Greek look-alike, before and after
// folding; the controls hold that ordinary text in other scripts is never changed.
import test from "node:test";
import assert from "node:assert/strict";
import { foldConfusables } from "../src/core/confusables.js";
import { duplicateClusters, shingles, jaccard, signature, JACCARD_MIN } from "../src/core/similarity.js";
import { fingerprint } from "../src/core/network.js";
import { score } from "../src/core/rhetoric.js";
import { buildClaimIndex, matchClaims } from "../src/core/claims.js";
import { CONFUSABLES_VERSION } from "../src/core/confusables-data.js";

// A small seeded generator, so the set is the same on every run.
function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; }; }
const SUBJECTS = ["the mayor", "our council", "the new law", "this company", "the police chief", "the minister", "the report", "the school board", "these protests", "the court"];
const VERBS = ["has failed", "was paid to stay silent", "will raise prices again", "lied about the numbers", "ignored every warning", "is hiding the real cost", "keeps changing the story", "never answered the question"];
const TAILS = ["and nobody in the press will say it", "and everyone here knows it by now", "so share this before it gets deleted", "and the people paying for it are us", "which is why we need answers today", "and they think we will just forget"];
const SWAP = { a: ["а", "α"], e: ["е"], o: ["о", "ο"], p: ["р", "ρ"], c: ["с"], x: ["х", "χ"], y: ["у"], i: ["і", "ι"], s: ["ѕ"] };

export function seededPairs(n = 100, seed = 20261021) {
  const r = rng(seed), pick = (a) => a[Math.floor(r() * a.length)], out = [];
  while (out.length < n) {
    const text = `${pick(SUBJECTS)} ${pick(VERBS)} ${pick(TAILS)}`;
    const words = text.split(" ");
    const at = words.map((w, i) => [w, i]).filter(([w]) => [...w].some((c) => SWAP[c]));
    const [w, i] = pick(at);
    const pos = [...w].map((c, k) => [c, k]).filter(([c]) => SWAP[c]);
    const [c, k] = pick(pos);
    words[i] = w.slice(0, k) + pick(SWAP[c]) + w.slice(k + 1);
    out.push([text, words.join(" ")]);
  }
  return out;
}

// The duplicates sign as it was before folding: same steps, no fold.
const rawShingles = (t) => {
  const w = String(t).toLowerCase().replace(/https?:\/\/\S+/g, " ").replace(/@\w+/g, " ").replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  const s = new Set(); for (let i = 0; i + 3 <= w.length; i++) s.add(w.slice(i, i + 3).join(" ")); return s;
};

test("the seeded set: recall of the duplicates sign on one-letter look-alike copies goes to 100%", () => {
  const pairs = seededPairs();
  assert.equal(pairs.length, 100);
  assert.ok(pairs.every(([a, b]) => a !== b && /[^\x00-\x7F]/.test(b)));
  // MinHash banding (16 bands of 4) finds the pair, then Jaccard confirms it, as in similarity.js.
  const banded = (x, y) => { const p = signature(x), q = signature(y); for (let b = 0; b < 64; b += 4) if (p.slice(b, b + 4).join() === q.slice(b, b + 4).join()) return true; return false; };
  const before = pairs.filter(([a, b]) => { const x = rawShingles(a), y = rawShingles(b); return banded(x, y) && jaccard(x, y) >= JACCARD_MIN; }).length;
  const after = pairs.filter(([a, b]) => duplicateClusters([{ id: "1", author: "x", text: a }, { id: "2", author: "y", text: b }]).length === 1).length;
  // Measured 2026-10-21: before folding 75 of 100, after 100 of 100 (project-docs/EVALUATION.md).
  assert.equal(before, 75);
  assert.equal(after, 100);
  assert.ok(pairs.every(([a, b]) => fingerprint(a) === fingerprint(b)), "the cross-thread fingerprint matches too");
});

test("ordinary text in other scripts is never changed", () => {
  const controls = [
    "Москва — столица России, и это правда.", "Київ є столицею України, і це відомо всім.", "Η Αθήνα είναι η πρωτεύουσα της Ελλάδας.",
    "Срби и Хрвати говоре сличним језиком.", "مرحبا بالعالم، هذه جملة للاختبار.", "यह एक परीक्षण वाक्य है।", "这是一个测试句子，没有问题。",
    "Բարեւ աշխարհ, սա փորձնական նախադասություն է։", "Ꮳ ᏣᎳᎩ ᎦᏬᏂᎯᏍᏗ", "שלום עולם, זה משפט לבדיקה.", "こんにちは、テストです。",
    "Putin met Macron, then Путин flew home to Москва.", "I love Москва and Санкт-Петербург in winter.", "Ça va très bien, merci beaucoup!",
    "Straße, Äpfel und Größe bleiben gleich.", "Fiancée naïve café señor jalapeño", "Ελλάδα και Greece are the same place",
  ];
  for (const t of controls) assert.equal(foldConfusables(t), t, t);
});

test("look-alike letters fold toward the word's own script and the text's main script", () => {
  assert.equal(foldConfusables("Іnstagram pоst аbout the riots"), "Instagram post about the riots");
  assert.equal(foldConfusables("раураl secure lоgin"), "paypal secure login");
  assert.equal(foldConfusables("мама мыла рaму"), "мама мыла раму", "a Latin a inside Russian text folds to Cyrillic");
  assert.equal(foldConfusables("the сосо plant grows tall here"), "the coco plant grows tall here", "a lone all-look-alike word in Latin text");
  assert.equal(foldConfusables("Ｈｅｌｌｏ 𝐰𝐨𝐫𝐥𝐝 Ⓗi"), "Hello world Hi");
  assert.equal(foldConfusables("in​vis­ible wo⁠rds"), "invisible words");
  assert.equal(foldConfusables("नम‍स्ते"), "नम‍स्ते", "ZWJ shapes Indic text and stays");
  assert.match(CONFUSABLES_VERSION, /^\d+\.\d+\.\d+$/);
});

test("word lists and claim matching see through look-alike letters", () => {
  const plain = score("wake up sheeple, this was a false flag"), disguised = score("wаke up shеeple, this was a fаlse flаg");
  assert.deepEqual(disguised.markers.map((m) => m.family), plain.markers.map((m) => m.family));
  assert.ok(plain.markers.length > 0);
  const idx = buildClaimIndex({ checkers: ["Example"], rows: [["Windmills kill millions of birds every year in Germany", "False", 0, "https://example.org/a", "2026-01-01", "en"]] });
  assert.equal(matchClaims(idx, "Windmills kill millions of birds every year in Germany, look it up").length, 1);
  assert.equal(matchClaims(idx, "Windmіlls kіll mіllions of bіrds every yeаr in Gеrmany, look it up").length, 1);
});

test("folding never merges distinct texts in different scripts", () => {
  const a = "Сегодня в Москве прошла большая демонстрация против новых налогов";
  const b = "Today in Moscow there was a large demonstration against the new taxes";
  assert.equal(jaccard(shingles(a), shingles(b)), 0);
  assert.notEqual(fingerprint(a), fingerprint(b));
});
