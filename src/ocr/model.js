// The recogniser's forward pass and CTC decoding, in plain JavaScript on Float32Arrays laid out
// channel, row, column. Layers: 3x3 convolutions with ReLU and max pooling, a collapse of the
// remaining rows into features per column, 1D convolutions over the columns (some residual), and
// a last 1x1 layer giving one score per character per column.
import { unroll2d, product, trim } from "./gemm.js";

// 2D convolution, stride 1, "same" padding, fused bias and ReLU.
export function conv2d(x, C, H, W, L) {
  const P = H * W, P4 = (P + 7) & ~7, K = C * L.kh * L.kw;
  const out = trim(product(L.w, unroll2d(x, C, H, W, L.kh, L.kw, P4), L.b, L.cout, K, P4), L.cout, P, P4);
  if (L.relu) for (let i = 0; i < out.length; i++) if (out[i] < 0) out[i] = 0;
  return out;
}

// Max pooling with a (py, px) window and the same stride, flooring odd sizes.
export function maxPool(x, C, H, W, py, px) {
  const oh = Math.floor(H / py), ow = Math.floor(W / px), out = new Float32Array(C * oh * ow);
  for (let c = 0; c < C; c++) {
    for (let y = 0; y < oh; y++) {
      for (let xx = 0; xx < ow; xx++) {
        let m = -Infinity;
        for (let a = 0; a < py; a++) for (let b = 0; b < px; b++) { const v = x[c * H * W + (y * py + a) * W + xx * px + b]; if (v > m) m = v; }
        out[c * oh * ow + y * ow + xx] = m;
      }
    }
  }
  return { data: out, H: oh, W: ow };
}

// 1D convolution over T columns, "same" padding, fused bias, ReLU and an optional residual add.
export function conv1d(x, C, T, L) {
  const T4 = (T + 7) & ~7;
  const out = trim(product(L.w, unroll2d(x, C, 1, T, 1, L.k, T4), L.b, L.cout, C * L.k, T4), L.cout, T, T4);
  if (L.relu) for (let i = 0; i < out.length; i++) if (out[i] < 0) out[i] = 0;
  if (L.residual) for (let i = 0; i < out.length; i++) out[i] += x[i];
  return out;
}

// Scores per column (classes x T) for one normalised line image.
export function forward(model, img, W) {
  let x = img, C = 1, H = model.height, T = 0;
  for (const L of model.layers) {
    if (L.op === "conv2d") {
      x = conv2d(x, C, H, W, L); C = L.cout;
      if (L.pool) ({ data: x, H, W } = maxPool(x, C, H, W, L.pool[0], L.pool[1]));
    } else if (L.op === "collapse") { C = C * H; T = W; H = 1; }   // CHW with H rows -> (C*H) x W
    else if (L.op === "conv1d") { x = conv1d(x, C, T, L); C = L.cout; }
  }
  return { scores: x, classes: C, T };
}

// Greedy CTC decoding with a confidence per character (its best column's probability).
export function ctcDecode(scores, classes, T, charset) {
  const chars = [], probs = [], cols = [];
  let prev = 0;
  for (let t = 0; t < T; t++) {
    let best = 0, bv = -Infinity, sum = 0;
    for (let k = 0; k < classes; k++) { const v = scores[k * T + t]; if (v > bv) { bv = v; best = k; } }
    for (let k = 0; k < classes; k++) sum += Math.exp(scores[k * T + t] - bv);
    const p = 1 / sum;
    if (best !== 0 && best === prev) { probs[probs.length - 1] = Math.max(probs[probs.length - 1], p); }
    else if (best !== 0) { chars.push(charset[best]); probs.push(p); cols.push(t); }
    prev = best;
  }
  return { text: chars.join(""), probs, cols };
}
