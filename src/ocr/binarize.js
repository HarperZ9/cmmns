// Ink mask for a whole screenshot. Interface text sits on flat panels, so the background of each
// 16-pixel tile is the median of the 48-pixel block around it. A pixel is ink when it differs by
// more than a floor from the background of its own tile and of the three nearest tiles: text
// differs from all of them, while the edge of a panel matches the tile on its own side. The
// absolute difference treats dark text on light and light text on dark the same way.
export const BIN = Object.freeze({ tile: 16, floor: 40 });

function tileMedians(gray, w, h, t) {
  const tw = Math.ceil(w / t), th = Math.ceil(h / t), hist = new Uint16Array(tw * th * 256);
  for (let y = 0; y < h; y++) {
    const row = ((y / t) | 0) * tw;
    for (let x = 0; x < w; x++) hist[(row + ((x / t) | 0)) * 256 + Math.max(0, Math.min(255, gray[y * w + x] | 0))]++;
  }
  const bg = new Float32Array(tw * th), sum = new Uint32Array(256);
  for (let ty = 0; ty < th; ty++) {
    for (let tx = 0; tx < tw; tx++) {
      sum.fill(0);
      let n = 0;
      for (let j = Math.max(0, ty - 1); j <= Math.min(th - 1, ty + 1); j++) {
        for (let i = Math.max(0, tx - 1); i <= Math.min(tw - 1, tx + 1); i++) {
          const b = (j * tw + i) * 256;
          for (let v = 0; v < 256; v++) { sum[v] += hist[b + v]; n += hist[b + v]; }
        }
      }
      let acc = 0, v = 0;
      for (; v < 255; v++) { acc += sum[v]; if (2 * acc >= n) break; }
      bg[ty * tw + tx] = v;
    }
  }
  return { bg, tw, th };
}

export function inkMask(gray, w, h, opt = BIN) {
  const t = opt.tile, { bg, tw, th } = tileMedians(gray, w, h, t), mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const ty = (y / t) | 0, ny = Math.min(th - 1, Math.max(0, (y % t) < t / 2 ? ty - 1 : ty + 1));
    for (let x = 0; x < w; x++) {
      const tx = (x / t) | 0, nx = Math.min(tw - 1, Math.max(0, (x % t) < t / 2 ? tx - 1 : tx + 1)), g = gray[y * w + x];
      const d = Math.min(Math.abs(g - bg[ty * tw + tx]), Math.abs(g - bg[ty * tw + nx]), Math.abs(g - bg[ny * tw + tx]), Math.abs(g - bg[ny * tw + nx]));
      mask[y * w + x] = d > opt.floor ? 1 : 0;
    }
  }
  return mask;
}
