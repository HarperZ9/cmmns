// Reading text in images, end to end on a screenshot of a made-up post (tests/fixtures/ocr/post.png,
// drawn by Chrome for this test): every line comes back exactly, in reading order, and the text
// carries the named-theory sign the typed words would.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decodePng } from "../scripts/ocr/png.mjs";
import { decodeWeights } from "../src/ocr/weights.js";
import { readImage } from "../src/ocr/read.js";
import { imageTextModel } from "../src/core/imagetext.js";

const model = decodeWeights(readFileSync(new URL("../src/ext/ocr/latin.bin", import.meta.url)));
const image = decodePng(readFileSync(new URL("./fixtures/ocr/post.png", import.meta.url)));

test("a screenshot of a post is read line by line, exactly", () => {
  const r = readImage(model, image);
  assert.deepEqual(r.lines.map((l) => l.text), [
    "Made Up Account @made_up_account · 3h",
    "Look up over the city today. Those are chemtrails",
    "and they are spraying all of us. Nobody asks why.",
    "9:41 AM · Oct 21, 2026 · 12.4K Views",
  ]);
  assert.ok(r.confidence > 0.9);
  assert.ok(r.lines.every((l) => l.box.x1 > l.box.x0 && l.words.length >= 4));
});

test("the text read from the image finds the theory the typed text would", () => {
  const { text } = readImage(model, image);
  assert.ok(imageTextModel({ text }).markers.some((m) => m.theory === "chemtrails"));
});

test("an image with no text gives no text, and an oversized image is refused", () => {
  const blank = { width: 300, height: 120, data: new Uint8ClampedArray(300 * 120 * 4).fill(255) };
  assert.equal(readImage(model, blank).text, "");
  assert.throws(() => readImage(model, { width: 3000, height: 10, data: new Uint8ClampedArray(3000 * 10 * 4) }), /up to 2400 pixels/);
});
