// Reproduces the persuasion-technique numbers in project-docs/EVALUATION.md from the PTC corpus.
//   node scripts/eval-persuasion.mjs [--data D:/radar-data] [--split test|dev] [--cues]
// The corpus is downloaded once by hand (project-docs/evidence/CORPORA.md). Cue lists are tuned on
// --split dev only (--cues prints per-cue figures there); the committed numbers are --split test,
// which writes project-docs/evidence/persuasion-results.json and the persuasion rows of measured.js.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPtc, PTC_ARCHIVE } from "./eval/ptc.mjs";
import { evaluatePtc } from "./eval/persuasion-eval.mjs";
import { SEED } from "./eval/corpora.mjs";
import { writePersuasionRows } from "./eval/summarise-persuasion.mjs";
import { SHIP_LOW } from "../src/core/persuasion.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, dflt) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : dflt; };
const DATA = arg("--data", process.env.RADAR_DATA || "D:/radar-data");
const SPLIT = arg("--split", "test");
const WRITE = SPLIT === "test" && !process.argv.includes("--no-write");
const pct = (r) => (r && r.n ? `${(r.value * 100).toFixed(1)}% (${r.k}/${r.n}, ${(r.ci[0] * 100).toFixed(1)} to ${(r.ci[1] * 100).toFixed(1)})` : "n/a");

function main() {
  const items = loadPtc(DATA).filter((i) => i.split === SPLIT);
  const r = evaluatePtc(items);
  console.log(`== PTC (${SPLIT}): ${r.articles} articles`);
  for (const [t, x] of Object.entries(r.techniques)) {
    const ship = x.precision.n && x.precision.ci[0] >= SHIP_LOW ? "SHIP" : "off ";
    console.log(`  ${ship} ${t.padEnd(20)} P ${pct(x.precision)}  P(any) ${pct(x.precisionAnyTechnique)}  R ${pct(x.recall)}  chance ${pct(x.chance)}`);
  }
  if (process.argv.includes("--cues")) {
    if (SPLIT !== "dev") throw new Error("--cues is for tuning, on --split dev only");
    for (const [k, c] of Object.entries(r.cues).sort((a, b) => b[1].n - a[1].n)) console.log(`    ${String(c.tp).padStart(3)}/${String(c.n).padEnd(3)} ${k}`);
  }
  if (!WRITE) return;
  const archive = join(DATA, PTC_ARCHIVE);
  const out = { generated: "2026-10-21", split: SPLIT, seed: SEED, shipLow: SHIP_LOW,
    corpus: "PTC v2 (SemEval-2020 Task 11), training articles split by article",
    input: { file: PTC_ARCHIVE, sha256: createHash("sha256").update(readFileSync(archive)).digest("hex") },
    articles: r.articles, techniques: r.techniques };
  writeFileSync(join(root, "project-docs/evidence/persuasion-results.json"), JSON.stringify(out, null, 1) + "\n");
  writePersuasionRows(join(root, "src/core/measured.js"), out);
  console.log("wrote project-docs/evidence/persuasion-results.json and the persuasion rows of src/core/measured.js");
}

main();
