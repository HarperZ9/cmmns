// A real-interface test set that is licence-clean: screenshots of Daylight Commons' own published pages
// (docs/privacy.html, docs/transparency.html), the author's own text in the product's own fonts,
// which training never saw. The truth for each line comes from the page's own text and layout.
// Writes OUT/images and OUT/truth.json in the format eval.mjs --skip-capture reads. R&D only.
//
//   node scripts/ocr/real.mjs OUT_DIR
import { writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { launch, goto, evaluate } from "./cdp.mjs";

const outDir = process.argv[2], ROOT = resolve(import.meta.dirname, "../..");
const PAGES = ["docs/privacy.html", "docs/transparency.html"];

// Every visible word with its box, grouped into lines: same block element, same row, no wide gap.
const WORDS = `(() => {
  const words = [], walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), ids = new Map();
  const block = (el) => { while (el.parentElement && getComputedStyle(el).display.startsWith("inline")) el = el.parentElement; if (!ids.has(el)) ids.set(el, ids.size); return ids.get(el); };
  for (let n; (n = walker.nextNode());) {
    const el = n.parentElement, cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;
    for (const m of n.data.matchAll(/\\S+/g)) {
      const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
      const rc = [...r.getClientRects()].find((q) => q.width >= 1 && q.height >= 4);
      if (!rc || rc.top < 0 || rc.left < 0 || rc.bottom > innerHeight || rc.right > innerWidth) continue;
      const top = document.elementFromPoint((rc.left + rc.right) / 2, (rc.top + rc.bottom) / 2);   // painted, not hidden
      if (!top || !(top === el || el.contains(top)) || el.closest("title, desc")) continue;
      words.push({ t: m[0], x0: rc.left, y0: rc.top, x1: rc.right, y1: rc.bottom, size: parseFloat(cs.fontSize), b: block(el) });
    }
  }
  words.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  const lines = [];
  for (const w of words) {
    const l = lines.find((x) => x.b === w.b && Math.min(x.y1, w.y1) - Math.max(x.y0, w.y0) > 0.5 * Math.min(x.y1 - x.y0, w.y1 - w.y0) && w.x0 - x.x1 < 2 * w.size && w.x0 >= x.x1 - 2);
    if (l) { l.text += " " + w.t; l.x1 = w.x1; l.y0 = Math.min(l.y0, w.y0); l.y1 = Math.max(l.y1, w.y1); l.size = Math.min(l.size, w.size); }
    else lines.push({ text: w.t, x0: w.x0, y0: w.y0, x1: w.x1, y1: w.y1, size: w.size, b: w.b });
  }
  return lines;
})()`;

async function main() {
  mkdirSync(join(outDir, "images"), { recursive: true });
  const cdp = await launch(9334), truth = [];
  try {
    for (const page of PAGES) {
      for (const scale of [1, 2]) {
        const css = 1200 / scale;
        await cdp.send("Emulation.setDeviceMetricsOverride", { width: css, height: css, deviceScaleFactor: scale, mobile: false });
        await goto(cdp, "file:///" + resolve(ROOT, page).replace(/\\/g, "/"));
        const height = await evaluate(cdp, "document.documentElement.scrollHeight");
        for (let y = 0, k = 0; y < height && k < 6; y += css, k++) {
          await evaluate(cdp, `window.scrollTo(0, ${y}); new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)))`);
          const lines = (await evaluate(cdp, WORDS)).map((l) => ({ ...l, x0: l.x0 * scale, y0: l.y0 * scale, x1: l.x1 * scale, y1: l.y1 * scale, size: l.size * scale }));
          const image = `${page.replace(/\W+/g, "-")}-x${scale}-${k}.png`;
          const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
          writeFileSync(join(outDir, "images", image), Buffer.from(shot.data, "base64"));
          truth.push({ file: page, kind: "real", split: "real", family: "page fonts", scale, jpeg: false, image, lines });
        }
      }
    }
  } finally { cdp.close(); }
  writeFileSync(join(outDir, "truth.json"), JSON.stringify(truth, null, 1));
  console.log(`${truth.length} screenshots, ${truth.reduce((n, t) => n + t.lines.length, 0)} lines`);
}

main().catch((e) => { console.error(e); process.exit(1); });
