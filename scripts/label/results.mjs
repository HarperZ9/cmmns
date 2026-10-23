#!/usr/bin/env node
// Read a dc-label/1 labels file and write the results JSON for the campaign-lens labelling run.
//   node scripts/label/results.mjs <labels.jsonl> [--out results.json] [--min-stratum 30]
// Local files only. The labels file stays outside the repository (project-docs/LABELLING.md);
// the results file holds counts, rates and intervals, and can be committed.
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { parseLabels } from "./format.mjs";
import { results } from "./stats.mjs";

export function run(argv) {
  const args = [...argv];
  const take = (flag) => { const i = args.indexOf(flag); return i < 0 ? null : args.splice(i, 2)[1]; };
  const out = take("--out");
  const min = take("--min-stratum");
  const [file] = args;
  if (!file) throw new Error("usage: node scripts/label/results.mjs <labels.jsonl> [--out results.json] [--min-stratum 30]");
  const r = results(parseLabels(readFileSync(file, "utf8")), min ? { minStratum: Number(min) } : {});
  const json = JSON.stringify(r, null, 2) + "\n";
  if (out) writeFileSync(out, json);
  return { r, json, out };
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  try {
    const { r, json, out } = run(process.argv.slice(2));
    if (!out) process.stdout.write(json);
    else console.log(`${r.cases} cases, kappa ${r.agreement.kappa === null ? "n/a" : r.agreement.kappa.toFixed(2)}, written to ${out}`);
  } catch (e) {
    console.error(`results: ${e.message}`);
    process.exit(1);
  }
}
