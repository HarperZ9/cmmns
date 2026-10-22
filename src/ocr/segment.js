// Lines and words from character boxes. Built for screenshots of rendered UI text: horizontal
// lines, several columns side by side, accents and the dots of i and j sitting above the line.
const overlap = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
const height = (b) => b.y1 - b.y0;
const grow = (l, b) => { l.x0 = Math.min(l.x0, b.x0); l.x1 = Math.max(l.x1, b.x1); l.y0 = Math.min(l.y0, b.y0); l.y1 = Math.max(l.y1, b.y1); l.boxes.push(b); };

// The line a box continues: close on the left, sharing most of its height with the line's core,
// of a similar height. A much smaller box (a comma, a hyphen) may join a line that already holds
// text, never a lone large shape such as an avatar.
function pick(open, b) {
  let best = null, bestScore = -Infinity;
  for (const l of open) {
    const lh = l.core1 - l.core0, gap = b.x0 - l.x1;
    if (gap > 1.3 * Math.max(lh, height(b)) || gap < -lh) continue;
    const ov = overlap(b.y0, b.y1, l.core0, l.core1) / Math.min(height(b), lh);
    const ratio = height(b) / lh;
    if (ov < 0.5 || ratio > 2.2) continue;
    if (ratio < 0.45 && (ov < 0.9 || l.boxes.length < 2)) continue;
    const score = ov - 0.5 * Math.abs(Math.log(ratio));
    if (score > bestScore) { best = l; bestScore = score; }
  }
  return best;
}

// Small marks (dots, accents, commas set apart) that started their own line join the line they
// sit on, above or below it.
function attachMarks(lines) {
  const main = lines.filter((l) => l.core1 - l.core0 >= 6 && l.boxes.length > 1), out = new Set(main);
  for (const l of lines) {
    if (out.has(l)) continue;
    const h = l.y1 - l.y0;
    const host = main.find((m) => overlap(l.x0, l.x1, m.x0 - 2, m.x1 + 2) >= 0.8 * (l.x1 - l.x0) && h < 0.6 * (m.y1 - m.y0) && (l.y1 >= m.y0 - 0.6 * (m.y1 - m.y0)) && l.y0 <= m.y1 + 0.4 * (m.y1 - m.y0));
    if (host) for (const b of l.boxes) grow(host, b); else out.add(l);
  }
  return [...out];
}

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[(s.length - 1) >> 1]; };

// A line's box from its boxes. Boxes far taller than the line's median (a letter that touches the
// line above or below, joined into one component) widen it but do not set its height.
function bounds(boxes) {
  const m = median(boxes.map(height)), core = boxes.filter((b) => height(b) <= 1.9 * m);
  return { x0: Math.min(...boxes.map((b) => b.x0)), x1: Math.max(...boxes.map((b) => b.x1)), y0: Math.min(...core.map((b) => b.y0)), y1: Math.max(...core.map((b) => b.y1)), boxes };
}

// Tight line spacing makes descenders touch the ascenders below, which can pull two lines into
// one. Such a line is split where the centres of its ordinary boxes leave a wide gap.
function split(line) {
  const bs = line.boxes, m = median(bs.map(height));
  const all0 = Math.min(...bs.map((b) => b.y0)), all1 = Math.max(...bs.map((b) => b.y1));
  if (bs.length < 4 || all1 - all0 <= 2.2 * m) return [bounds(bs)];
  const c = (b) => (b.y0 + b.y1) / 2, normal = bs.filter((b) => height(b) <= 1.9 * m).sort((a, b) => c(a) - c(b));
  let cut = -1, widest = 0.6 * m;
  for (let i = 1; i < normal.length; i++) if (c(normal[i]) - c(normal[i - 1]) > widest) { widest = c(normal[i]) - c(normal[i - 1]); cut = i; }
  if (cut < 0) return [bounds(bs)];
  const at = (c(normal[cut - 1]) + c(normal[cut])) / 2, up = [], down = [];
  for (const b of bs) (height(b) <= 1.9 * m ? (c(b) < at ? up : down) : (b.y0 + m < at ? up : down)).push(b);
  return [...split({ boxes: up }), ...split({ boxes: down })];
}

// Text lines in reading order: rows top to bottom, left to right within a row.
export function findLines(boxes) {
  const sorted = [...boxes].sort((a, b) => a.x0 - b.x0), open = [];
  for (const b of sorted) {
    const l = pick(open, b), r = l ? height(b) / (l.core1 - l.core0) : 0;
    if (l) { grow(l, b); if (r >= 0.6 && r <= 1.6) { l.core0 = Math.min(l.core0, b.y0); l.core1 = Math.max(l.core1, b.y1); } }
    else open.push({ x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1, core0: b.y0, core1: b.y1, boxes: [b] });
  }
  const lines = attachMarks(open).flatMap(split);
  lines.sort((a, b) => a.y0 - b.y0);
  const rows = [];
  for (const l of lines) {
    const row = rows.find((r) => overlap(l.y0, l.y1, r.y0, r.y1) >= 0.5 * Math.min(l.y1 - l.y0, r.y1 - r.y0));
    if (row) { row.lines.push(l); row.y0 = Math.min(row.y0, l.y0); row.y1 = Math.max(row.y1, l.y1); } else rows.push({ y0: l.y0, y1: l.y1, lines: [l] });
  }
  return rows.flatMap((r) => r.lines.sort((a, b) => a.x0 - b.x0));
}

// Words in a line: runs of boxes split where the gap is closer to a word space than to letter
// spacing. With one gap size only (a single word, or evenly spaced letters) the line is one word.
export function findWords(line) {
  const bs = [...line.boxes].sort((a, b) => a.x0 - b.x0), runs = [];
  for (const b of bs) {
    const r = runs[runs.length - 1];
    if (r && b.x0 <= r.x1) { r.x1 = Math.max(r.x1, b.x1); r.y0 = Math.min(r.y0, b.y0); r.y1 = Math.max(r.y1, b.y1); }
    else runs.push({ x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 });
  }
  const gaps = runs.slice(1).map((r, i) => r.x0 - runs[i].x1);
  const h = line.y1 - line.y0, cut = Math.max(0.22 * h, splitPoint(gaps));
  const words = [];
  runs.forEach((r, i) => {
    if (i && gaps[i - 1] > cut) words.push({ ...r });
    else if (!words.length) words.push({ ...r });
    else { const w = words[words.length - 1]; w.x1 = r.x1; w.y0 = Math.min(w.y0, r.y0); w.y1 = Math.max(w.y1, r.y1); }
  });
  return words;
}

// Two-means split of the gap sizes; Infinity when the gaps do not fall into two groups.
function splitPoint(gaps) {
  if (gaps.length < 2) return Infinity;
  const s = [...gaps].sort((a, b) => a - b);
  let best = Infinity, bestCost = Infinity;
  for (let i = 1; i < s.length; i++) {
    const a = s.slice(0, i), b = s.slice(i), ma = a.reduce((x, y) => x + y, 0) / a.length, mb = b.reduce((x, y) => x + y, 0) / b.length;
    const cost = a.reduce((x, y) => x + (y - ma) ** 2, 0) + b.reduce((x, y) => x + (y - mb) ** 2, 0);
    if (mb - ma >= 2 && cost < bestCost) { bestCost = cost; best = (s[i - 1] + s[i]) / 2; }
  }
  return best;
}
