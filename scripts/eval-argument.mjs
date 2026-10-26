// Scores the claim-type marker (F7) and the inference-gap marker (F9) on the labelled sets in
// tests/fixtures/argument/, and the argument lens on its regression passage. With --write, saves
// project-docs/evidence/argument-eval.json. Gold for the held-out set is where both labellers agree.
//   node scripts/eval-argument.mjs [--write]
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { claimTypes, inferenceGaps } from "../src/core/discourse/claimtype.js";
import { wilson } from "../src/core/discourse/stats.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const json = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const ci = (k, n) => (n ? wilson(k, n).map((v) => Math.round(v * 1000) / 1000) : null);

// The type of a whole case: the type of its last sentence (the claim it lands on).
const typeOf = (text) => { const t = claimTypes(text); return t.length ? t[t.length - 1].type : "statement"; };
const gapOf = (text) => { const g = inferenceGaps(text); return g.length ? g[0].kind : "none"; };

export function score(set) {
  const cases = json(`tests/fixtures/argument/${set}`).cases;
  // gold is where both labellers agree, for the type and for the gap separately
  const all = cases.map((c) => ({ text: c.text.slice(0, 70), type: c.type, got: typeOf(c.text), gap: c.gap, gotGap: gapOf(c.text),
    typeGold: !c.labels2 || c.labels2.type === c.type, gapGold: !c.labels2 || c.labels2.gap === c.gap }));
  const rows = all.filter((r) => r.typeGold), grows = all.filter((r) => r.gapGold);
  const typeRight = rows.filter((r) => r.type === r.got).length;
  const gapFlags = grows.filter((r) => r.gotGap !== "none"), gapTrue = grows.filter((r) => r.gap !== "none");
  const gapHit = gapFlags.filter((r) => r.gotGap === r.gap).length;
  return {
    set, cases: cases.length, labellersAgree: cases.some((c) => c.labels2) ? { type: rows.length, gap: grows.length } : null,
    typeAccuracy: { right: typeRight, of: rows.length, interval: ci(typeRight, rows.length) },
    gapPrecision: { right: gapHit, of: gapFlags.length, interval: ci(gapHit, gapFlags.length) },
    gapRecall: { right: gapTrue.filter((r) => r.gotGap === r.gap).length, of: gapTrue.length },
    misses: all.filter((r) => (r.typeGold && r.type !== r.got) || (r.gapGold && r.gap !== r.gotGap)),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = { date: "2026-10-26", dev: score("claims-dev.json"), round1AsDev: score("claims-heldout.json"), heldout: score("claims-heldout2.json") };
  for (const r of [out.dev, out.round1AsDev, out.heldout]) {
    console.log(`${r.set}: types ${r.typeAccuracy.right}/${r.typeAccuracy.of}; gap precision ${r.gapPrecision.right}/${r.gapPrecision.of}; gap recall ${r.gapRecall.right}/${r.gapRecall.of}${r.labellersAgree ? `; labellers agree on type ${r.labellersAgree.type}/${r.cases}, gap ${r.labellersAgree.gap}/${r.cases}` : ""}`);
    for (const m of r.misses) console.log(`  miss: ${m.type} -> ${m.got}; gap ${m.gap} -> ${m.gotGap}: ${m.text}`);
  }
  if (process.argv.includes("--write")) writeFileSync(join(ROOT, "project-docs/evidence/argument-eval.json"), JSON.stringify(out, null, 1) + "\n");
}
