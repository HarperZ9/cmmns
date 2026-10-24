// Scores the pressure family of the reading lens (src/core/reading-pressure.js) on the labelled
// messages in project-docs/evidence/pressure/.
//   node scripts/eval-pressure.mjs                 dev set, per technique and per miss (for tuning)
//   node scripts/eval-pressure.mjs --split test    the held-out set, scored once; writes
//                                                  project-docs/evidence/pressure-results.json
// A hit is a message where the lens shows the technique (with inflection, as the window does).
// Precision: hits on messages labelled with that technique. Recall: labelled messages that got a hit.
// The test set was written by a separate model that never saw the cues (pressure/README.md).
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readPost } from "../src/core/reading.js";
import { PRESSURE_IDS, PRESSURE_TECHNIQUES } from "../src/core/reading-pressure.js";
import { wilson } from "../src/core/report.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const pct = (k, n) => (n ? `${Math.round((100 * k) / n)}% (${k}/${n}, ${wilson(k, n).map((x) => Math.round(x * 100)).join(" to ")})` : "no cases");
const rate = (k, n) => ({ k, n, value: n ? Math.round((1000 * k) / n) / 1000 : null, ci: n ? wilson(k, n).map((x) => Math.round(x * 1000) / 1000) : null });

export function loadSet(split) {
  const file = join(ROOT, "project-docs/evidence/pressure", `${split}.jsonl`);
  const raw = readFileSync(file);
  const rows = raw.toString("utf8").split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l));
  return { file, sha256: createHash("sha256").update(raw).digest("hex"), rows };
}

// The hash of the cue lists themselves, so a comment change does not count as new cues.
export const cueHash = () => createHash("sha256").update(JSON.stringify(PRESSURE_TECHNIQUES)).digest("hex");

// Which pressure techniques the lens shows on one message.
export function shownPressure(text, { inflection = true } = {}) {
  const on = new Set(PRESSURE_IDS);
  return new Set(readPost(text, { on, inflection }).filter((f) => f.shown && on.has(f.technique)).map((f) => f.technique));
}

export function score(rows, opts) {
  const per = Object.fromEntries(PRESSURE_IDS.map((t) => [t, { tp: 0, fp: 0, pos: 0, found: 0 }]));
  let controlsFlagged = 0, controls = 0, pressureFound = 0, pressure = 0;
  const misses = [];
  for (const r of rows) {
    const got = shownPressure(r.text, opts), want = new Set(r.labels || []);
    for (const t of PRESSURE_IDS) {
      const x = per[t];
      if (want.has(t)) x.pos++;
      if (got.has(t)) want.has(t) ? x.tp++ : x.fp++;
      if (want.has(t) && got.has(t)) x.found++;
      if (want.has(t) !== got.has(t)) misses.push({ id: r.id, technique: t, kind: want.has(t) ? "missed" : "false hit" });
    }
    if (r.kind === "control") { controls++; if (got.size) controlsFlagged++; } else { pressure++; if (got.size) pressureFound++; }
  }
  const techniques = Object.fromEntries(PRESSURE_IDS.map((t) => { const x = per[t]; return [t, { precision: rate(x.tp, x.tp + x.fp), recall: rate(x.found, x.pos) }]; }));
  const all = Object.values(per).reduce((a, x) => ({ tp: a.tp + x.tp, fp: a.fp + x.fp, found: a.found + x.found, pos: a.pos + x.pos }), { tp: 0, fp: 0, found: 0, pos: 0 });
  return { techniques, overall: { precision: rate(all.tp, all.tp + all.fp), recall: rate(all.found, all.pos) },
    messages: { pressureWithAHit: rate(pressureFound, pressure), controlsWithAHit: rate(controlsFlagged, controls) }, misses };
}

function print(split, r) {
  console.log(`== pressure lens, ${split} set`);
  for (const [t, x] of Object.entries(r.techniques)) console.log(`  ${t.padEnd(24)} P ${pct(x.precision.k, x.precision.n).padEnd(24)} R ${pct(x.recall.k, x.recall.n)}`);
  console.log(`  ${"all techniques".padEnd(24)} P ${pct(r.overall.precision.k, r.overall.precision.n).padEnd(24)} R ${pct(r.overall.recall.k, r.overall.recall.n)}`);
  console.log(`  pressure messages with any hit: ${pct(r.messages.pressureWithAHit.k, r.messages.pressureWithAHit.n)}`);
  console.log(`  control messages with any hit:  ${pct(r.messages.controlsWithAHit.k, r.messages.controlsWithAHit.n)}`);
}

function main() {
  const split = arg("--split", "dev");
  const set = loadSet(split), r = score(set.rows), raw = score(set.rows, { inflection: false });
  print(split, r);
  if (split === "dev") { for (const m of r.misses) console.log(`    ${m.kind.padEnd(9)} ${m.technique.padEnd(24)} ${m.id}`); return; }
  if (process.argv.includes("--no-write")) return;
  const cues = cueHash();
  const out = { generated: new Date().toISOString().slice(0, 10), split, input: { file: "project-docs/evidence/pressure/test.jsonl", sha256: set.sha256, rows: set.rows.length },
    cues: { file: "src/core/reading-pressure.js", sha256: cues, of: "JSON of PRESSURE_TECHNIQUES, so comments may change without a rescore" },
    withInflection: { techniques: r.techniques, overall: r.overall, messages: r.messages },
    withoutInflection: { techniques: raw.techniques, overall: raw.overall, messages: raw.messages },
    misses: r.misses };
  writeFileSync(join(ROOT, "project-docs/evidence/pressure-results.json"), JSON.stringify(out, null, 1) + "\n");
  console.log("wrote project-docs/evidence/pressure-results.json");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
