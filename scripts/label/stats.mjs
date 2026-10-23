// Statistics for the campaign-lens labelling run: two-labeller agreement (Cohen's kappa with a 95%
// interval), the consensus label per case, precision and recall of the lens's "strong" status with
// Wilson intervals, and the organic false-positive rate per language and per region stratum with
// the fairness bound (project-docs/EVALUATION.md, "Minimums before any claim"). Pure functions.
import { wilson } from "../../src/core/report.js";
import { CAMPAIGN, PAID } from "./format.mjs";

export const MIN_STRATUM = 30;   // organic cases a stratum needs before its rate is reported
export const MIN_CLASS = 30;     // organic and paid cases a platform needs before any claim
export const BOUND = 0.05;       // largest allowed false-positive gap between reported strata
export const BOOT = 2000;        // bootstrap resamples for the kappa interval
export const SEED = 20261023;    // fixed, so the interval is the same on every run

// Mulberry32: a small seeded generator, so resampling is reproducible without dependencies.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// pairs: [[labelA, labelB], ...]. Returns { n, po, pe, kappa }; kappa is null when pe is 1.
export function kappaOf(pairs, cats = CAMPAIGN) {
  const n = pairs.length;
  if (!n) return { n: 0, po: null, pe: null, kappa: null };
  const a = Object.fromEntries(cats.map((c) => [c, 0])), b = { ...a };
  let agree = 0;
  for (const [x, y] of pairs) { a[x]++; b[y]++; if (x === y) agree++; }
  const po = agree / n;
  const pe = cats.reduce((s, c) => s + (a[c] / n) * (b[c] / n), 0);
  return { n, po, pe, kappa: pe === 1 ? null : (po - pe) / (1 - pe) };
}

// Kappa with two intervals: the large-sample approximation (Cohen 1960) and a seeded percentile
// bootstrap over cases. The bootstrap is the one reported as the interval; both are kept.
export function kappaInterval(pairs, cats = CAMPAIGN, boot = BOOT, seed = SEED) {
  const k = kappaOf(pairs, cats);
  if (k.kappa === null) return { ...k, approx: null, interval: null };
  const se = Math.sqrt((k.po * (1 - k.po)) / (k.n * (1 - k.pe) ** 2));
  const next = rng(seed), ks = [];
  for (let i = 0; i < boot; i++) {
    const s = Array.from({ length: k.n }, () => pairs[Math.floor(next() * k.n)]);
    const r = kappaOf(s, cats).kappa;
    if (r !== null) ks.push(r);
  }
  ks.sort((x, y) => x - y);
  const at = (p) => ks[Math.min(ks.length - 1, Math.max(0, Math.floor(p * ks.length)))];
  return { ...k, approx: [k.kappa - 1.96 * se, k.kappa + 1.96 * se], interval: ks.length ? [at(0.025), at(0.975)] : null, resamples: ks.length };
}

// Group label rows by case. A case counts when exactly two labellers read it. The consensus is the
// shared label; a disagreement is "unsure" and is counted (EVALUATION.md). Strata come from the
// first labeller and must match the second's.
export function consensus(labels) {
  const byCase = new Map();
  for (const r of labels) (byCase.get(r.case) || byCase.set(r.case, []).get(r.case)).push(r);
  const cases = [], skipped = [];
  for (const [id, rows] of byCase) {
    const who = new Set(rows.map((r) => r.labeller));
    if (rows.length !== 2 || who.size !== 2) { skipped.push({ case: id, rows: rows.length }); continue; }
    const [a, b] = rows;
    const sameStrata = JSON.stringify(a.strata) === JSON.stringify(b.strata);
    cases.push({ case: id, a: a.campaign, b: b.campaign, label: a.campaign === b.campaign ? a.campaign : "unsure", disagreed: a.campaign !== b.campaign, strata: a.strata, sameStrata });
  }
  return { cases, skipped };
}

const rate = (k, n) => ({ k, n, rate: n ? k / n : null, interval: n ? wilson(k, n) : null });

// Organic false-positive rate per value of one stratum dimension, with the 5-point bound read
// only across strata that have MIN_STRATUM organic cases.
export function strataRates(organic, dim, min = MIN_STRATUM, bound = BOUND) {
  const groups = new Map();
  for (const c of organic) {
    const v = c.strata[dim];
    const g = groups.get(v) || { k: 0, n: 0 };
    g.n++; if (c.lens === "strong") g.k++;
    groups.set(v, g);
  }
  const rows = [...groups].sort(([x], [y]) => (x < y ? -1 : 1)).map(([value, g]) =>
    g.n >= min ? { value, ...rate(g.k, g.n), reported: true } : { value, n: g.n, reported: false, note: "insufficient cases" });
  const shown = rows.filter((r) => r.reported);
  let gap = null, pair = null;
  for (const x of shown) for (const y of shown) {
    const d = x.rate - y.rate;
    if (gap === null || d > gap) { gap = d; pair = [x.value, y.value]; }
  }
  const verdict = shown.length < 2 ? "not readable" : gap > bound ? "fails" : "holds";
  return { dimension: dim, rows, gap: shown.length < 2 ? null : gap, pair: verdict === "fails" ? pair : null, bound: verdict, failing: verdict === "fails" ? pair : [] };
}

// The whole results object for one labels file.
export function results({ labels, lens }, opts = {}) {
  const min = opts.minStratum ?? MIN_STRATUM;
  const { cases, skipped } = consensus(labels);
  const status = new Map(lens.map((r) => [r.case, r.lens]));
  for (const c of cases) c.lens = status.get(c.case) ?? null;
  const agreement = kappaInterval(cases.map((c) => [c.a, c.b]), CAMPAIGN, opts.boot ?? BOOT);
  const organic = cases.filter((c) => c.label === "organic" && c.lens);
  const paid = cases.filter((c) => PAID.has(c.label) && c.lens);
  const strong = cases.filter((c) => c.lens === "strong" && (c.label === "organic" || PAID.has(c.label)));
  const tp = strong.filter((c) => PAID.has(c.label)).length;
  const platforms = [...new Set(cases.map((c) => c.strata.platform))].sort();
  return {
    format: "dc-label-results/1",
    cases: cases.length, skipped: skipped.length,
    disagreements: cases.filter((c) => c.disagreed).length,
    strataMismatch: cases.filter((c) => !c.sameStrata).map((c) => c.case),
    missingLens: cases.filter((c) => !c.lens).map((c) => c.case),
    counts: Object.fromEntries(CAMPAIGN.map((l) => [l, cases.filter((c) => c.label === l).length])),
    agreement: { measure: "Cohen's kappa, campaign label, 4 categories", ...agreement },
    precision: rate(tp, strong.length),
    recall: rate(paid.filter((c) => c.lens === "strong").length, paid.length),
    organicFalsePositive: rate(organic.filter((c) => c.lens === "strong").length, organic.length),
    strata: { language: strataRates(organic, "language", min), region: strataRates(organic, "region", min) },
    claimable: platforms.map((p) => {
      const o = organic.filter((c) => c.strata.platform === p).length, q = paid.filter((c) => c.strata.platform === p).length;
      return { platform: p, organic: o, paid: q, enough: o >= MIN_CLASS && q >= MIN_CLASS };
    }),
    doesNotProve: "Agreement between two labellers is not ground truth, and a held fairness bound on these strata says nothing about strata with fewer than 30 organic cases.",
  };
}
