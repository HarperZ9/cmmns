// Byte helpers shared by the Share clean modules (clean.js and its format readers). Pure: no DOM,
// no network, no file system. Every function takes and returns Uint8Array.

export const cleanEnc = new TextEncoder();
export const cleanDec = new TextDecoder("latin1");

export function cleanCat(list) {
  const out = new Uint8Array(list.reduce((s, x) => s + x.length, 0));
  let p = 0;
  for (const x of list) { out.set(x, p); p += x.length; }
  return out;
}

export const be16 = (b, at) => (b[at] << 8) | b[at + 1];
export const be32 = (b, at) => ((b[at] << 24) >>> 0) + (b[at + 1] << 16) + (b[at + 2] << 8) + b[at + 3];
export const le16 = (b, at) => b[at] | (b[at + 1] << 8);
export const le32 = (b, at) => (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;
export const putBe32 = (v) => Uint8Array.of(v >>> 24, (v >> 16) & 255, (v >> 8) & 255, v & 255);
export const putLe32 = (v) => Uint8Array.of(v & 255, (v >> 8) & 255, (v >> 16) & 255, v >>> 24);
export const putLe16 = (v) => Uint8Array.of(v & 255, (v >> 8) & 255);
export const asciiAt = (b, at, s) => at >= 0 && at + s.length <= b.length && [...s].every((c, k) => b[at + k] === c.charCodeAt(0));
export const latin1 = (b, at, n) => cleanDec.decode(b.subarray(at, at + n));

let table = null;
export function cleanCrc32(bytes) {
  if (!table) table = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  let c = 0xffffffff;
  for (const x of bytes) c = table[(c ^ x) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Index of the first occurrence of `needle` (string or bytes) in `hay`, or -1.
export function indexOfBytes(hay, needle, from = 0) {
  const n = typeof needle === "string" ? cleanEnc.encode(needle) : needle;
  if (!n.length) return -1;
  outer: for (let i = from; i + n.length <= hay.length; i++) {
    if (hay[i] !== n[0]) continue;
    for (let k = 1; k < n.length; k++) if (hay[i + k] !== n[k]) continue outer;
    return i;
  }
  return -1;
}

export async function cleanSha256(bytes) {
  const d = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(d), (x) => x.toString(16).padStart(2, "0")).join("");
}

// zlib inflate and deflate through the platform's CompressionStream (browsers and Node 18+).
async function streamThrough(bytes, stream) {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}
export const zInflate = (bytes) => streamThrough(bytes, new DecompressionStream("deflate"));
export const zDeflate = (bytes) => streamThrough(bytes, new CompressionStream("deflate"));
