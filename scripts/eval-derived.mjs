// Measures the derived word lists (scripts/derive-lexicon.mjs) and decides which languages ship.
//   node scripts/eval-derived.mjs [--data D:/radar-data] [--split test|dev] [--no-write]
// Tuning reads --split dev. The committed numbers are --split test, read once, written to
// project-docs/evidence/derived-results.json, src/core/measured-langs.js (derived block) and the
// ship list in src/core/lexicon-derived.js.
// The gate, fixed before the test split was read: a language ships when its list was derived
// against a group-hate label, at least MIN_N of its signs fall on labelled natural text, and the
// Wilson lower bound of their precision against the corpus's hostile label is at least GATE_LOW.
// Every other language is held back: its list stays in the repository and never runs on a reply.

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { score } from "../src/core/rhetoric.js";
import { DERIVED_CODES, markerCode } from "../src/core/rhetoric-derived.js";
import { DERIVED } from "../src/core/lexicon-derived.js";
import { MIN_N } from "../src/core/measured-langs.js";
import { loadLanguage, GATE_POOL } from "./eval/derived-corpora.mjs";
import { SEED } from "./eval/corpora.mjs";
import { rate } from "./eval/metrics.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, dflt) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : dflt; };
const DATA = arg("--data", process.env.RADAR_DATA || "D:/radar-data");
const SPLIT = arg("--split", "test");
const WRITE = !process.argv.includes("--no-write") && SPLIT === "test";
export const GATE_LOW = 0.7;
const NAMES = { he: "Hebrew", tr: "Turkish", ko: "Korean", ja: "Japanese", fa: "Persian", id: "Indonesian", hi: "Hindi" };
const SOURCE = { olah: "OLaH", "offenseval-tr": "OffensEval 2020 Turkish", "hatemap-tr": "TurkishHateMap", kmhas: "K-MHaS",
  beep: "BEEP!", llmjp: "LLM-jp Toxicity v2", "inspection-ja": "inspection-ai Japanese toxicity", "persian-off": "Persian Offensive Language",
  indodiscourse: "IndoDiscourse", idhsd: "IDHSD", "textdetox-hi": "TextDetox", "mhc-hi": "HateCheck (templates)" };
const pct = (r) => (r && r.n ? `${(r.value * 100).toFixed(1)}% (${r.k}/${r.n}, ${(r.ci[0] * 100).toFixed(1)} to ${(r.ci[1] * 100).toFixed(1)})` : "n/a");

// One row per item: did the language's own derived list put a slur sign on it?
function rowsOf(code, items) {
  const own = markerCode(code);
  return items.map((item) => ({ item, hit: score(item.text, { derived: [code] }).markers.some((m) => m.lang === own && m.family === "slur") }));
}

function counts(rows, gold) {
  let tp = 0, fp = 0, fn = 0;
  for (const r of rows) {
    const g = gold(r.item);
    if (g == null) continue;
    if (r.hit && g) tp++; else if (r.hit) fp++; else if (g) fn++;
  }
  return { precision: rate(tp, tp + fp), recall: rate(tp, tp + fn) };
}

// Recall per labelled target: the share of group-hate items aimed at that target that got a sign.
// Precision has no target split, since items without hate carry no target.
function byTarget(rows) {
  const names = [...new Set(rows.flatMap((r) => r.item.targets))].sort();
  return Object.fromEntries(names.map((t) => [t, { recall: counts(rows.filter((r) => r.item.targets.includes(t)), () => true).recall }]));
}

function corpusResult(rows) {
  const hits = rows.filter((r) => r.hit).length;
  return { n: rows.length, hits, hostile: counts(rows, (i) => i.gold.hostile), group: counts(rows, (i) => i.gold.group), targets: byTarget(rows) };
}

function evaluateLanguage(dir, code) {
  const items = loadLanguage(dir, code).filter((i) => i.split === SPLIT);
  const corpora = {};
  for (const c of [...new Set(items.map((i) => i.corpus))]) corpora[c] = corpusResult(rowsOf(code, items.filter((i) => i.corpus === c)));
  const pool = GATE_POOL[code].filter((c) => corpora[c]);
  const k = pool.reduce((a, c) => a + corpora[c].hostile.precision.k, 0), n = pool.reduce((a, c) => a + corpora[c].hostile.precision.n, 0);
  const gate = rate(k, n), basis = (DERIVED[code] || {}).basis || "none", terms = ((DERIVED[code] || {}).slur || []).length;
  const reason = !terms ? "no term cleared the dev bar" : basis !== "group" ? "the corpora label offensive-or-not only, not group hate"
    : n < MIN_N ? `only ${n} signs on labelled text` : gate.ci[0] < GATE_LOW ? `lower bound ${gate.ci[0]} under ${GATE_LOW}` : null;
  return { code, terms, basis, gate, ship: reason === null, reason, sources: pool.map((c) => SOURCE[c]).join(" and "), corpora };
}

function print(r) {
  console.log(`\n== ${NAMES[r.code]} (${SPLIT}): ${r.terms} terms, basis ${r.basis}; pooled P(hostile) ${pct(r.gate)}; ${r.ship ? "SHIPS" : "held back: " + r.reason}`);
  for (const [c, x] of Object.entries(r.corpora)) {
    console.log(`  ${c.padEnd(14)} items ${String(x.n).padStart(6)} hits ${String(x.hits).padStart(5)}  P(hostile) ${pct(x.hostile.precision)}  P(group) ${pct(x.group.precision)}  R(group) ${pct(x.group.recall)}`);
    for (const [t, y] of Object.entries(x.targets)) console.log(`      target ${t.padEnd(18)} R ${pct(y.recall)}`);
  }
}

function writeOut(results) {
  writeFileSync(join(root, "project-docs/evidence/derived-results.json"),
    JSON.stringify({ generated: "2026-10-21", split: SPLIT, seed: SEED, gate: { low: GATE_LOW, minN: MIN_N }, languages: results }, null, 1) + "\n");
  const rows = Object.fromEntries(results.map((r) => [markerCode(r.code), { precision: r.gate.value, low: r.gate.ci ? r.gate.ci[0] : null,
    high: r.gate.ci ? r.gate.ci[1] : null, n: r.gate.n, split: "test", sources: r.sources, ship: r.ship, ...(r.ship ? {} : { reason: r.reason }) }]));
  const body = "export const MEASURED_DERIVED = {\n" + Object.entries(rows).map(([c, r]) => `  "${c}": ${JSON.stringify(r)},`).join("\n") + "\n};";
  const mp = join(root, "src/core/measured-langs.js");
  writeFileSync(mp, readFileSync(mp, "utf8").replace(/(\/\/ derived:begin[^\n]*\n)[\s\S]*?(\/\/ derived:end)/, (_, a, b) => `${a}${body}\n${b}`));
  const ship = `export const DERIVED_SHIP = ${JSON.stringify(results.filter((r) => r.ship).map((r) => r.code))};`;
  const lp = join(root, "src/core/lexicon-derived.js");
  writeFileSync(lp, readFileSync(lp, "utf8").replace(/(\/\/ ship:begin[^\n]*\n)[\s\S]*?(\/\/ ship:end)/, (_, a, b) => `${a}${ship}\n${b}`));
  console.log("\nwrote project-docs/evidence/derived-results.json, src/core/measured-langs.js and the ship list");
}

function main() {
  const dir = join(DATA, "prepared");
  const results = DERIVED_CODES.map((code) => evaluateLanguage(dir, code));
  results.forEach(print);
  if (WRITE) writeOut(results);
}

main();
