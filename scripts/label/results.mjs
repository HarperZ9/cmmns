#!/usr/bin/env node
// Score a labelling run. Every file must match the hash the ledger recorded for it, in the ledger's
// order (scripts/label/ledger.mjs): a labels file that was not hashed before the detector output
// was joined is refused.
//   node scripts/label/results.mjs --ledger ledger.jsonl --cases cases.jsonl --a labels-A.jsonl
//     --b labels-B.jsonl --resolution resolution.jsonl --lens lens.jsonl
//     [--spot-check spot-check.json] [--min-stratum 30] [--out results.json]
// Local files only. The results file holds counts, rates and intervals, and can be committed.
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { parseRows } from "./format.mjs";
import { verifyFiles } from "./ledger.mjs";
import { results } from "./stats.mjs";

const FILES = { cases: "cases", a: "labels-A", b: "labels-B", resolution: "resolution", lens: "lens" };
const KIND = { cases: "case", a: "label", b: "label", resolution: "resolution", lens: "lens" };

function options(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith("--")) throw new Error(`unexpected argument ${argv[i]}`);
    o[argv[i].slice(2)] = argv[i + 1];
  }
  return o;
}

export function run(argv) {
  const o = options(argv);
  if (!o.ledger) throw new Error("usage: node scripts/label/results.mjs --ledger L --cases C --a A --b B --resolution R --lens D [--spot-check S] [--out F]");
  const text = {};
  for (const [flag, ev] of Object.entries(FILES)) {
    if (!o[flag]) throw new Error(`--${flag} is required`);
    text[ev] = readFileSync(o[flag], "utf8");
  }
  verifyFiles(readFileSync(o.ledger, "utf8"), text);
  const rows = Object.fromEntries(Object.entries(FILES).map(([flag, ev]) => {
    try { return [flag, parseRows(text[ev], KIND[flag])]; } catch (e) { throw new Error(`${o[flag]}: ${e.message}`); }
  }));
  const spotCheck = o["spot-check"] ? JSON.parse(readFileSync(o["spot-check"], "utf8")) : null;
  const r = results({ ...rows, spotCheck }, o["min-stratum"] ? { minStratum: Number(o["min-stratum"]) } : {});
  const json = JSON.stringify(r, null, 2) + "\n";
  if (o.out) writeFileSync(o.out, json);
  return { r, json, out: o.out };
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  try {
    const { r, json, out } = run(process.argv.slice(2));
    if (!out) process.stdout.write(json);
    else console.log(`${r.statement} Written to ${out}.`);
  } catch (e) {
    console.error(`results: ${e.message}`);
    process.exit(1);
  }
}
