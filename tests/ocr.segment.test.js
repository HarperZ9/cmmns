// Reading text in images, segmentation (src/ocr/binarize.js, components.js, segment.js): the ink
// mask works for both polarities, frames and rules are dropped, i-dots join their line, and side by
// side columns stay separate lines.
import test from "node:test";
import assert from "node:assert/strict";
import { inkMask } from "../src/ocr/binarize.js";
import { components, glyphs } from "../src/ocr/components.js";
import { findLines, findWords } from "../src/ocr/segment.js";

// A gray image with filled rectangles of ink.
function page(w, h, bg, ink, rects) {
  const g = new Float32Array(w * h).fill(bg);
  for (const [x, y, rw, rh] of rects) for (let yy = y; yy < y + rh; yy++) for (let xx = x; xx < x + rw; xx++) g[yy * w + xx] = ink;
  return g;
}
// "Letters" 6 wide and 10 tall, 2 apart; words 7 apart.
function word(x, y, n, tall = 10) { return Array.from({ length: n }, (_, i) => [x + i * 8, y, 6, tall]); }
const boxesOf = (g, w, h) => glyphs(components(inkMask(g, w, h), w, h), w, h);

test("the ink mask marks the same pixels for dark-on-light and light-on-dark", () => {
  const rects = [...word(10, 10, 4), ...word(50, 10, 3)];
  const a = inkMask(page(120, 40, 250, 20, rects), 120, 40), b = inkMask(page(120, 40, 20, 250, rects), 120, 40);
  assert.deepEqual([...a], [...b]);
  assert.equal(a[15 * 120 + 12], 1);
  assert.equal(a[2 * 120 + 2], 0);
});

test("low-contrast speckle on a flat background is not ink", () => {
  const g = new Float32Array(100 * 30).map((_, i) => 200 + ((i * 7919) % 11) - 5);
  assert.equal(inkMask(g, 100, 30).reduce((a, b) => a + b, 0), 0);
});

test("two lines of words come out as two lines in reading order, with their words", () => {
  const rects = [...word(10, 10, 5), ...word(57, 10, 3), ...word(10, 30, 2), ...word(33, 30, 4), ...word(72, 30, 2)];
  const g = page(160, 50, 255, 0, rects), lines = findLines(boxesOf(g, 160, 50));
  assert.equal(lines.length, 2);
  assert.ok(lines[0].y0 < lines[1].y0);
  assert.equal(lines[0].boxes.length, 8);
  assert.deepEqual(lines.map((l) => findWords(l).length), [2, 3]);
});

test("a dot above a short letter joins the letter's line instead of making its own", () => {
  const rects = [...word(10, 20, 6, 8), [18, 15, 2, 2], [42, 15, 2, 2]];
  const lines = findLines(boxesOf(page(100, 40, 255, 0, rects), 100, 40));
  assert.equal(lines.length, 1);
  assert.equal(lines[0].boxes.length, 8);
  assert.ok(lines[0].y0 <= 15);
});

test("columns far apart on one row are separate lines, left first", () => {
  const rects = [...word(10, 10, 4), ...word(150, 10, 4)];
  const lines = findLines(boxesOf(page(220, 30, 255, 0, rects), 220, 30));
  assert.equal(lines.length, 2);
  assert.ok(lines[0].x0 < lines[1].x0);
});

test("a frame drawn around text and a long rule are not taken as characters", () => {
  const frame = [[5, 5, 100, 1], [5, 34, 100, 1], [5, 5, 1, 30], [104, 5, 1, 30]];
  const rule = [[5, 45, 120, 1]];
  const rects = [...word(15, 14, 5), ...frame, ...rule];
  const boxes = boxesOf(page(140, 50, 255, 0, rects), 140, 50);
  assert.equal(boxes.length, 5);
  assert.ok(boxes.every((b) => b.x1 - b.x0 === 6));
});

test("the edge between two flat panels is not ink, and text on either panel is", () => {
  const w = 160, h = 60, g = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y * w + x] = x < 77 ? 255 : 170;
  for (const [x, y, rw, rh] of [...word(10, 20, 4), ...word(95, 20, 4)]) for (let yy = y; yy < y + rh; yy++) for (let xx = x; xx < x + rw; xx++) g[yy * w + xx] = 20;
  const mask = inkMask(g, w, h);
  for (let y = 0; y < h; y++) { assert.equal(mask[y * w + 76], 0); assert.equal(mask[y * w + 77], 0); }
  assert.equal(findLines(boxesOf(g, w, h)).length, 2);
});

test("a single word with even letter spacing is one word", () => {
  const lines = findLines(boxesOf(page(80, 30, 255, 0, word(5, 10, 6)), 80, 30));
  assert.equal(findWords(lines[0]).length, 1);
});
