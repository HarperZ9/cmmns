// Image helpers shared by every stage: luminance, the resampling filter, and the line
// normalisation the recogniser was trained on. resample() follows the same triangle filter as
// Pillow's BILINEAR resize in float mode, which the training script uses, so a line looks the
// same to the model in the browser as it did in training (tests/ocr.image.test.js checks this).

// Luminance (0..255) of an RGBA buffer. Transparent pixels count as white.
export function luminance(rgba, w, h) {
  const out = new Float32Array(w * h);
  for (let i = 0, j = 0; i < out.length; i++, j += 4) {
    const a = rgba[j + 3] / 255;
    out[i] = (0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2]) * a + 255 * (1 - a);
  }
  return out;
}

// Weights for one axis: for each output index, the first input index and its normalised weights.
function axisWeights(inSize, outSize) {
  const scale = inSize / outSize, fs = Math.max(scale, 1), support = fs, out = [];
  for (let x = 0; x < outSize; x++) {
    const center = (x + 0.5) * scale;
    const lo = Math.max(Math.trunc(center - support + 0.5), 0), hi = Math.min(Math.trunc(center + support + 0.5), inSize);
    const ws = [];
    let sum = 0;
    for (let j = lo; j < hi; j++) {
      const t = Math.abs((j - center + 0.5) / fs), v = t < 1 ? 1 - t : 0;
      ws.push(v); sum += v;
    }
    out.push({ lo, ws: ws.map((v) => (sum ? v / sum : 0)) });
  }
  return out;
}

// Resample a float image (w x h) to (ow x oh): the horizontal pass, then the vertical one.
export function resample(src, w, h, ow, oh) {
  const ax = axisWeights(w, ow), ay = axisWeights(h, oh), mid = new Float32Array(ow * h), out = new Float32Array(ow * oh);
  for (let y = 0; y < h; y++) {
    const r = y * w;
    for (let x = 0; x < ow; x++) {
      const { lo, ws } = ax[x];
      let s = 0;
      for (let k = 0; k < ws.length; k++) s += ws[k] * src[r + lo + k];
      mid[y * ow + x] = s;
    }
  }
  for (let y = 0; y < oh; y++) {
    const { lo, ws } = ay[y];
    for (let x = 0; x < ow; x++) {
      let s = 0;
      for (let k = 0; k < ws.length; k++) s += ws[k] * mid[(lo + k) * ow + x];
      out[y * ow + x] = s;
    }
  }
  return out;
}

// Cut a box out of a luminance image.
export function crop(gray, w, box) {
  const cw = box.x1 - box.x0, ch = box.y1 - box.y0, out = new Float32Array(cw * ch);
  for (let y = 0; y < ch; y++) out.set(gray.subarray((box.y0 + y) * w + box.x0, (box.y0 + y) * w + box.x1), y * cw);
  return out;
}

// A line crop as the recogniser sees it: ink 1, background 0, whatever the colours, at the model's
// height. The background is the crop's median; the ink scale is its 98th percentile difference.
export function normalizeLine(gray, w, h, height = 32, maxWidth = 2400) {
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) hist[Math.max(0, Math.min(255, Math.round(gray[i])))]++;
  const bg = quantile(hist, gray.length, 0.5);
  const dh = new Uint32Array(256), d = new Float32Array(gray.length);
  for (let i = 0; i < gray.length; i++) { d[i] = Math.abs(gray[i] - bg); dh[Math.min(255, Math.round(d[i]))]++; }
  const scale = Math.max(quantile(dh, d.length, 0.98), 24);
  for (let i = 0; i < d.length; i++) d[i] = Math.min(1, d[i] / scale);
  const ow = Math.max(4, Math.min(maxWidth, Math.round((w * height) / h)));
  return { data: resample(d, w, h, ow, height), width: ow, height, inverted: bg < 128 };
}

function quantile(hist, n, q) {
  const target = q * n;
  let acc = 0;
  for (let v = 0; v < hist.length; v++) { acc += hist[v]; if (acc >= target) return v; }
  return hist.length - 1;
}
