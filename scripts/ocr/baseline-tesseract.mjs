// R&D baseline only, never shipped: Tesseract (tesseract.js, Apache-2.0) on the same screenshots
// and the same scoring as eval.mjs. Install it outside the repo and point TESSERACT_DIR at that
// folder's node_modules/tesseract.js; English traineddata is fetched by tesseract.js itself.
//
//   TESSERACT_DIR=... node scripts/ocr/baseline-tesseract.mjs OUT_DIR
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { score } from "./score.mjs";

const outDir = process.argv[2];
// Tesseract reads every image the same way; the R&D comparison uses its defaults.
const { createWorker } = await import(pathToFileURL(join(process.env.TESSERACT_DIR, "src/index.js")).href);
const truth = JSON.parse(readFileSync(join(outDir, "truth.json"), "utf8"));
const worker = await createWorker("eng");
const results = [];
for (const t of truth) {
  const t0 = performance.now();
  const { data } = await worker.recognize(join(outDir, "images", t.image), {}, { blocks: true, text: true });
  const ms = performance.now() - t0;
  const lines = (data.blocks || []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines)).map((l) => ({ text: l.text.trim(), box: l.bbox, low: false, words: l.words.map((w) => ({ text: w.text, x0: w.bbox.x0, x1: w.bbox.x1 })) }));
  results.push({ ...t, ocr: { lines, totalMs: ms } });
}
await worker.terminate();
const report = { engine: "tesseract.js 7.0.0, eng, defaults", ...score(results) };
writeFileSync(join(outDir, "results-tesseract.json"), JSON.stringify({ report, results }, null, 1));
console.log(JSON.stringify(report, null, 1));
