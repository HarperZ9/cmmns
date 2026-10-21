// Derives the Hebrew, Turkish, Korean, Japanese, Persian, Indonesian and Hindi word lists from
// human-labelled corpora, reading the dev split only. Nobody types the lists; this script writes
// them to src/core/lexicon-derived.js and the per-term dev statistics to
// project-docs/evidence/derived-lexicon.json. Method: project-docs/EVALUATION.md ("Derived word lists").
//   node scripts/derive-lexicon.mjs [--data D:/radar-data] [--only ko] [--no-write]
// 1. Candidates: words, word pairs and (Korean, Japanese) character n-grams, from rhetoric-derived.js.
// 2. Weighted log-odds with an informative prior, group hate against everything else, once pooled
//    and once per labelled target, so every target gets the same share of candidates.
// 3. Drop group names, terms that fire on other languages' text, and terms under the dev precision bar.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DERIVED_CODES, prepDerived, candidates, compileTerms } from "../src/core/rhetoric-derived.js";
import { loadLanguage, loadForeign, loadReference, DERIVED_PREPARED, EVAL_ONLY } from "./eval/derived-corpora.mjs";
import { GROUP_NAMES, NEUTRAL_NAMES } from "./eval/derived-groups.mjs";
import { docFreq, logOdds, A0 } from "./eval/logodds.mjs";
import { rate } from "./eval/metrics.mjs";
import { SEED } from "./eval/corpora.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, dflt) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : dflt; };
const DATA = arg("--data", process.env.RADAR_DATA || "D:/radar-data");
const ONLY = arg("--only", null);
const WRITE = !process.argv.includes("--no-write");
const SHOW = process.argv.includes("--show");

// Tuned on dev. Z_MIN: one-sided p < 0.001. The bar: at least BAR_HITS dev items carry the term and
// the Wilson lower bound of the share labelled group hate is at least BAR_LOW and at least BAR_LIFT
// above the language's base rate, so a corpus where most items are hateful cannot pass common words.
export const PARAMS = { Z_MIN: 3.1, MIN_POS: 5, PER_CONTRAST: 80, MIN_TARGET: 30, BAR_HITS: 5, BAR_LOW: 0.6, BAR_LIFT: 0.35,
  FOREIGN_MAX: 2, REF_MAX: 0.0005, MAX_TERMS: 160, A0 };

function prepare() {
  const dir = join(DATA, "prepared");
  if (!DERIVED_PREPARED.every((f) => existsSync(join(dir, f)))) {
    execFileSync("python", ["-I", join(root, "scripts/eval/prep-derived.py"), DATA], { stdio: "inherit" });
  }
  return dir;
}

// Dev items of one language, prepared once, with the label the contrast uses.
function devDocs(dir, code) {
  const items = loadLanguage(dir, code).filter((i) => i.split === "dev" && !EVAL_ONLY.includes(i.corpus));
  const basis = items.some((i) => i.gold.group != null) ? "group" : "hostile";
  return { basis, docs: items.map((i) => {
    const p = prepDerived(code, i.text);
    return { item: i, p, c: candidates(code, p), y: basis === "group" ? i.gold.group : i.gold.hostile };
  }).filter((d) => d.y != null) };
}

// The pooled contrast, then one per target with at least MIN_TARGET positive items.
function contrasts(docs) {
  const neg = docFreq(docs.filter((d) => !d.y).map((d) => d.c)), bg = docFreq(docs.map((d) => d.c));
  const out = [{ name: "all", rows: logOdds(docFreq(docs.filter((d) => d.y).map((d) => d.c)), neg, bg, PARAMS.MIN_POS) }];
  const targets = new Map();
  for (const d of docs) if (d.y) for (const t of d.item.targets) targets.set(t, [...(targets.get(t) || []), d]);
  for (const [name, list] of [...targets].sort()) {
    if (list.length >= PARAMS.MIN_TARGET) out.push({ name, rows: logOdds(docFreq(list.map((d) => d.c)), neg, bg, PARAMS.MIN_POS) });
  }
  return out.map((c) => ({ name: c.name, rows: c.rows.filter((r) => r.z >= PARAMS.Z_MIN).slice(0, PARAMS.PER_CONTRAST) }));
}

const core = (t) => t.replace(/\*$/, "").split(" ")[0];
function hitsOf(code, term, texts) {
  const re = compileTerms(code, [term]), c = core(term);
  let n = 0;
  for (const s of texts) if (s.includes(c) && re.test(s)) n++;
  return n;
}

function isGroupName(code, term) {
  const t = prepDerived(code, term.replace(/\*$/, ""));
  return [...(GROUP_NAMES[code] || []), ...(NEUTRAL_NAMES[code] || [])].map((g) => prepDerived(code, g)).some((g) => g.includes(t) || t.includes(g));
}

// Dev precision of one term against the contrast's label.
function devPrecision(code, term, docs) {
  const re = compileTerms(code, [term]), c = core(term);
  let k = 0, n = 0;
  for (const d of docs) if (d.p.includes(c) && re.test(d.p)) { n++; if (d.y) k++; }
  return rate(k, n);
}

