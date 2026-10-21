// Writes the persuasion rows of src/core/measured.js: the block between PERSUASION_BEGIN and
// PERSUASION_END. scripts/eval.mjs regenerates the rest of the file and keeps this block as is.

import { readFileSync, writeFileSync } from "node:fs";

export const PERSUASION_BEGIN = "// persuasion:begin (scripts/eval-persuasion.mjs)";
export const PERSUASION_END = "// persuasion:end";
const SOURCE = "Propaganda Techniques Corpus (SemEval-2020 Task 11), news articles, held-out split; see project-docs/EVALUATION.md";

export function persuasionRows(results) {
  const rows = {};
  for (const [t, x] of Object.entries(results.techniques)) {
    const p = x.precision;
    if (!p.n) continue;
    rows[t] = { precision: p.value, low: p.ci[0], high: p.ci[1], n: p.n, split: results.split, recall: x.recall.value,
      chance: x.chance.value, date: results.generated, source: SOURCE };
  }
  return rows;
}

export function persuasionBlock(rows) {
  const body = Object.entries(rows).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join("\n");
  return `${PERSUASION_BEGIN}\nexport const MEASURED_PERSUASION = {\n${body}\n};\n${PERSUASION_END}`;
}

// The current block in a measured.js source, or an empty one.
export function currentBlock(src) {
  const a = src.indexOf(PERSUASION_BEGIN), b = src.indexOf(PERSUASION_END);
  return a >= 0 && b > a ? src.slice(a, b + PERSUASION_END.length) : persuasionBlock({});
}

export function writePersuasionRows(path, results) {
  const src = readFileSync(path, "utf8");
  const block = persuasionBlock(persuasionRows(results));
  if (!src.includes(PERSUASION_BEGIN)) throw new Error("measured.js has no persuasion block; run scripts/eval.mjs once first");
  writeFileSync(path, src.replace(currentBlock(src), block));
}
