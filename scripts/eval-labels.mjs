// Scores the label marker (src/core/discourse/labels.js) on its planted set and on the blind round-1 set
// in tests/fixtures/argument/, and runs the shuffled-lexicon control: the same rule with epithet status
// moved to words drawn at random from the sets' own vocabulary. With --write, saves the current figures
// into project-docs/evidence/labels-eval.json (its firstScore entry is never rewritten).
//   node scripts/eval-labels.mjs [--write]
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { labelsIn } from "../src/core/discourse/labels.js";
import { LABEL_HEADS, LABEL_MODIFIERS, LABEL_INTENSIFIERS, LABEL_INSTITUTIONS } from "../src/core/discourse/labels-data.js";
import { wilson } from "../src/core/discourse/stats.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const json = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const ci = (k, n) => (n ? wilson(k, n).map((v) => Math.round(v * 1000) / 1000) : null);
export const sets = () => {
  const a = json("tests/fixtures/argument/labels-planted.json"), b = json("tests/fixtures/argument/labels-round1.json");
  return { planted: { positives: a.positives, negatives: a.controls }, round1: { positives: b.positives, negatives: b.negatives } };
};

// Hit-level precision and recall: per sentence, applied hits up to the expected count are true.
export function score({ positives, negatives }, opts) {
  let tp = 0, fp = 0, fn = 0;
  for (const p of positives) { const n = labelsIn(p.text, opts).filter((h) => h.status === "label").length; tp += Math.min(n, p.labels); fp += Math.max(0, n - p.labels); fn += Math.max(0, p.labels - n); }
  for (const c of negatives) fp += labelsIn(c.text, opts).filter((h) => h.status === "label").length;
  return { tp, fp, fn, precision: tp + fp ? tp / (tp + fp) : null, recall: tp / (tp + fn), precisionInterval: ci(tp, tp + fp), recallInterval: ci(tp, tp + fn) };
}

// A seeded generator, so the control is the same on every run.
const rng = (seed) => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

// The shuffled-lexicon control: as many heads and modifiers as the real lexicon, drawn from every word
// of both sets and the real lexicon, so epithet status is moved at random. Recall must collapse.
export function shuffledRecall(set, seeds = 20) {
  const all = Object.values(sets());
  const vocab = [...new Set(all.flatMap((x) => [...x.positives, ...x.negatives]).flatMap((x) => x.text.toLowerCase().match(/\p{Ll}[\p{Ll}-]+/gu) || []).concat(LABEL_HEADS.map((h) => h[0].toLowerCase()), LABEL_MODIFIERS.map((m) => m.toLowerCase())))];
  const recalls = [];
  for (let s = 1; s <= seeds; s++) {
    const r = rng(s), pool = [...vocab].sort(() => r() - 0.5);
    const lexicon = { heads: pool.slice(0, LABEL_HEADS.length).map((w) => [w, w + "s"]), modifiers: pool.slice(LABEL_HEADS.length, LABEL_HEADS.length + LABEL_MODIFIERS.length), intensifiers: LABEL_INTENSIFIERS, institutions: LABEL_INSTITUTIONS };
    recalls.push(score(set, { lexicon }).recall);
  }
  return { seeds, vocabulary: vocab.length, mean: recalls.reduce((a, b) => a + b, 0) / seeds, max: Math.max(...recalls) };
}

export function evaluate() {
  const s = sets();
  return { planted: score(s.planted), round1: score(s.round1), shuffled: { planted: shuffledRecall(s.planted), round1: shuffledRecall(s.round1) } };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const r = evaluate(), path = join(ROOT, "project-docs/evidence/labels-eval.json");
  console.log(JSON.stringify(r, null, 1));
  if (process.argv.includes("--write")) {
    let first = null;
    try { first = JSON.parse(readFileSync(path, "utf8")).firstScore; } catch { first = null; }
    writeFileSync(path, JSON.stringify({ firstScore: first, current: r }, null, 1) + "\n");
  }
}
