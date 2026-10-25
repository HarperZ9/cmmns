// A GIF writer for "Download as GIF": one palette for the whole animation by median cut over the
// frames' colours (5 bits a channel), each pixel mapped to its nearest palette colour, and GIF's
// own LZW. Frames are RGBA at one size; the result loops forever. No dependency.

// Median cut over a 15-bit histogram: up to `max` colours as [r, g, b] triples.
export function gifPalette(frames, { max = 256, step = 3 } = {}) {
  const hist = new Uint32Array(32768);
  for (const f of frames) {
    const d = f.rgba;
    for (let i = 0; i < d.length; i += 4 * step) hist[((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3)]++;
  }
  const keys = [];
  for (let k = 0; k < 32768; k++) if (hist[k]) keys.push(k);
  if (!keys.length) return [[0, 0, 0]];
  const ch = (k, c) => (k >> (10 - 5 * c)) & 31;
  const boxOf = (list) => {
    const lo = [31, 31, 31], hi = [0, 0, 0];
    let n = 0;
    for (const k of list) { n += hist[k]; for (let c = 0; c < 3; c++) { const v = ch(k, c); if (v < lo[c]) lo[c] = v; if (v > hi[c]) hi[c] = v; } }
    const span = [0, 1, 2].map((c) => hi[c] - lo[c]), axis = span.indexOf(Math.max(...span));
    return { list, n, axis, span: span[axis] };
  };
  const boxes = [boxOf(keys)];
  while (boxes.length < max) {
    let pick = -1, best = 0;
    boxes.forEach((b, i) => { const s = b.span * Math.sqrt(b.n); if (b.list.length > 1 && s > best) { best = s; pick = i; } });
    if (pick < 0) break;
    const b = boxes[pick], list = b.list.slice().sort((p, q) => ch(p, b.axis) - ch(q, b.axis));
    let acc = 0, cut = 1;
    for (let i = 0; i < list.length - 1; i++) { acc += hist[list[i]]; if (acc >= b.n / 2) { cut = i + 1; break; } cut = i + 1; }
    boxes.splice(pick, 1, boxOf(list.slice(0, cut)), boxOf(list.slice(cut)));
  }
  return boxes.map((b) => {
    const s = [0, 0, 0];
    for (const k of b.list) for (let c = 0; c < 3; c++) s[c] += ch(k, c) * hist[k];
    return s.map((v) => Math.min(255, Math.round(((v / b.n) * 255) / 31)));
  });
}

// The nearest palette index for each 15-bit colour, worked out when first needed.
function mapper(palette) {
  const table = new Int16Array(32768).fill(-1);
  return (r, g, b) => {
    const k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    if (table[k] >= 0) return table[k];
    let best = 0, bd = Infinity;
    for (let i = 0; i < palette.length; i++) {
      const p = palette[i], d = (p[0] - r) ** 2 * 3 + (p[1] - g) ** 2 * 4 + (p[2] - b) ** 2 * 2;
      if (d < bd) { bd = d; best = i; }
    }
    return (table[k] = best);
  };
}

// GIF's variant of LZW, as a list of byte chunks; the code size grows to 12 bits, then resets.
export function gifLzwEncode(indices, minCodeSize) {
  const clear = 1 << minCodeSize, eoi = clear + 1, out = [];
  let size = minCodeSize + 1, next = eoi + 1, cur = 0, bits = 0, buf = new Uint8Array(65536), n = 0;
  const table = new Int32Array(4096 * 256).fill(-1);
  const emit = (code) => {
    cur |= code << bits; bits += size;
    while (bits >= 8) { buf[n++] = cur & 255; cur >>>= 8; bits -= 8; if (n === buf.length) { out.push(buf); buf = new Uint8Array(65536); n = 0; } }
  };
  emit(clear);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i], key = prefix * 256 + k, code = table[key];
    if (code >= 0) { prefix = code; continue; }
    emit(prefix);
    if (next === 4096) { emit(clear); table.fill(-1); next = eoi + 1; size = minCodeSize + 1; }
    else { if (next >= 1 << size) size++; table[key] = next++; }
    prefix = k;
  }
  emit(prefix); emit(eoi);
  if (bits > 0) buf[n++] = cur & 255;
  out.push(buf.subarray(0, n));
  return out;
}

function subBlocks(chunks) {
  const total = chunks.reduce((s, c) => s + c.length, 0), data = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { data.set(c, o); o += c.length; }
  const out = new Uint8Array(total + Math.ceil(total / 255) + 1);
  let w = 0;
  for (let i = 0; i < total; i += 255) { const len = Math.min(255, total - i); out[w++] = len; out.set(data.subarray(i, i + len), w); w += len; }
  out[w++] = 0;
  return out.subarray(0, w);
}

// A looping GIF from frames [{ rgba, delayMs }] all `width` by `height`.
export function encodeGif({ width, height, frames, palette = null }) {
  if (!(width > 0 && height > 0 && width < 65536 && height < 65536)) throw new Error("encodeGif: width and height must be 1 to 65535");
  if (!frames || !frames.length) throw new Error("encodeGif: no frames");
  const pal = palette || gifPalette(frames);
  const bitsFor = Math.max(1, Math.ceil(Math.log2(Math.max(2, pal.length)))), tableSize = 1 << bitsFor, min = Math.max(2, bitsFor);
  const near = mapper(pal), parts = [];
  const u16 = (v) => [v & 255, (v >> 8) & 255];
  const gct = new Uint8Array(tableSize * 3);
  pal.forEach((c, i) => gct.set(c, i * 3));
  parts.push(new TextEncoder().encode("GIF89a"), Uint8Array.of(...u16(width), ...u16(height), 0x80 | 0x70 | (bitsFor - 1), 0, 0), gct);
  parts.push(Uint8Array.of(0x21, 0xff, 0x0b, ...new TextEncoder().encode("NETSCAPE2.0"), 3, 1, 0, 0, 0));
  const idx = new Uint8Array(width * height);
  for (const f of frames) {
    if (f.rgba.length !== width * height * 4) throw new Error("encodeGif: every frame must be width by height RGBA");
    for (let p = 0, i = 0; p < idx.length; p++, i += 4) idx[p] = near(f.rgba[i], f.rgba[i + 1], f.rgba[i + 2]);
    const cs = Math.max(2, Math.round((f.delayMs || 100) / 10));
    parts.push(Uint8Array.of(0x21, 0xf9, 4, 0x04, ...u16(cs), 0, 0), Uint8Array.of(0x2c, 0, 0, 0, 0, ...u16(width), ...u16(height), 0), Uint8Array.of(min), subBlocks(gifLzwEncode(idx, min)));
  }
  parts.push(Uint8Array.of(0x3b));
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