function select(code, docs, foreign, cons, ref) {
  const base = docs.filter((d) => d.y).length / docs.length, bar = Math.max(PARAMS.BAR_LOW, base + PARAMS.BAR_LIFT);
  const kept = new Map(), seen = new Set(), dropped = { group: 0, foreign: 0, reference: 0, bar: 0 };
  for (const con of cons) {
    for (const r of con.rows) {
      if (seen.has(r.term)) continue;
      seen.add(r.term);
      if (isGroupName(code, r.term)) { dropped.group++; continue; }
      const fx = hitsOf(code, r.term, foreign);
      if (fx > PARAMS.FOREIGN_MAX) { dropped.foreign++; continue; }
      const rx = ref.length ? hitsOf(code, r.term, ref) / ref.length : 0;
      if (rx > PARAMS.REF_MAX) { dropped.reference++; continue; }
      const p = devPrecision(code, r.term, docs);
      if (SHOW) console.log(`   ${con.name} ${r.term} z=${r.z.toFixed(1)} dev ${p.k}/${p.n} low ${p.ci && p.ci[0]} foreign ${fx}`);
      if (p.n < PARAMS.BAR_HITS || p.ci[0] < bar) { dropped.bar++; continue; }
      kept.set(r.term, { term: r.term, contrast: con.name, z: +r.z.toFixed(2), dev: p, foreign: fx });
    }
  }
  return { kept: dedupe([...kept.values()]), dropped, bar: +bar.toFixed(3) };
}

// A term that contains a kept shorter term adds nothing: the shorter one already matches there.
// Then take terms round-robin across contrasts, so no target fills the list alone.
function dedupe(rows) {
  const byLen = [...rows].sort((a, b) => core(a.term).length - core(b.term).length || b.z - a.z), keep = [];
  for (const r of byLen) if (!keep.some((k) => r.term.includes(k.term.replace(/\*$/, "")))) keep.push(r);
  const groups = new Map();
  for (const r of keep.sort((a, b) => b.z - a.z)) groups.set(r.contrast, [...(groups.get(r.contrast) || []), r]);
  const out = [], queues = [...groups.values()];
  while (out.length < PARAMS.MAX_TERMS && queues.some((q) => q.length)) for (const q of queues) if (q.length && out.length < PARAMS.MAX_TERMS) out.push(q.shift());
  return out;
}

function deriveLanguage(dir, code, foreignAll) {
  const { basis, docs } = devDocs(dir, code);
  const foreign = foreignAll.filter((f) => f.lang !== code).map((f) => prepDerived(code, f.text));
  const cons = contrasts(docs);
  const ref = loadReference(dir, code).map((t) => prepDerived(code, t));
  const { kept, dropped, bar } = select(code, docs, foreign, cons, ref);
  const pos = docs.filter((d) => d.y).length;
  console.log(`${code}: basis ${basis}, dev ${docs.length} items (${pos} positive), contrasts ${cons.map((c) => `${c.name}:${c.rows.length}`).join(" ")}`);
  console.log(`   bar ${bar}; kept ${kept.length}; dropped as group name ${dropped.group}, on other languages ${dropped.foreign}, common in general text ${dropped.reference}, under the bar ${dropped.bar}`);
  return { basis, bar, dev: { items: docs.length, positive: pos }, contrasts: cons.map((c) => ({ name: c.name, candidates: c.rows.length })),
    dropped, terms: kept };
}

const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

function writeOut(dir, results) {
  const lex = Object.fromEntries(Object.entries(results).map(([c, r]) => [c, { basis: r.basis, slur: r.terms.map((t) => t.term).sort() }]));
  const p = join(root, "src/core/lexicon-derived.js");
  const body = "export const DERIVED = {\n" + Object.entries(lex).map(([c, r]) => `  ${c}: ${JSON.stringify(r)},`).join("\n") + "\n};";
  writeFileSync(p, readFileSync(p, "utf8").replace(/(\/\/ derived:begin[^\n]*\n)[\s\S]*?(\/\/ derived:end)/, (_, a, b) => `${a}${body}\n${b}`));
  const inputs = DERIVED_PREPARED.map((f) => ({ file: "prepared/" + f, sha256: sha(join(dir, f)) }));
  writeFileSync(join(root, "project-docs/evidence/derived-lexicon.json"),
    JSON.stringify({ generated: "2026-10-21", split: "dev", seed: SEED, params: PARAMS, inputs, languages: results }, null, 1) + "\n");
  console.log("wrote src/core/lexicon-derived.js and project-docs/evidence/derived-lexicon.json");
}

function main() {
  const dir = prepare();
  const codes = ONLY ? [ONLY] : DERIVED_CODES;
  // Other languages' text: the existing corpora, plus each derived language's own dev text for the others.
  const foreignAll = [...loadForeign(dir).map((f) => ({ lang: "xx", text: f.text })),
    ...DERIVED_CODES.flatMap((c) => loadLanguage(dir, c).filter((i) => i.split === "dev").map((i) => ({ lang: c, text: i.text })))];
  const results = {};
  for (const code of codes) results[code] = deriveLanguage(dir, code, foreignAll);
  if (WRITE && !ONLY) writeOut(dir, results);
  if (SHOW) for (const [c, r] of Object.entries(results)) console.log(c, r.terms.map((t) => `${t.term}(${t.contrast} ${t.dev.k}/${t.dev.n})`).join(" "));
}

main();
