// The recogniser's weight file. Layout: the bytes "RDOCR1\n", a little-endian u32 header length,
// a JSON header, then for each layer its int8 weights, a float32 scale per output channel and a
// float32 bias per output channel, each block starting on a 4-byte boundary. Weights are stored
// as int8 with one scale per output channel (batch norm already folded in by the export script).
export const MAGIC = "RDOCR1\n";

export function decodeWeights(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const magic = String.fromCharCode(...bytes.subarray(0, MAGIC.length));
  if (magic !== MAGIC) throw new Error("not a Radar OCR weight file");
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const hlen = dv.getUint32(MAGIC.length, true), base = MAGIC.length + 4;
  const header = JSON.parse(new TextDecoder().decode(bytes.subarray(base, base + hlen)));
  let off = align(base + hlen);
  const layers = header.layers.map((L) => {
    if (L.op === "collapse") return { ...L };
    const per = L.cin * (L.kh || 1) * (L.kw || L.k || 1), n = L.cout * per;
    const q = new Int8Array(bytes.buffer, bytes.byteOffset + off, n);
    off = align(off + n);
    const scale = floats(bytes, off, L.cout); off += 4 * L.cout;
    const bias = floats(bytes, off, L.cout); off += 4 * L.cout;
    const w = new Float32Array(n);
    for (let o = 0; o < L.cout; o++) for (let i = 0; i < per; i++) w[o * per + i] = q[o * per + i] * scale[o];
    return { ...L, w, b: bias };
  });
  if (off !== bytes.length) throw new Error(`weight file has ${bytes.length - off} unread bytes`);
  return { charset: header.charset, height: header.height, stride: header.stride, layers, name: header.name || "latin" };
}

const align = (n) => (n + 3) & ~3;
function floats(bytes, off, n) {
  const out = new Float32Array(n), dv = new DataView(bytes.buffer, bytes.byteOffset + off, 4 * n);
  for (let i = 0; i < n; i++) out[i] = dv.getFloat32(4 * i, true);
  return out;
}
