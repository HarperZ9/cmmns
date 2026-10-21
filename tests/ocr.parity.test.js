// Reading text in images: the browser side matches training. The fixture comes from
// scripts/ocr/export.py: Pillow's resize and the numpy line normalisation on a random crop, and
// lines the int8-rounded PyTorch model read. The JavaScript must compute the same image and the
// same text, or the shipped model sees something it was not trained on.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeLine } from "../src/ocr/image.js";
import { decodeWeights } from "../src/ocr/weights.js";
import { forward, ctcDecode } from "../src/ocr/model.js";

const fx = JSON.parse(readFileSync(new URL("./fixtures/ocr-parity.json", import.meta.url), "utf8"));
const model = decodeWeights(readFileSync(new URL("../src/ext/ocr/latin.bin", import.meta.url)));

test("line normalisation matches the training pipeline pixel for pixel", () => {
  const { w, h, data } = fx.gray;
  const n = normalizeLine(Float32Array.from(data), w, h);
  assert.equal(n.width, fx.normalized.width);
  let worst = 0;
  n.data.forEach((v, i) => { worst = Math.max(worst, Math.abs(v - fx.normalized.data[i])); });
  assert.ok(worst < 2e-3, `largest difference ${worst}`);
});

test("the shipped weights give the same scores and text as the training model", () => {
  assert.ok(fx.lines.length >= 3);
  for (const l of fx.lines) {
    const { scores, classes, T } = forward(model, Float32Array.from(l.image), l.width);
    for (let k = 0; k < classes; k++) assert.ok(Math.abs(scores[k * T] - l.scores0[k]) < 2e-2, `class ${k}: ${scores[k * T]} vs ${l.scores0[k]}`);
    assert.equal(ctcDecode(scores, classes, T, model.charset).text, l.text);
  }
});

test("the weight file is small and names its alphabet", () => {
  const bytes = readFileSync(new URL("../src/ext/ocr/latin.bin", import.meta.url)).length;
  assert.ok(bytes < 3 * 1024 * 1024, `${bytes} bytes`);
  assert.equal(model.charset[0], "\u0000");
  assert.equal(model.height, 32);
});
