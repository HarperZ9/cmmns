// Reproduces every number in project-docs/EVALUATION.md from the downloaded corpora.
//   node scripts/eval.mjs [--data <dir>] [--split test|dev] [--no-write]
// The corpora are downloaded once by hand (project-docs/evidence/CORPORA.md) and flattened by
// scripts/eval/prep.py, which this script runs when the prepared files are missing. It records the
// SHA-256 of every raw and prepared input, so a changed download shows up in the results file.
// Tuning happens on --split dev only; the committed numbers are --split test.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LOADERS, SEED } from "./eval/corpora.mjs";
import { evaluateCorpus } from "./eval/rhetoric-eval.mjs";
import { evaluateDuplicates, evaluateMismatch } from "./eval/synthetic.mjs";
import { familySummary, writeMeasured } from "./eval/summarise.mjs";
import { EXTREME_AT } from "../src/core/rhetoric.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, dflt) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : dflt; };
const DATA = arg("--data", process.env.RADAR_DATA || "../radar-data");
const SPLIT = arg("--split", "test");
const WRITE = !process.argv.includes("--no-write") && SPLIT === "test";

const RAW = ["mhs/measuring-hate-speech.parquet", "hatexplain/dataset.json", "civil/test.parquet",
  "mlma/hate_speech_mlma.zip"];
const PREPARED = ["mhs.jsonl", "hatexplain.jsonl", "civil.jsonl", "mlma-fr.jsonl"];
const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

function prepare() {
  const prep = join(DATA, "prepared");
  if (PREPARED.every((f) => existsSync(join(prep, f)))) return prep;
  console.log("preparing corpora with scripts/eval/prep.py");
  execFileSync("python", ["-I", join(root, "scripts/eval/prep.py"), DATA], { stdio: "inherit" });
  return prep;
}

const pct = (r) => (r && r.n ? `${(r.value * 100).toFixed(1)}% (${r.k}/${r.n}, ${(r.ci[0] * 100).toFixed(1)} to ${(r.ci[1] * 100).toFixed(1)})` : "n/a");

function printCorpus(name, r) {
  console.log(`\n== ${name} (${SPLIT}): ${r.n} items, hostile prevalence ${pct(r.prevalence)}`);
  for (const [f, x] of Object.entries(r.families)) {
    const s = x.againstSpecific;
    console.log(`  ${f.padEnd(13)} P(hostile) ${pct(x.againstHostile.precision)}` + (s ? `  P(${f}) ${pct(s.precision)}  R(${f}) ${pct(s.recall)}` : ""));
  }
  console.log(`  extreme       P(severe) ${pct(r.extreme.againstSevere.precision)}  R(severe) ${pct(r.extreme.againstSevere.recall)}`);
  for (const [k, s] of Object.entries(r.sides)) {
    console.log(`  side ${k.padEnd(12)} R right ${pct(s["right-targets"].recall)} | R left ${pct(s["left-targets"].recall)} | P right ${pct(s["right-targets"].precision)} | P left ${pct(s["left-targets"].precision)}${s.gap.recall || s.gap.precision ? "  GAP" : ""}`);
  }
}

// Recall and precision of the strong families on text aimed at each side's usual targets.
function sidesSummary(corpora) {
  const out = {};
  for (const c of ["mhs", "hatexplain"]) {
    const s = corpora[c].sides.strong;
    out[c] = { right: { recall: s["right-targets"].recall, precision: s["right-targets"].precision },
      left: { recall: s["left-targets"].recall, precision: s["left-targets"].precision }, gap: s.gap };
  }
  return out;
}

function main() {
  const prep = prepare();
  const inputs = [...RAW.map((f) => ({ file: f, sha256: existsSync(join(DATA, f)) ? sha(join(DATA, f)) : null })),
    ...PREPARED.map((f) => ({ file: "prepared/" + f, sha256: sha(join(prep, f)) }))];
  const corpora = {};
  for (const [name, load] of Object.entries(LOADERS)) {
    corpora[name] = evaluateCorpus(load(prep).filter((i) => i.split === SPLIT));
    printCorpus(name, corpora[name]);
  }
  const duplicates = evaluateDuplicates(), mismatch = evaluateMismatch();
  console.log(`\nduplicates (SYNTHETIC) P ${pct(duplicates.precision)} R ${pct(duplicates.recall)}`);
  console.log(`mismatch (SYNTHETIC)   P ${pct(mismatch.precision)} R ${pct(mismatch.recall)}`);
  const extreme = Object.fromEntries(Object.entries(corpora).map(([c, r]) => [c, r.extreme.againstSevere]));
  const summary = { generated: "2026-10-21", split: SPLIT, seed: SEED, extremeAt: EXTREME_AT, families: familySummary(corpora),
    extreme: { precision: extreme.mhs.precision, recall: extreme.mhs.recall, against: "mhs: hate_speech_score > 0.5", byCorpus: Object.fromEntries(Object.entries(extreme).map(([c, x]) => [c, x.precision])) },
    sides: sidesSummary(corpora),
    duplicates: { synthetic: true, precision: duplicates.precision, recall: duplicates.recall },
    mismatch: { synthetic: true, precision: mismatch.precision, recall: mismatch.recall } };
  if (!WRITE) return;
  writeFileSync(join(root, "project-docs/evidence/eval-results.json"),
    JSON.stringify({ ...summary, inputs, corpora, duplicatesDetail: duplicates, mismatchDetail: mismatch }, null, 1) + "\n");
  writeMeasured(join(root, "src/core/measured.js"), summary);
  console.log("\nwrote project-docs/evidence/eval-results.json and src/core/measured.js");
}

main();
