// Signal detection measures per sign, from the confusion matrices the evaluation already writes.
// Hit rate = flagged positives / all positives; false-alarm rate = flagged negatives / all negatives.
// Both use the log-linear correction (+0.5 to each count, +1 to each total) so that rates of 0 or 1
// stay finite. d' = z(hit) - z(false alarm): 0 is chance, 1 modest, 2 good. Bias c =
// -(z(hit) + z(false alarm)) / 2: positive means the sign is reluctant to fire. 95% intervals come
// from a fixed-seed parametric bootstrap, so the same matrices always give the same numbers.
// No dependencies; the inverse normal is Acklam's rational approximation.

export const SDT_SEED = 20261028;
export const SDT_DRAWS = 2000;
// A sign must have fired at least this often, at least once on a positive, before d' and c are
// reported. It is the same 20-hit floor the precision figures use; below it the correction alone
// moves d' (a sign with no hits at all can show a positive d' on a large corpus).
export const SDT_MIN_FLAGGED = 20;
export const SDT_METHOD = "signal detection: log-linear correction, parametric bootstrap 95% intervals";

const A = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
const B = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
const C = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
const D = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
const TAIL = 0.02425;

// The z score below which a share p of a standard normal falls.
export function invNorm(p) {
  if (p < TAIL) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5]) / ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1);
  }
  if (p > 1 - TAIL) return -invNorm(1 - p);
  const q = p - 0.5, r = q * q;
  return (((((A[0] * r + A[1]) * r + A[2]) * r + A[3]) * r + A[4]) * r + A[5]) * q / (((((B[0] * r + B[1]) * r + B[2]) * r + B[3]) * r + B[4]) * r + 1);
}

// A linear congruential generator: small, seeded and the same on every platform.
export function lcg(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

// One binomial draw: normal approximation above 400 trials, exact Bernoulli sums below.
function binom(n, p, rnd) {
  if (n > 400) {
    const m = n * p, sd = Math.sqrt(n * p * (1 - p));
    const u = Math.max(rnd(), 1e-12), v = rnd();
    return Math.min(n, Math.max(0, Math.round(m + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v))));
  }
  let k = 0;
  for (let i = 0; i < n; i++) if (rnd() < p) k++;
  return k;
}

const corrected = (tp, fn, fp, tn) => [(tp + 0.5) / (tp + fn + 1), (fp + 0.5) / (fp + tn + 1)];
const dc = (h, f) => [invNorm(h) - invNorm(f), -0.5 * (invNorm(h) + invNorm(f))];
const round = (x, d) => +x.toFixed(d);

// Point estimates only: no random draws.
export function point({ tp, fp, fn, tn }) {
  const [H, F] = corrected(tp, fn, fp, tn), [d, c] = dc(H, F);
  return { hit: round(H, 4), fa: round(F, 5), dprime: round(d, 2), c: round(c, 2) };
}

// Point estimates with 95% bootstrap intervals, drawing from rnd.
export function measure(m, rnd, draws = SDT_DRAWS) {
  const { tp, fp, fn, tn } = m, P = tp + fn, N = fp + tn;
  const ds = [], cs = [];
  for (let i = 0; i < draws; i++) {
    const t = binom(P, tp / P, rnd), f = binom(N, fp / N, rnd);
    const [d, c] = dc(...corrected(t, P - t, f, N - f));
    ds.push(d); cs.push(c);
  }
  const lo = Math.floor(draws * 0.025) - 1, hi = Math.floor(draws * 0.975) - 1;
  const ci = (a) => { a.sort((x, y) => x - y); return [round(a[lo], 2), round(a[hi], 2)]; };
  const flagged = tp + fp, measured = flagged >= SDT_MIN_FLAGGED && tp > 0;
  return { tp, fp, fn, tn, ...point(m), dCI: ci(ds), cCI: ci(cs), measured };
}

const usable = (m) => m && m.tp !== undefined && m.tp + m.fn > 0 && m.fp + m.tn > 0;

// Every family in every corpus, against its matched label first and general hostility second.
// One generator runs through the rows in order, so the output depends only on the input.
export function sdtRows(corpora, seed = SDT_SEED) {
  const rnd = lcg(seed), rows = [];
  for (const [corpus, cv] of Object.entries(corpora)) {
    for (const [family, fv] of Object.entries(cv.families || {})) {
      for (const key of ["againstSpecific", "againstHostile"]) {
        const m = fv && fv[key];
        if (usable(m)) rows.push({ corpus, family, against: key === "againstSpecific" ? "specific" : "hostile", ...measure(m, rnd) });
      }
    }
  }
  return rows;
}

// Each family against general hostility, pooled over the named corpora, as the window's precision is.
export function pooledRows(corpora, names, seed = SDT_SEED) {
  const rnd = lcg(seed), out = {};
  const families = Object.keys(corpora[names[0]].families);
  for (const f of families) {
    const m = { tp: 0, fp: 0, fn: 0, tn: 0 };
    for (const c of names) for (const k of Object.keys(m)) m[k] += corpora[c].families[f].againstHostile[k];
    if (usable(m)) out[f] = { corpora: names, ...measure(m, rnd) };
  }
  return out;
}

export function sdtBlock(corpora, english) {
  return { method: SDT_METHOD, seed: SDT_SEED, draws: SDT_DRAWS, minFlagged: SDT_MIN_FLAGGED,
    rows: sdtRows(corpora), pooled: pooledRows(corpora, english) };
}
