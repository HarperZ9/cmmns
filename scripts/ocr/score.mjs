// Scoring for the OCR evaluation. Character error rate = (edit distance summed over true lines +
// characters of recognised words that fall in no true line) / true characters. Both sides are folded the same way (src/ocr/charset.js). R&D only.
import { fold } from "../../src/ocr/charset.js";

export function edits(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur.push(Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
    prev = cur;
  }
  return prev[b.length];
}

const norm = (s) => fold(s).replace(/…/g, "...").trim();

// One page. Each recognised word goes to the true line whose box holds its centre (words carry
// their own position, so a recogniser line that spans two table cells is scored cell by cell); a
// true line's hypothesis is its words left to right. Words inside no true line are stray text.
export function pageErrors(lines, hyps) {
  const assigned = lines.map(() => []), stray = [];
  const inBox = (l, cx, cy, pad) => cx >= l.x0 - pad && cx <= l.x1 + pad && cy >= l.y0 - pad && cy <= l.y1 + pad;
  for (const h of hyps) {
    const cy = (h.box.y0 + h.box.y1) / 2;
    for (const w of h.words || [{ text: h.text, x0: h.box.x0, x1: h.box.x1 }]) {
      const cx = (w.x0 + w.x1) / 2;
      let i = lines.findIndex((l) => inBox(l, cx, cy, 2));
      if (i < 0) i = lines.findIndex((l) => inBox(l, cx, cy, 8));
      if (i >= 0) assigned[i].push(w); else stray.push(w);
    }
  }
  return {
    rows: lines.map((l, i) => {
      const ref = norm(l.text), hyp = norm(assigned[i].sort((a, b) => a.x0 - b.x0).map((w) => w.text).join(" "));
      const rw = ref.split(" "), hw = new Set(hyp.split(" "));
      return { ref, hyp, size: l.size, chars: ref.length, errors: edits(hyp, ref), words: rw.length, wordsFound: rw.filter((w) => hw.has(w)).length };
    }),
    strayChars: stray.reduce((n, w) => n + norm(w.text).length, 0),
  };
}

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)] : null; };

function summarise(results, pick) {
  let chars = 0, errors = 0, words = 0, found = 0, stray = 0;
  for (const r of results) {
    const kept = r.ocr.lines.filter((l) => !l.low);
    const { rows, strayChars } = pageErrors(r.lines, kept);
    for (const row of rows.filter(pick)) { chars += row.chars; errors += row.errors; words += row.words; found += row.wordsFound; }
    stray += strayChars;
  }
  return { pages: results.length, chars, cer: chars ? (errors + stray) / chars : null, cerInLines: chars ? errors / chars : null, wordAccuracy: words ? found / words : null };
}

export function score(results) {
  const all = (r) => r.size >= 14, by = (k, v) => results.filter((r) => r[k] === v);
  const ms = results.map((r) => r.ocr.totalMs);
  return {
    atLeast14px: summarise(results, all),
    everyLine: summarise(results, () => true),
    unseenFonts: summarise(by("split", "unseen-font"), all),
    uiFonts: summarise(by("split", "ui-font"), all),
    jpeg: summarise(results.filter((r) => r.jpeg), all),
    byKind: Object.fromEntries(["post", "headline", "document", "caption"].map((k) => [k, summarise(by("kind", k), all)])),
    latencyMs: { median: median(ms), p95: pct(ms, 0.95), max: Math.max(...ms) },
  };
}
