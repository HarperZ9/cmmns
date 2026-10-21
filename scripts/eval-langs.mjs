// Reproduces the Arabic, Russian, Ukrainian, Chinese and Hindi numbers in project-docs/EVALUATION.md.
//   node scripts/eval-langs.mjs [--data D:/radar-data] [--split test|dev] [--no-write] [--show N]
// The corpora are downloaded by hand (project-docs/evidence/CORPORA.md) and flattened by
// scripts/eval/prep-langs.py, run here when the prepared files are missing. Tuning reads --split dev
// only (--show prints dev hits on non-hostile items, locally, never to a file); the committed
// numbers are --split test, written to project-docs/evidence/lang-results.json.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LANG_LOADERS, LANG_PREPARED } from "./eval/lang-corpora.mjs";
import { SEED } from "./eval/corpora.mjs";
import { confusion, FAMILIES, STRONG } from "./eval/metrics.mjs";
import { score } from "../src/core/rhetoric.js";
import { rate } from "./eval/metrics.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, dflt) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : dflt; };
const DATA = arg("--data", process.env.RADAR_DATA || "D:/radar-data");
const SPLIT = arg("--split", "test");
const SHOW = Number(arg("--show", 0));
const WRITE = !process.argv.includes("--no-write") && SPLIT === "test";
const RAW = ["mlma/hate_speech_mlma.zip", "cold/test.csv", ...["ar", "ru", "uk", "hi"].map((l) => `textdetox/${l}.parquet`),
  ...["arabic", "hindi", "mandarin"].map((l) => `mhc/${l}.csv`)];
const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const pct = (r) => (r && r.n ? `${(r.value * 100).toFixed(1)}% (${r.k}/${r.n}, ${(r.ci[0] * 100).toFixed(1)} to ${(r.ci[1] * 100).toFixed(1)})` : "n/a");

function prepare() {
  const prep = join(DATA, "prepared");
  if (!LANG_PREPARED.every((f) => existsSync(join(prep, f)))) {
    execFileSync("python", ["-I", join(root, "scripts/eval/prep-langs.py"), DATA], { stdio: "inherit" });
  }
  return prep;
}

const HIT = { strong: (r) => STRONG.some((f) => r.fams.has(f)), any: (r) => r.fams.size > 0,
  ...Object.fromEntries(FAMILIES.map((f) => [f, (r) => r.fams.has(f)])) };

function evaluate(items) {
  const rows = items.map((item) => ({ item, fams: new Set(score(item.text).markers.map((m) => m.family)) }));
  const g = (k) => (i) => i.gold[k];
  const out = { n: items.length, prevalence: confusion(rows, () => false, g("hostile")).prevalence, families: {}, specific: {} };
  for (const f of ["strong", "any", ...FAMILIES]) {
    const c = confusion(rows, HIT[f], g("hostile"));
    if (c.tp + c.fp || f === "strong" || f === "any") out.families[f] = { hits: c.tp + c.fp, precision: c.precision, recall: c.recall };
  }
  for (const k of ["dehumanise", "violence", "slur"]) {
    if (items.some((i) => i.gold[k] != null)) { const c = confusion(rows, HIT[k], g(k)); out.specific[k] = { precision: c.precision, recall: c.recall }; }
  }
  if (items.some((i) => i.gold.groupAttack != null)) {
    const c = confusion(rows, HIT.strong, g("groupAttack"));
    out.specific.groupAttack = { precision: c.precision, recall: c.recall };
  }
  if (items.some((i) => i.gold.severe != null)) {
    const c = confusion(rows, HIT.strong, g("severe"));
    out.specific.severe = { precision: c.precision, recall: c.recall };
  }
  if (SHOW) for (const r of rows.filter((r) => HIT.any(r) && !r.item.gold.hostile).slice(0, SHOW)) console.log("   FP", [...r.fams].join(","), "|", r.item.text.slice(0, 140).replace(/\n/g, " "));
  return out;
}

function main() {
  const prep = prepare();
  const corpora = {};
  for (const [name, load] of Object.entries(LANG_LOADERS)) {
    const r = evaluate(load(prep).filter((i) => i.split === SPLIT));
    corpora[name] = r;
    console.log(`\n== ${name} (${SPLIT}): ${r.n} items, hostile ${pct(r.prevalence)}`);
    for (const [f, x] of Object.entries(r.families)) console.log(`  ${f.padEnd(12)} hits ${String(x.hits).padStart(4)}  P(hostile) ${pct(x.precision)}  R ${pct(x.recall)}`);
    for (const [k, x] of Object.entries(r.specific)) console.log(`  vs ${k.padEnd(11)} P ${pct(x.precision)}  R ${pct(x.recall)}`);
  }
  if (!WRITE) return;
  const inputs = [...RAW.map((f) => ({ file: f, sha256: existsSync(join(DATA, f)) ? sha(join(DATA, f)) : null })),
    ...LANG_PREPARED.map((f) => ({ file: "prepared/" + f, sha256: sha(join(prep, f)) }))];
  writeFileSync(join(root, "project-docs/evidence/lang-results.json"),
    JSON.stringify({ generated: "2026-10-21", split: SPLIT, seed: SEED, inputs, corpora }, null, 1) + "\n");
  writeMeasuredLangs(corpora);
  console.log("\nwrote project-docs/evidence/lang-results.json and src/core/measured-langs.js");
}

// Natural-text corpora per language, pooled for the window's line. Multilingual HateCheck is
// template-built, so it is reported in EVALUATION.md but not pooled here.
const POOL = { ar: ["mlma-ar", "textdetox-ar"], ru: ["textdetox-ru"], uk: ["textdetox-uk"], zh: ["cold"], hi: ["textdetox-hi"] };
const SOURCE = { "mlma-ar": "MLMA", "textdetox-ar": "TextDetox (OSACT4)", "textdetox-ru": "TextDetox", "textdetox-uk": "TextDetox",
  cold: "COLD", "textdetox-hi": "TextDetox" };

function writeMeasuredLangs(corpora) {
  const rows = {};
  for (const [code, list] of Object.entries(POOL)) {
    const k = list.reduce((a, c) => a + corpora[c].families.strong.precision.k, 0);
    const n = list.reduce((a, c) => a + corpora[c].families.strong.precision.n, 0);
    const r = rate(k, n);
    rows[code] = { precision: r.value, low: r.ci ? r.ci[0] : null, high: r.ci ? r.ci[1] : null, n, split: "test",
      sources: list.map((c) => SOURCE[c]).join(" and ") };
  }
  const p = join(root, "src/core/measured-langs.js");
  const body = "export const MEASURED_LANGS = {\n" + Object.entries(rows).map(([c, r]) => `  ${c}: ${JSON.stringify(r)},`).join("\n") + "\n};";
  const src = readFileSync(p, "utf8").replace(/(\/\/ langs:begin[^\n]*\n)[\s\S]*?(\/\/ langs:end)/, (_, a, b) => `${a}${body}\n${b}`);
  writeFileSync(p, src);
}

main();
