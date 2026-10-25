// Writes a post's description into the file itself, losslessly, so the words stay with the picture
// or video when the sidecar is lost: XMP (dc:description, dc:creator, dc:source) in JPEG, PNG and
// WebP; an iTunes-style comment, description and artist in MP4 (moov/udta/meta/ilst, with every
// chunk offset moved by the bytes added); a comment block in GIF. The pixels and samples are never
// touched. A file that already carries its own XMP or MP4 metadata is left as it is.

import { readBoxes } from "./media-read.js";

const enc = new TextEncoder(), dec = new TextDecoder();
const cat = (list) => { const o = new Uint8Array(list.reduce((s, x) => s + x.length, 0)); let p = 0; for (const x of list) { o.set(x, p); p += x.length; } return o; };
const be32 = (v) => Uint8Array.of(v >>> 24, (v >> 16) & 255, (v >> 8) & 255, v & 255);
const le32 = (v) => Uint8Array.of(v & 255, (v >> 8) & 255, (v >> 16) & 255, v >>> 24);
const u32 = (b, at) => ((b[at] << 24) >>> 0) + (b[at + 1] << 16) + (b[at + 2] << 8) + b[at + 3];
const ascii = (b, at, s) => [...s].every((c, k) => b[at + k] === c.charCodeAt(0));
const xml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const MAX = 30000;

