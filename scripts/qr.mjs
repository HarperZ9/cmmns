// A small QR code encoder for the printed key card (scripts/kit.mjs): byte mode, error correction
// level M, versions 1 to 3 (up to 42 bytes), so a key id can be scanned instead of typed. It is an
// encoding with a Reed-Solomon checksum, not cryptography. Built from ISO/IEC 18004. Its matrices match the
// Python qrcode 8 library bit for bit and decode with OpenCV's QR detector; tests/kit.test.js holds
// reference matrices made by that library. Runs at kit build time only; nothing here ships in the extension.
const VERSIONS = { 1: { data: 16, ecc: 10, align: [] }, 2: { data: 28, ecc: 16, align: [6, 18] }, 3: { data: 44, ecc: 26, align: [6, 22] } };

// GF(256) with the QR polynomial x^8 + x^4 + x^3 + x^2 + 1.
function mul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; }
  return z & 0xff;
}
function eccOf(data, degree) {
  const div = new Array(degree).fill(0); div[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) { div[j] = mul(div[j], root); if (j + 1 < degree) div[j] ^= div[j + 1]; }
    root = mul(root, 2);
  }
  const out = new Array(degree).fill(0);
  for (const b of data) {
    const f = b ^ out.shift(); out.push(0);
    for (let i = 0; i < degree; i++) out[i] ^= mul(div[i], f);
  }
  return out;
}

function codewords(bytes, v) {
  const { data } = VERSIONS[v], bits = [];
  const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(4, 4); put(bytes.length, 8);
  for (const b of bytes) put(b, 8);
  put(0, Math.min(4, data * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const out = [];
  for (let i = 0; i < bits.length; i += 8) out.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let p = 0; out.length < data; p++) out.push(p % 2 ? 0x11 : 0xec);
  return [...out, ...eccOf(out, VERSIONS[v].ecc)];
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

// The module grid for one mask: rows of booleans (true is dark), without the quiet zone.
function draw(cw, v, mask) {
  const n = 17 + 4 * v, m = Array.from({ length: n }, () => new Array(n).fill(false)), fn = m.map((r) => r.map(() => false));
  const set = (x, y, dark) => { m[y][x] = dark; fn[y][x] = true; };
  for (let i = 0; i < n; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [n - 4, 3], [3, n - 4]]) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
      if (x >= 0 && x < n && y >= 0 && y < n) set(x, y, d !== 2 && d !== 4);
    }
  }
  const a = VERSIONS[v].align;
  if (a.length) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(a[1] + dx, a[1] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  formatBits(set, n, mask);
  let i = 0;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < n; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, y = ((right + 1) & 2) === 0 ? n - 1 - vert : vert;
      if (!fn[y][x] && i < cw.length * 8) { m[y][x] = ((cw[i >>> 3] >>> (7 - (i & 7))) & 1) === 1; i++; }
    }
  }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!fn[y][x] && MASKS[mask](x, y)) m[y][x] = !m[y][x];
  return m;
}

function formatBits(set, n, mask) {
  const data = mask;   // level M is 00
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412, bit = (i) => ((bits >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) set(8, i, bit(i));
  set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) set(n - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) set(8, n - 15 + i, bit(i));
  set(8, n - 8, true);
}

// A simple penalty (runs, 2x2 blocks, dark balance) to pick a mask; any mask decodes.
function penalty(m) {
  const n = m.length; let p = 0, dark = 0;
  for (let y = 0; y < n; y++) for (const line of [m[y], m.map((r) => r[y])]) {
    let run = 1;
    for (let x = 1; x <= n; x++) { if (x < n && line[x] === line[x - 1]) run++; else { if (run >= 5) p += run - 2; run = 1; } }
  }
  for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) if (m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
  for (const r of m) for (const c of r) dark += c;
  return p + Math.floor(Math.abs(dark * 20 - n * n * 10) / (n * n)) * 10;
}

// { version, mask, modules } for text; opts.mask forces a mask.
export function qrMatrix(text, opts = {}) {
  const bytes = [...new TextEncoder().encode(String(text))];
  const v = [1, 2, 3].find((k) => VERSIONS[k].data >= bytes.length + 2);
  if (!v) throw new Error("too long for the key card's QR code (42 bytes at most)");
  const cw = codewords(bytes, v);
  const masks = opts.mask != null ? [opts.mask] : [0, 1, 2, 3, 4, 5, 6, 7];
  const best = masks.map((k) => ({ k, mod: draw(cw, v, k) })).map((c) => ({ ...c, p: penalty(c.mod) })).sort((a, b) => a.p - b.p || a.k - b.k)[0];
  return { version: v, mask: best.k, modules: best.mod };
}

// An inline SVG of the code with a 4-module quiet zone, one path, black on white.
export function qrSvg(text, size = 160) {
  const { modules } = qrMatrix(text), n = modules.length + 8;
  let d = "";
  modules.forEach((r, y) => r.forEach((c, x) => { if (c) d += `M${x + 4} ${y + 4}h1v1h-1z`; }));
  return `<svg viewBox="0 0 ${n} ${n}" width="${size}" height="${size}" role="img" aria-label="QR code of ${String(text).replace(/[<&"]/g, "")}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
