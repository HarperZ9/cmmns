// Scoring and fitting for the reading lens (scripts/eval-reading.mjs).

import { readThread } from "../../src/core/reading.js";
import { FACTOR_IDS, MENTION_WEIGHT } from "../../src/core/reading-inflection.js";
import { READING_TECHNIQUES } from "../../src/core/reading-cues.js";
import { wilson } from "../../src/core/report.js";
import { consensus, either, harmPositive } from "./reading-data.mjs";

const ALL = new Set(READING_TECHNIQUES.map((t) => t.id));
const rate = (k, n) => ({ k, n, value: n ? k / n : null, ci: wilson(k, n) });

// Every post of every set, read thread by thread: [{ post, findings }].
export function readSets(sets, opts) {
  const out = [];
  for (const s of sets) for (const posts of s.threads.values()) {
    const read = readThread(posts, { on: ALL, ...opts });
    read.forEach((r, i) => out.push({ post: posts[i], findings: r.findings }));
  }
  return out;
}

// Per technique: precision against consensus and against either labeller, and recall against
// consensus, counting a post once per technique.
export function score(read) {
  const out = {};
  for (const t of ALL) {
    let n = 0, k = 0, kEither = 0, pos = 0, found = 0;
    for (const { post, findings } of read) {
      const hit = findings.some((f) => f.technique === t && f.shown), c = consensus(post, t);
      if (c) pos++;
      if (!hit) continue;
      n++; if (c) { k++; found++; } if (either(post, t)) kEither++;
    }
    out[t] = { precision: rate(k, n), precisionEither: rate(kEither, n), recall: rate(found, pos) };
  }
  return out;
}

// Of the posts both labellers marked in a harm family, how many carry any shown finding.
export function harmRecall(read) {
  const pos = read.filter((r) => harmPositive(r.post));
  return rate(pos.filter((r) => r.findings.some((f) => f.shown)).length, pos.length);
}

// The training rows for the weights: one per cue hit on the dev sets, label = consensus.
export function trainingRows(sets) {
  const X = [], y = [];
  for (const s of sets) for (const posts of s.threads.values()) {
    readThread(posts, { inflection: false, on: ALL, withFactors: true }).forEach((r, i) => {
      for (const f of r.findings) { X.push(FACTOR_IDS.map((id) => f.factors[id] || 0)); y.push(consensus(posts[i], f.technique) ? 1 : 0); }
    });
  }
  return { X, y };
}

// L2-regularised logistic regression by full-batch gradient descent from zero: deterministic.
export function fitLogistic({ X, y }, { lambda = 5, rate: lr = 0.1, steps = 4000 } = {}) {
  const d = FACTOR_IDS.length, w = new Array(d).fill(0);
  let b = 0;
  for (let s = 0; s < steps; s++) {
    const gw = new Array(d).fill(0);
    let gb = 0;
    for (let i = 0; i < X.length; i++) {
      const z = b + X[i].reduce((a, x, j) => a + x * (FACTOR_IDS[j] === "mention" ? MENTION_WEIGHT : w[j]), 0), e = 1 / (1 + Math.exp(-z)) - y[i];
      gb += e;
      for (let j = 0; j < d; j++) gw[j] += e * X[i][j];
    }
    b -= (lr * gb) / X.length;
    for (let j = 0; j < d; j++) if (FACTOR_IDS[j] !== "mention") w[j] -= lr * (gw[j] / X.length + (lambda * w[j]) / X.length);
  }
  const round = (x) => Math.round(x * 1000) / 1000;
  return { bias: round(b), w: Object.fromEntries(FACTOR_IDS.filter((id) => id !== "mention").map((id) => [id, round(w[FACTOR_IDS.indexOf(id)])])) };
}

