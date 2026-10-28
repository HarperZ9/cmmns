// Adds the signal detection measures (scripts/eval/sdt.mjs) to the committed evaluation results
// without the corpora: it reads the confusion matrices already in eval-results.json, writes the
// "sdt" block back, rewrites src/core/measured.js and the generated section of EVALUATION.md.
// scripts/eval.mjs does the same on a full run. Deterministic: the same results give the same bytes.
//   node scripts/eval-sdt.mjs [--check]
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { sdtBlock } from "./eval/sdt.mjs";
import { writeMeasured, ENGLISH } from "./eval/summarise.mjs";
import { spliceSdt } from "./eval/sdt-report.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const RESULTS = join(root, "project-docs/evidence/eval-results.json");
const EVAL_MD = join(root, "project-docs/EVALUATION.md");

function main() {
  const j = JSON.parse(readFileSync(RESULTS, "utf8"));
  const { inputs, corpora, duplicatesDetail, mismatchDetail, sdt: old, ...summary } = j;
  const sdt = sdtBlock(corpora, ENGLISH);
  const md = readFileSync(EVAL_MD, "utf8"), nextMd = spliceSdt(md, sdt);
  if (process.argv.includes("--check")) {
    const same = JSON.stringify(old) === JSON.stringify(sdt) && md === nextMd;
    console.log(same ? "signal detection figures are current" : "signal detection figures are stale; run node scripts/eval-sdt.mjs");
    process.exitCode = same ? 0 : 1;
    return;
  }
  writeFileSync(RESULTS, JSON.stringify({ ...j, sdt }, null, 1) + "\n");
  writeMeasured(join(root, "src/core/measured.js"), summary, sdt);
  writeFileSync(EVAL_MD, nextMd);
  console.log("wrote the sdt block of eval-results.json, src/core/measured.js and EVALUATION.md");
}

main();
