// Organic baselines for the coordination signs: how often each sign fires in ordinary threads,
// so the window can put the observed count beside what normal looks like.
//   node scripts/baselines.mjs [--data <dir>]   (default: $RADAR_DATA or ../radar-data)
// Inputs: <data>/pheme/prepared/pheme-threads.jsonl, written by scripts/eval/prep-pheme.py from
// the PHEME corpus (Zubiaga et al., CC BY 4.0), held outside the repository. Two null models of
// independent posting are simulated beside it (scripts/baselines/nulls.mjs).
// Writes project-docs/evidence/baseline-results.json and src/core/baselines-data.js. No post
// text or account id leaves this script; only counts do.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { duplicateClusters } from "../src/core/similarity.js";
import { timingBursts } from "../src/core/timing.js";
import { foldConfusables } from "../src/core/confusables.js";
import { wilson } from "../src/core/report.js";
import { SIZE_BINS, VIEW_BINS, sizeBin } from "../src/core/baselines-bins.js";
import { rng, decayTimes, uniformTimes, viewed, browse } from "./baselines/nulls.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const DATA = arg("--data", process.env.RADAR_DATA || "../radar-data");
export const SEED = 20261021, DRAWS = 20, NULL_REPEATS = 3;
const FILE = join(DATA, "pheme", "prepared", "pheme-threads.jsonl");
const RAW = join(DATA, "pheme", "PHEME_veracity.tar.bz2");

const rate = (k, n) => ({ k, n, share: n ? Math.round((k / n) * 1000) / 1000 : null, ci: n ? wilson(k, n).map((x) => Math.round(x * 1000) / 1000) : null });
const iso = (t) => new Date(t * 1000).toISOString();

function load() {
  return readFileSync(FILE, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
    .map((t) => ({ ...t, replies: t.replies.filter((r) => r.user && Number.isFinite(r.t)) }));
}

// Per thread: does each sign fire, on the real thread and on its two nulls?
function perThread(threads) {
  const next = rng(SEED);
  const bins = Object.fromEntries(SIZE_BINS.map((b) => [b.id, { threads: 0, same: 0, burst: 0, burstDecay: 0, burstUniform: 0, nullRuns: 0 }]));
  let folded = 0, replies = 0, mixedWords = 0;
  for (const th of threads) {
    const n = th.replies.length, bin = sizeBin(n);
    if (!bin) continue;
    const B = bins[bin.id];
    B.threads++;
    const rows = th.replies.map((r, i) => ({ id: String(i), author: r.user, text: r.text, posted: iso(r.t) }));
    if (duplicateClusters(rows, { root: th.root }).length) B.same++;
    if (timingBursts(rows).length) B.burst++;
    const delays = th.replies.map((r) => Math.max(1, r.t - th.root.t));
    const span = Math.max(...th.replies.map((r) => r.t)) - Math.min(...th.replies.map((r) => r.t));
    for (let k = 0; k < NULL_REPEATS; k++) {
      B.nullRuns++;
      if (timingBursts(decayTimes(delays, th.root.t, next)).length) B.burstDecay++;
      if (timingBursts(uniformTimes(n, th.root.t, Math.max(span, 60), next)).length) B.burstUniform++;
    }
    for (const r of th.replies) {
      replies++;
      const f = foldConfusables(r.text);
      if (f !== r.text) { folded++; mixedWords += [...r.text.matchAll(/[\p{L}\p{M}]+/gu)].filter((m) => /[\p{Script=Cyrillic}\p{Script=Greek}]/u.test(m[0]) && /\p{Script=Latin}/u.test(m[0])).length; }
    }
  }
  return { bins, fold: { replies, changed: folded, mixedScriptWords: mixedWords } };
}

function summarise(threads) {
  const { bins, fold } = perThread(threads);
  const out = { same: {}, burst: {}, burstDecayNull: {}, burstUniformNull: {} };
  for (const b of SIZE_BINS) {
    const B = bins[b.id];
    out.same[b.id] = rate(B.same, B.threads);
    out.burst[b.id] = rate(B.burst, B.threads);
    out.burstDecayNull[b.id] = rate(B.burstDecay, B.nullRuns);
    out.burstUniformNull[b.id] = rate(B.burstUniform, B.nullRuns);
  }
  // Browsing: a viewer opens W threads on one news event; how often does a thread they open hold a
  // pair seen together in two or more of the others, and how many pairs share three or more?
  const next = rng(SEED + 1), byEvent = new Map();
  for (const t of threads) { if (!byEvent.has(t.event)) byEvent.set(t.event, []); byEvent.get(t.event).push(t); }
  out.together = {}; out.togetherNull = {}; out.pairs3 = {}; out.pairs3Null = {}; out.echo = {};
  for (const v of VIEW_BINS) {
    const acc = { real: [0, 0], shuf: [0, 0], pairs: [], pairsNull: [], echo: [0, 0] };
    for (const [, list] of byEvent) {
      if (list.length < v.w * 2) continue;
      for (let d = 0; d < DRAWS; d++) {
        const sample = viewed(list, v.w, next);
        const r = browse(sample, next);
        acc.real[0] += r.real.hit; acc.real[1] += r.real.n; acc.shuf[0] += r.shuffled.hit; acc.shuf[1] += r.shuffled.n;
        acc.pairs.push(r.real.pairs3); acc.pairsNull.push(r.shuffled.pairs3); acc.echo[0] += r.echo.hit; acc.echo[1] += r.echo.n;
      }
    }
    const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
    out.together[v.id] = rate(...acc.real); out.togetherNull[v.id] = rate(...acc.shuf); out.echo[v.id] = rate(...acc.echo);
    out.pairs3[v.id] = { median: med(acc.pairs), draws: acc.pairs.length }; out.pairs3Null[v.id] = { median: med(acc.pairsNull), draws: acc.pairsNull.length };
  }
  return { ...out, fold };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (!existsSync(FILE)) { console.error(`missing ${FILE}: run python -I scripts/eval/prep-pheme.py <data>/pheme`); process.exit(1); }
  const threads = load();
  const S = summarise(threads);
  const sha = existsSync(RAW) ? createHash("sha256").update(readFileSync(RAW)).digest("hex") : null;
  const source = { name: "PHEME rumour and non-rumour threads (Zubiaga et al.)", url: "https://doi.org/10.6084/m9.figshare.6392078.v1", licence: "CC BY 4.0", years: "2014 to 2015", site: "Twitter", threads: threads.length, sha256: sha };
  const results = { generated: (process.env.RADAR_BUILT || new Date().toISOString().slice(0, 10)), seed: SEED, draws: DRAWS, nullRepeats: NULL_REPEATS, source, sizeBins: SIZE_BINS, viewBins: VIEW_BINS, ...S };
  writeFileSync(join(root, "project-docs/evidence/baseline-results.json"), JSON.stringify(results, null, 1) + "\n");
  const keep = { generated: results.generated, source: { name: "PHEME", site: source.site, years: source.years, licence: source.licence, threads: source.threads },
    same: S.same, burst: S.burst, burstDecayNull: S.burstDecayNull, together: S.together, togetherNull: S.togetherNull, pairs3: S.pairs3, pairs3Null: S.pairs3Null, echo: S.echo };
  writeFileSync(join(root, "src/core/baselines-data.js"), `// Generated by scripts/baselines.mjs from project-docs/evidence/baseline-results.json. Do not edit.\nexport const BASELINES = ${JSON.stringify(keep)};\n`);
  console.log(JSON.stringify(S, null, 1));
}
