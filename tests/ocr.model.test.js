// Reading text in images, the recogniser (src/ocr/model.js, weights.js): each layer computes what
// it should on hand-made weights, CTC decoding collapses repeats and drops blanks, and the weight
// file decoder rejects anything that is not exactly a Radar weight file.
import test from "node:test";
import assert from "node:assert/strict";
import { conv2d, conv1d, maxPool, forward, ctcDecode } from "../src/ocr/model.js";
import { decodeWeights, MAGIC } from "../src/ocr/weights.js";

const close = (a, b, eps = 1e-5) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test("a 3x3 convolution with zero padding, bias and ReLU", () => {
  // One input channel 3x3 = 1..9, kernel all ones: each output is the sum of its neighbourhood.
  const x = Float32Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const out = conv2d(x, 1, 3, 3, { cout: 2, kh: 3, kw: 3, relu: true, w: Float32Array.from([...Array(9).fill(1), ...Array(9).fill(-1)]), b: Float32Array.from([0.5, 1]) });
  assert.deepEqual([...out.subarray(0, 9)], [12.5, 21.5, 16.5, 27.5, 45.5, 33.5, 24.5, 39.5, 28.5]);
  assert.deepEqual([...out.subarray(9)], Array(9).fill(0));   // negative sums clipped
});

test("max pooling floors odd sizes", () => {
  const x = Float32Array.from([1, 5, 2, 0, 3, 4, 9, 1, 8, 7, 6, 2, 0, 0, 0, 0, 0, 0]);   // 1 channel, 3 x 6
  const p = maxPool(x, 1, 3, 6, 2, 2);
  assert.equal(p.H, 1); assert.equal(p.W, 3);
  assert.deepEqual([...p.data], [9, 8, 6]);
});

test("a 1D convolution with a residual add", () => {
  const x = Float32Array.from([1, 2, 3]);
  const out = conv1d(x, 1, 3, { cout: 1, k: 3, relu: false, residual: true, w: Float32Array.from([1, 0, -1]), b: Float32Array.from([0]) });
  // out[t] = x[t-1] - x[t+1], plus x[t]
  assert.deepEqual([...out], [-2 + 1, 1 - 3 + 2, 2 + 3]);
});

test("greedy CTC decoding collapses repeats, keeps doubled letters split by a blank, and reports confidence", () => {
  const charset = "\0ab", T = 6, classes = 3;
  const path = [1, 1, 0, 1, 2, 0];   // a a _ a b _  ->  "aab"
  const scores = new Float32Array(classes * T);
  path.forEach((k, t) => { scores[k * T + t] = 5; });
  const d = ctcDecode(scores, classes, T, charset);
  assert.equal(d.text, "aab");
  assert.equal(d.probs.length, 3);
  for (const p of d.probs) close(p, Math.exp(5) / (Math.exp(5) + 2), 1e-6);
});

// A weight file with one 3x3 conv (1 -> 1, pool 2x2), collapse, and a 1x1 output layer (16 rows ->
// 3 classes after pooling 32 -> 16).
function tinyFile({ trailing = 0 } = {}) {
  const header = { name: "t", charset: "\0ab", height: 32, stride: 2, layers: [{ op: "conv2d", cin: 1, cout: 1, kh: 3, kw: 3, pool: [2, 2], relu: true }, { op: "collapse" }, { op: "conv1d", cin: 16, cout: 3, k: 1, relu: false, residual: false }] };
  const hj = new TextEncoder().encode(JSON.stringify(header)), parts = [];
  const pad = (n) => new Uint8Array((4 - (n % 4)) % 4);
  const f32 = (a) => new Uint8Array(Float32Array.from(a).buffer);
  const head = new Uint8Array([...new TextEncoder().encode(MAGIC), ...new Uint8Array(Uint32Array.from([hj.length]).buffer), ...hj]);
  parts.push(head, pad(head.length));
  const q1 = Int8Array.from([0, 0, 0, 0, 127, 0, 0, 0, 0]);
  parts.push(new Uint8Array(q1.buffer), pad(9), f32([1 / 127]), f32([0]));
  const q2 = Int8Array.from([...Array(16).fill(0), ...Array(16).fill(127), ...Array(16).fill(-127)]);
  parts.push(new Uint8Array(q2.buffer), pad(48), f32([1, 1 / 127, 1 / 127]), f32([0.1, 0, 0]));
  parts.push(new Uint8Array(trailing));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

test("the weight decoder reads int8 weights with per-channel scales and runs end to end", () => {
  const m = decodeWeights(tinyFile());
  assert.equal(m.charset, "\0ab");
  close(m.layers[0].w[4], 1);
  close(m.layers[2].w[16], 1);
  close(m.layers[2].w[32], -1);
  // An image whose left half is ink: class "a" (sum of ink) wins there, blank on the right.
  const W = 8, img = new Float32Array(32 * W);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 4; x++) img[y * W + x] = 1;
  const { scores, classes, T } = forward(m, img, W);
  assert.equal(classes, 3); assert.equal(T, 4);
  assert.equal(ctcDecode(scores, classes, T, m.charset).text, "a");
});

test("the weight decoder refuses a wrong magic and a file with unread bytes", () => {
  const bad = tinyFile(); bad[0] = 0x58;
  assert.throws(() => decodeWeights(bad), /not a Radar OCR weight file/);
  assert.throws(() => decodeWeights(tinyFile({ trailing: 4 })), /unread bytes/);
});

test("the WebAssembly SIMD product and the JavaScript one agree, including rows past a multiple of 4", async () => {
  const { product, setSimd, usingSimd } = await import("../src/ocr/gemm.js");
  const O = 7, K = 13, P = 24, rnd = (n, s) => Float32Array.from({ length: n }, (_, i) => Math.sin(i * s) * 0.5);
  const w = rnd(O * K, 1.3), col = rnd(K * P, 0.7), b = rnd(O, 2.1);
  setSimd(false);
  const js = product(w, col, b, O, K, P);
  setSimd(true);
  assert.ok(usingSimd(), "Node 22 has WebAssembly SIMD, so the kernel must load here");
  const wasm = product(w, col, b, O, K, P);
  let worst = 0;
  js.forEach((v, i) => { worst = Math.max(worst, Math.abs(v - wasm[i])); });
  assert.ok(worst < 1e-5, `largest difference ${worst}`);
});

test("the shipped WebAssembly bytes come from the committed source", async () => {
  const { createHash } = await import("node:crypto");
  const { readFileSync } = await import("node:fs");
  const { GEMM_WAT_SHA256, GEMM_WASM } = await import("../src/ocr/gemm-wasm.js");
  const wat = readFileSync(new URL("../scripts/ocr/gemm.wat", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  assert.equal(createHash("sha256").update(wat).digest("hex"), GEMM_WAT_SHA256, "run scripts/ocr/build-wasm.mjs");
  assert.ok(WebAssembly.validate(Buffer.from(GEMM_WASM, "base64")));
});
