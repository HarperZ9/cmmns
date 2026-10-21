// Measure the image-text reader on the synthetic screenshot pages from pages.py, in headless
// Chrome: character error rate per line against the page's own text, and latency per 1200 by
// 1200 screenshot. R&D only.
//
//   node scripts/ocr/eval.mjs PAGES_DIR OUT_DIR [--throttle 4] [--skip-capture]
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { launch, goto, evaluate } from "./cdp.mjs";
import { score } from "./score.mjs";

const [pagesDir, outDir] = process.argv.slice(2);
const flag = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const throttle = Number(flag("--throttle", 1));
const ROOT = resolve(import.meta.dirname, "../..");
const TYPES = { ".js": "text/javascript", ".html": "text/html", ".png": "image/png", ".jpg": "image/jpeg", ".bin": "application/octet-stream" };

function serve(port) {
  return new Promise((ok) => {
    const srv = createServer((req, res) => {
      const path = decodeURIComponent(req.url.split("?")[0]);
      const file = path.startsWith("/data/") ? join(outDir, path.slice(6)) : join(ROOT, path);
      if (!existsSync(file)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
      res.end(readFileSync(file));
    }).listen(port, "127.0.0.1", () => ok(srv));
  });
}

const LINES = `[...document.querySelectorAll("[data-line]")].map((e) => { const r = e.getBoundingClientRect(); return { text: e.textContent, size: Number(e.dataset.size), x0: r.left, y0: r.top, x1: r.right, y1: r.bottom }; }).filter((l) => l.y0 < innerHeight && l.x0 < innerWidth)`;

async function capture(cdp, pages) {
  mkdirSync(join(outDir, "images"), { recursive: true });
  const truth = [];
  for (const p of pages) {
    const css = 1200 / p.scale;
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: css, height: css, deviceScaleFactor: p.scale, mobile: false });
    await goto(cdp, "file:///" + resolve(pagesDir, p.file).replace(/\\/g, "/"));
    const lines = (await evaluate(cdp, LINES)).map((l) => ({ ...l, x0: l.x0 * p.scale, y0: l.y0 * p.scale, x1: Math.min(1200, l.x1 * p.scale), y1: Math.min(1200, l.y1 * p.scale), size: l.size * p.scale }));
    const fmt = p.jpeg ? "jpeg" : "png", file = p.file.replace(".html", p.jpeg ? ".jpg" : ".png");
    const shot = await cdp.send("Page.captureScreenshot", { format: fmt, quality: p.jpeg ? 70 : undefined, captureBeyondViewport: false });
    writeFileSync(join(outDir, "images", file), Buffer.from(shot.data, "base64"));
    truth.push({ ...p, image: file, lines });
  }
  await cdp.send("Emulation.clearDeviceMetricsOverride");
  writeFileSync(join(outDir, "truth.json"), JSON.stringify(truth, null, 1));
  return truth;
}

async function main() {
  const pages = JSON.parse(readFileSync(join(pagesDir, "pages.json"), "utf8"));
  const srv = await serve(8931), cdp = await launch();
  try {
    const truth = process.argv.includes("--skip-capture") ? JSON.parse(readFileSync(join(outDir, "truth.json"), "utf8")) : await capture(cdp, pages);
    await goto(cdp, "http://127.0.0.1:8931/scripts/ocr/bench.html");
    for (let i = 0; i < 100 && !(await evaluate(cdp, "!!window.ready")); i++) await new Promise((ok) => setTimeout(ok, 50));
    if (throttle > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
    const loadMs = await evaluate(cdp, "loadModel()");
    const results = [];
    for (const t of truth) results.push({ ...t, ocr: await evaluate(cdp, `ocr("/data/images/${t.image}")`) });
    const report = { throttle, loadMs, ...score(results) };
    writeFileSync(join(outDir, `results-x${throttle}.json`), JSON.stringify({ report, results }, null, 1));
    console.log(JSON.stringify(report, null, 1));
  } finally { cdp.close(); srv.close(); }
}

main().catch((e) => { console.error(e); process.exit(1); });
