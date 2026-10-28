// Read the text in one screenshot: ink mask, character boxes, lines, then the recogniser on each
// line. Every line carries its box, its words' boxes and a confidence (the mean of its characters'
// probabilities). Lines the recogniser is unsure of are kept but marked, so callers can drop them.
import { luminance, crop, normalizeLine } from "./image.js";
import { inkMask } from "./binarize.js";
import { components, glyphs } from "./components.js";
import { findLines, findWords } from "./segment.js";
import { forward, ctcDecode } from "./model.js";
import { plain } from "./charset.js";

export const LOW_CONFIDENCE = 0.6;
const MAX_SIDE = 2400, MAX_LINES = 400;

// The pixel box the recogniser reads for a line: its ink with a margin on each side.
export function lineBox(l, w, h) {
  const lh = l.y1 - l.y0, py = Math.max(2, Math.round(0.15 * lh)), px = Math.max(3, Math.round(0.35 * lh));
  return { x0: Math.max(0, l.x0 - px), y0: Math.max(0, l.y0 - py), x1: Math.min(w, l.x1 + px), y1: Math.min(h, l.y1 + py) };
}

export function readLine(model, gray, w, box) {
  const g = crop(gray, w, box), n = normalizeLine(g, box.x1 - box.x0, box.y1 - box.y0, model.height);
  const { scores, classes, T } = forward(model, n.data, n.width);
  const d = ctcDecode(scores, classes, T, model.charset);
  const text = d.text.trim();
  const confidence = d.probs.length ? d.probs.reduce((a, b) => a + b, 0) / d.probs.length : 0;
  return { text, confidence, inverted: n.inverted, words: wordSpans(d, box, n.width / (box.x1 - box.x0), model.stride || 4) };
}

// Where each recognised word sits, in image pixels, from the columns CTC emitted its letters at.
function wordSpans(d, box, scale, stride) {
  const out = [];
  let cur = null;
  [...d.text].forEach((ch, i) => {
    const x = box.x0 + ((d.cols[i] + 0.5) * stride) / scale;
    if (ch === " ") { cur = null; return; }
    if (!cur) out.push((cur = { text: "", x0: x, x1: x }));
    cur.text += ch; cur.x1 = x;
  });
  return out.map((w) => ({ ...w, x0: Math.round(w.x0 - 0.3 * (box.y1 - box.y0)), x1: Math.round(w.x1 + 0.3 * (box.y1 - box.y0)) }));
}

// Half-size luminance, 2 x 2 averages: large text is found on this, where its thick strokes fit
// the background tiles the way small text does at full size.
function half(gray, w, h) {
  const hw = w >> 1, hh = h >> 1, out = new Float32Array(hw * hh);
  for (let y = 0; y < hh; y++) for (let x = 0; x < hw; x++) {
    const i = 2 * y * w + 2 * x;
    out[y * hw + x] = (gray[i] + gray[i + 1] + gray[i + w] + gray[i + w + 1]) / 4;
  }
  return { gray: out, w: hw, h: hh };
}

function linesIn(gray, w, h) {
  return findLines(glyphs(components(inkMask(gray, w, h), w, h), w, h)).filter((l) => l.y1 - l.y0 >= 6 && l.x1 - l.x0 >= 4);
}

const LARGE = 48;   // line height in pixels from which the half-size pass finds the line
const iou = (a, b) => { const ix = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)), iy = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)), i = ix * iy; return i / ((a.x1 - a.x0) * (a.y1 - a.y0) + (b.x1 - b.x0) * (b.y1 - b.y0) - i); };

// Lines found at full size (small and medium text) and at half size (large text), in reading order.
export function findAllLines(gray, w, h) {
  const small = linesIn(gray, w, h).filter((l) => l.y1 - l.y0 < LARGE + 12);
  if (w < 64 || h < 64) return small;
  const H = half(gray, w, h), big = linesIn(H.gray, H.w, H.h).map((l) => ({ ...l, x0: 2 * l.x0, x1: 2 * l.x1, y0: 2 * l.y0, y1: 2 * l.y1, boxes: l.boxes.map((b) => ({ ...b, x0: 2 * b.x0, x1: 2 * b.x1, y0: 2 * b.y0, y1: 2 * b.y1 })) })).filter((l) => l.y1 - l.y0 >= LARGE);
  const inside = (s, b) => { const ix = Math.max(0, Math.min(s.x1, b.x1) - Math.max(s.x0, b.x0)), iy = Math.max(0, Math.min(s.y1, b.y1) - Math.max(s.y0, b.y0)); return ix * iy > 0.5 * (s.x1 - s.x0) * (s.y1 - s.y0); };
  const kept = small.filter((s) => !big.some((b) => iou(s, b) > 0.3 || inside(s, b)));
  return [...kept, ...big].sort((a, b) => (Math.abs(a.y0 - b.y0) < 0.5 * Math.min(a.y1 - a.y0, b.y1 - b.y0) ? a.x0 - b.x0 : a.y0 - b.y0));
}

// image: { data: RGBA bytes, width, height }. Returns lines in reading order and the joined text.
export function readImage(model, image, { now = () => Date.now() } = {}) {
  const t0 = now();
  const { width: w, height: h } = image;
  if (w > MAX_SIDE || h > MAX_SIDE) throw new Error(`image is ${w} by ${h}; CMMNS reads images up to ${MAX_SIDE} pixels a side`);
  const gray = luminance(image.data, w, h);
  const lines = [];
  for (const l of findAllLines(gray, w, h).slice(0, MAX_LINES)) {
    const box = lineBox(l, w, h), r = readLine(model, gray, w, box);
    if (!/[\p{L}\p{N}]/u.test(r.text)) continue;   // marks alone: icons, rules, decorations
    lines.push({ ...r, box, gaps: findWords(l).length, low: r.confidence < LOW_CONFIDENCE });
  }
  const kept = lines.filter((l) => !l.low), chars = kept.reduce((n, l) => n + l.text.length, 0);
  const confidence = chars ? kept.reduce((s, l) => s + l.confidence * l.text.length, 0) / chars : 0;
  return { lines, text: plain(kept.map((l) => l.text)), confidence, ms: now() - t0 };
}