export function xmpPacket({ description = "", creator = "", source = "" }) {
  const d = String(description).slice(0, MAX);
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">`
    + `<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:description><rdf:Alt><rdf:li xml:lang="x-default">${xml(d)}</rdf:li></rdf:Alt></dc:description>`
    + (creator ? `<dc:creator><rdf:Seq><rdf:li>${xml(creator)}</rdf:li></rdf:Seq></dc:creator>` : "") + (source ? `<dc:source>${xml(source)}</dc:source>` : "")
    + `</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
}

const XMP_NS = "http://ns.adobe.com/xap/1.0/\0";

function jpeg(b, xmp) {
  let at = 2;
  while (at + 4 <= b.length && b[at] === 0xff && b[at + 1] >= 0xe0 && b[at + 1] <= 0xef) {
    const len = (b[at + 2] << 8) | b[at + 3];
    if (b[at + 1] === 0xe1 && ascii(b, at + 4, "http://ns.adobe.com/xap/1.0/")) return null;
    if (b[at + 1] !== 0xe0) break;
    at += 2 + len;
  }
  const body = enc.encode(XMP_NS + xmp);
  if (body.length + 2 > 65535) return null;
  return cat([b.subarray(0, at), Uint8Array.of(0xff, 0xe1, (body.length + 2) >> 8, (body.length + 2) & 255), body, b.subarray(at)]);
}

let crcTable = null;
function crc32(bytes) {
  if (!crcTable) crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  let c = 0xffffffff;
  for (const x of bytes) c = crcTable[(c ^ x) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function png(b, xmp) {
  for (let at = 8; at + 12 <= b.length;) {
    const len = u32(b, at);
    if (ascii(b, at + 4, "iTXt") && ascii(b, at + 8, "XML:com.adobe.xmp")) return null;
    if (ascii(b, at + 4, "IEND")) break;
    at += 12 + len;
  }
  const ihdrEnd = 8 + 12 + u32(b, 8);
  const data = cat([enc.encode("iTXt"), enc.encode("XML:com.adobe.xmp"), Uint8Array.of(0, 0, 0, 0, 0), enc.encode(xmp)]);
  return cat([b.subarray(0, ihdrEnd), be32(data.length - 4), data, be32(crc32(data)), b.subarray(ihdrEnd)]);
}

function riffChunk(type, data) { return cat([enc.encode(type), le32(data.length), data, data.length % 2 ? Uint8Array.of(0) : new Uint8Array(0)]); }

function webp(b, xmp) {
  const first = String.fromCharCode(...b.subarray(12, 16)), body = b.subarray(12);
  const le24 = (v) => Uint8Array.of(v & 255, (v >> 8) & 255, (v >> 16) & 255);
  let head;
  if (first === "VP8X") {
    if (b[20] & 0x04) return null;
    head = b.slice(12);
    head[8] |= 0x04;
  } else {
    let w, h, alpha = 0;
    const d = 20;
    if (first === "VP8 ") { w = ((b[d + 7] << 8) | b[d + 6]) & 0x3fff; h = ((b[d + 9] << 8) | b[d + 8]) & 0x3fff; }
    else if (first === "VP8L") { const v = b[d + 1] | (b[d + 2] << 8) | (b[d + 3] << 16) | (b[d + 4] << 24); w = (v & 0x3fff) + 1; h = ((v >>> 14) & 0x3fff) + 1; alpha = (v >>> 28) & 1 ? 0x10 : 0; }
    else return null;
    head = cat([riffChunk("VP8X", cat([Uint8Array.of(0x04 | alpha, 0, 0, 0), le24(w - 1), le24(h - 1)])), body]);
  }
  const out = cat([enc.encode("RIFF"), le32(0), enc.encode("WEBP"), head, riffChunk("XMP ", enc.encode(xmp))]);
  out.set(le32(out.length - 8), 4);
  return out;
}

function ilstItem(type, text) {
  const v = enc.encode(String(text).slice(0, MAX));
  const data = cat([be32(16 + v.length), enc.encode("data"), be32(1), be32(0), v]);
  const name = type.length === 4 && type[0] === "©" ? Uint8Array.of(0xa9, ...enc.encode(type.slice(1))) : enc.encode(type);
  return cat([be32(8 + data.length), name, data]);
}

function mp4(b, { description, creator }) {
  const top = readBoxes(b), moov = top.find((x) => x.type === "moov");
  if (!moov || moov.headerSize !== 8 || (moov.children || []).some((x) => x.type === "udta")) return null;
  const items = [ilstItem("©cmt", description), ilstItem("desc", description), ...(creator ? [ilstItem("©ART", creator)] : [])];
  const ilst = cat([be32(8 + items.reduce((s, x) => s + x.length, 0)), enc.encode("ilst"), ...items]);
  const hdlr = cat([be32(33), enc.encode("hdlr"), be32(0), be32(0), enc.encode("mdirappl"), be32(0), be32(0), Uint8Array.of(0)]);
  const meta = cat([be32(12 + hdlr.length + ilst.length), enc.encode("meta"), be32(0), hdlr, ilst]);
  const udta = cat([be32(8 + meta.length), enc.encode("udta"), meta]);
  const out = cat([b.subarray(0, moov.start + moov.size), udta, b.subarray(moov.start + moov.size)]);
  out.set(be32(moov.size + udta.length), moov.start);
  // Every chunk offset that points past the moov moves by the bytes added.
  const walk = (list) => { for (const x of list) { if (x.children) walk(x.children); if (x.type === "stco" || x.type === "co64") offsets(out, x, moov.start, udta.length); } };
  walk(readBoxes(out, moov.start + 8, moov.start + moov.size + udta.length));
  return out;
}

function offsets(b, box, after, delta) {
  const at = box.start + box.headerSize + 4, n = u32(b, at), wide = box.type === "co64";
  for (let i = 0; i < n; i++) {
    const p = at + 4 + i * (wide ? 8 : 4);
    if (wide) { const v = u32(b, p) * 4294967296 + u32(b, p + 4) + (u32(b, p) * 4294967296 + u32(b, p + 4) > after ? delta : 0); b.set(be32(Math.floor(v / 4294967296)), p); b.set(be32(v >>> 0), p + 4); }
    else { const v = u32(b, p); if (v > after) b.set(be32(v + delta), p); }
  }
}

function gif(b, { description }) {
  if (b[b.length - 1] !== 0x3b) return null;
  const t = enc.encode(String(description).slice(0, MAX)), blocks = [];
  for (let i = 0; i < t.length; i += 255) blocks.push(Uint8Array.of(Math.min(255, t.length - i)), t.subarray(i, i + 255));
  return cat([b.subarray(0, b.length - 1), Uint8Array.of(0x21, 0xfe), ...blocks, Uint8Array.of(0, 0x3b)]);
}

// The file with the description inside, or null when the type is not one this writes or the file
// already carries its own metadata. info: { description, creator, source }.
export function embedDescription(bytes, mime, info) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (!info || !info.description) return null;
  try {
    if (mime === "image/jpeg") return jpeg(b, xmpPacket(info));
    if (mime === "image/png") return png(b, xmpPacket(info));
    if (mime === "image/webp") return webp(b, xmpPacket(info));
    if (mime === "video/mp4" || mime === "audio/mp4" || mime === "video/quicktime") return mp4(b, info);
    if (mime === "image/gif") return gif(b, info);
  } catch { return null; }
  return null;
}

// The description a file carries, read back: XMP dc:description, the MP4 comment or the GIF comment.
export function readDescription(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const x = /<dc:description><rdf:Alt><rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/.exec(dec.decode(b));
  if (x) return x[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  for (let k = 4; k + 24 <= b.length; k++) {
    if (b[k] === 0xa9 && b[k + 1] === 0x63 && b[k + 2] === 0x6d && b[k + 3] === 0x74 && ascii(b, k + 8, "data")) return dec.decode(b.subarray(k + 20, k - 4 + u32(b, k - 4)));
  }
  if (ascii(b, 0, "GIF8")) {
    for (let k = b.length - 3; k > 0; k--) {
      if (b[k] !== 0x21 || b[k + 1] !== 0xfe) continue;
      const parts = [];
      let p = k + 2;
      while (p < b.length && b[p]) { parts.push(b.subarray(p + 1, p + 1 + b[p])); p += 1 + b[p]; }
      if (p === b.length - 2) return dec.decode(cat(parts));
    }
  }
  return null;
}
