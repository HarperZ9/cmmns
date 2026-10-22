// Convolution as matrix product: the input unrolled into columns (one row per weight tap, one
// column per output position), then a 4 x 4 blocked product so each weight and input value read
// feeds four multiply-adds held in local variables. In V8 this runs about three times faster
// than the direct loop; the WebAssembly SIMD kernel about as much again. Positions are padded to
// a multiple of 8 and trimmed after.
import { GEMM_WASM } from "./gemm-wasm.js";

// Unroll a C x H x W input for a kh x kw kernel with "same" padding. Width P4 >= H*W, zero padded.
export function unroll2d(x, C, H, W, kh, kw, P4) {
  const P = H * W, ph = kh >> 1, pw = kw >> 1, col = new Float32Array(C * kh * kw * P4);
  for (let c = 0; c < C; c++) {
    for (let ky = 0; ky < kh; ky++) {
      for (let kx = 0; kx < kw; kx++) {
        const row = ((c * kh + ky) * kw + kx) * P4, dx = kx - pw, xs = Math.max(0, -dx), xe = Math.min(W, W - dx);
        for (let y = 0; y < H; y++) {
          const yy = y + ky - ph;
          if (yy < 0 || yy >= H) continue;
          const src = c * P + yy * W + dx, dst = row + y * W;
          for (let i = xs; i < xe; i++) col[dst + i] = x[src + i];
        }
      }
    }
  }
  return col;
}

// The SIMD kernel (scripts/ocr/gemm.wat), compiled once on first use. Where the browser has no
// WebAssembly SIMD, or its policy forbids compiling, the plain JavaScript kernel below runs.
let simd = null, simdTried = false, useSimd = true;
export function setSimd(on) { useSimd = !!on; }
export const usingSimd = () => !!kernel();
function kernel() {
  if (!useSimd) return null;
  if (simdTried) return simd;
  simdTried = true;
  try {
    const bin = Uint8Array.from(atob(GEMM_WASM), (c) => c.charCodeAt(0)), memory = new WebAssembly.Memory({ initial: 64 });
    simd = { gemm: new WebAssembly.Instance(new WebAssembly.Module(bin), { env: { memory } }).exports.gemm, memory };
  } catch (e) { simd = null; console.warn("[radar] WebAssembly SIMD is not available here; reading text in plain JavaScript", e && e.message); }
  return simd;
}

function productSimd(k, w, col, b, O4, K, P8) {
  const bytes = 4 * (O4 * K + K * P8 + O4 + O4 * P8), have = k.memory.buffer.byteLength;
  if (bytes > have) k.memory.grow(Math.ceil((bytes - have) / 65536));
  const f = new Float32Array(k.memory.buffer), oW = 0, oC = O4 * K, oB = oC + K * P8, oO = oB + O4;
  f.set(w.subarray(0, O4 * K), oW); f.set(col, oC); f.set(b.subarray(0, O4), oB);
  k.gemm(4 * oW, 4 * oC, 4 * oB, 4 * oO, O4, K, P8);
  return f.slice(oO, oO + O4 * P8);
}

// out (O x P4) = w (O x K) . col (K x P4) + bias. P4 is a multiple of 8 when the SIMD kernel runs.
export function product(w, col, b, O, K, P4) {
  const k = (P4 & 7) === 0 && O >= 4 ? kernel() : null;
  if (k) {
    const O4 = O & ~3, top = productSimd(k, w, col, b, O4, K, P4);
    if (O4 === O) return top;
    const out = new Float32Array(O * P4);
    out.set(top);
    rows(out, w, col, b, O4, O, K, P4);
    return out;
  }
  return productJs(w, col, b, O, K, P4);
}

function rows(out, w, col, b, from, O, K, P4) {
  for (let o = from; o < O; o++) {
    for (let p = 0; p < P4; p++) {
      let a = b[o];
      for (let k = 0; k < K; k++) a += w[o * K + k] * col[k * P4 + p];
      out[o * P4 + p] = a;
    }
  }
}

function productJs(w, col, b, O, K, P4) {
  const out = new Float32Array(O * P4), O4 = O & ~3;
  for (let o = 0; o < O4; o += 4) {
    const w0 = o * K, w1 = w0 + K, w2 = w1 + K, w3 = w2 + K;
    for (let p = 0; p < P4; p += 4) {
      let a00 = b[o], a01 = a00, a02 = a00, a03 = a00, a10 = b[o + 1], a11 = a10, a12 = a10, a13 = a10;
      let a20 = b[o + 2], a21 = a20, a22 = a20, a23 = a20, a30 = b[o + 3], a31 = a30, a32 = a30, a33 = a30;
      for (let k = 0, ck = p; k < K; k++, ck += P4) {
        const c0 = col[ck], c1 = col[ck + 1], c2 = col[ck + 2], c3 = col[ck + 3];
        const v0 = w[w0 + k], v1 = w[w1 + k], v2 = w[w2 + k], v3 = w[w3 + k];
        a00 += v0 * c0; a01 += v0 * c1; a02 += v0 * c2; a03 += v0 * c3;
        a10 += v1 * c0; a11 += v1 * c1; a12 += v1 * c2; a13 += v1 * c3;
        a20 += v2 * c0; a21 += v2 * c1; a22 += v2 * c2; a23 += v2 * c3;
        a30 += v3 * c0; a31 += v3 * c1; a32 += v3 * c2; a33 += v3 * c3;
      }
      let r = o * P4 + p;
      out[r] = a00; out[r + 1] = a01; out[r + 2] = a02; out[r + 3] = a03; r += P4;
      out[r] = a10; out[r + 1] = a11; out[r + 2] = a12; out[r + 3] = a13; r += P4;
      out[r] = a20; out[r + 1] = a21; out[r + 2] = a22; out[r + 3] = a23; r += P4;
      out[r] = a30; out[r + 1] = a31; out[r + 2] = a32; out[r + 3] = a33;
    }
  }
  rows(out, w, col, b, O4, O, K, P4);
  return out;
}

// Drop the padding columns: O x P4 -> O x P.
export function trim(out, O, P, P4) {
  if (P === P4) return out;
  const t = new Float32Array(O * P);
  for (let o = 0; o < O; o++) t.set(out.subarray(o * P4, o * P4 + P), o * P);
  return t;
}
