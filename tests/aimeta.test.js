import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aiMetadata, sourceType } from "../src/core/aimeta.js";

const load = (f) => new Uint8Array(readFileSync(new URL(`./fixtures/c2pa/${f}`, import.meta.url)));

test("IPTC digital source type in XMP is read", () => {
  const m = aiMetadata(load("xmp-ai.jpg"));
  assert.deepEqual(m.sourceTypes.map((t) => t.code), ["trainedAlgorithmicMedia"]);
  assert.equal(m.sourceTypes[0].kind, "ai");
});

test("PNG generator settings and Software text are read", () => {
  const m = aiMetadata(load("sd-params.png"));
  assert.ok(m.generators.some((g) => /parameters/.test(g)), JSON.stringify(m));
  assert.ok(m.fields.some((f) => f.key === "Software" && /Synthetic Diffusion UI/.test(f.text)));
});

test("a plain file says nothing, and nothing is invented", () => {
  const m = aiMetadata(load("plain.jpg"));
  assert.deepEqual(m.sourceTypes, []);
  assert.deepEqual(m.generators, []);
});

test("source type words: capture is not AI, composites with AI are", () => {
  assert.equal(sourceType("http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture").kind, "capture");
  assert.equal(sourceType("http://cv.iptc.org/newscodes/digitalsourcetype/compositeWithTrainedAlgorithmicMedia").kind, "ai");
  assert.equal(sourceType("http://cv.iptc.org/newscodes/digitalsourcetype/algorithmicMedia").kind, "synthetic");
  assert.equal(sourceType(""), null);
});

test("an EXIF Software tag naming a generator is reported", () => {
  // A minimal JPEG with an EXIF APP1 whose IFD0 holds Software = "Midjourney".
  const sw = new TextEncoder().encode("Midjourney\0");
  const tiff = [0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0, 1, 0x01, 0x31, 0, 2, 0, 0, 0, sw.length, 0, 0, 0, 26, 0, 0, 0, 0, ...sw];
  const app1 = [...new TextEncoder().encode("Exif\0\0"), ...tiff];
  const jpg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, (app1.length + 2) >> 8, (app1.length + 2) & 255, ...app1, 0xff, 0xd9, 0, 0, 0, 0]);
  const m = aiMetadata(jpg);
  assert.ok(m.generators.some((g) => /Midjourney/i.test(g)), JSON.stringify(m));
});
