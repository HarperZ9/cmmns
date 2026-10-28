// Share clean for still images: JPEG, PNG, GIF and WebP. Metadata blocks are removed whole and the
// image data is copied byte for byte, so nothing is decoded or re-encoded. Kept: what changes how
// the picture looks (quantisation and Huffman tables, colour profile with its text blanked, gamma,
// transparency, animation timing). Removed: EXIF with GPS and maker notes, XMP (with CMMNS's
// own description), IPTC and Photoshop blocks, comments, text chunks, Content Credentials, embedded
// thumbnails and anything after the end of the image. Each function returns { bytes, removed }.

import { be16, be32, le32, putBe32, putLe32, asciiAt, latin1, cleanCat, cleanCrc32, cleanEnc, zInflate, zDeflate } from "./clean-util.js";
import { blankIccText } from "./clean-icc.js";

const APP_NAMES = { 0xe1: "EXIF or XMP (APP1)", 0xe2: "APP2 block", 0xeb: "Content Credentials or JPEG extension (APP11)", 0xec: "Ducky (APP12)", 0xed: "IPTC and Photoshop (APP13)", 0xfe: "comment" };

function jpegVerdict(m, seg) {
  if (m === 0xfe && seg.subarray(4).every((x) => x === 0)) return "keep";
  if (m === 0xe0) return asciiAt(seg, 4, "JFIF\0") ? (seg[16] || seg[17] ? "jfif-thumb" : "keep") : "drop";
  if (m === 0xe2 && asciiAt(seg, 4, "ICC_PROFILE\0")) return "icc";
  if (m === 0xee && asciiAt(seg, 4, "Adobe")) return "keep";
  if ((m >= 0xe0 && m <= 0xef) || m === 0xfe) return "drop";
  return "keep";
}

function jpegLabel(m, seg) {
  if (m === 0xe1) return asciiAt(seg, 4, "Exif\0") ? "EXIF (camera, time, GPS, maker notes)" : asciiAt(seg, 4, "http://ns.adobe.com/x") ? "XMP" : "APP1 block";
  if (m === 0xe2 && asciiAt(seg, 4, "MPF\0")) return "multi-picture index (MPF)";
  if (m === 0xe0) return asciiAt(seg, 4, "JFXX") ? "JFIF thumbnail" : "APP0 block";
  return APP_NAMES[m] || `APP${m - 0xe0} block`;
}

// The ICC profile split across APP2 segments, blanked, and written back into the same segments.
function jpegIcc(b, segs, removed) {
  const parts = segs.map((s) => b.subarray(s.at + 18, s.at + 2 + s.len));
  const { bytes, fields } = blankIccText(cleanCat(parts));
  removed.push(...fields);
  let p = 0;
  return segs.map((s, i) => { const seg = b.slice(s.at, s.at + 2 + s.len); seg.set(bytes.subarray(p, p + parts[i].length), 18); p += parts[i].length; return seg; });
}

function scanEnd(b, at) {
  let e = at;
  while (e + 1 < b.length && !(b[e] === 0xff && b[e + 1] !== 0 && !(b[e + 1] >= 0xd0 && b[e + 1] <= 0xd7))) e++;
  return e;
}

// The same segment as an empty comment of the same length: used where the file must keep its size
// (a JPEG inside a PDF, whose cross-reference table counts bytes).
function comOver(seg) { const c = seg.slice(); c[1] = 0xfe; c.fill(0, 4); return c; }

// opts.sameLength: removed blocks become zeroed comments, so the length never changes.
export function cleanJpeg(b, opts = {}) {
  if (b[0] !== 0xff || b[1] !== 0xd8) throw new Error("not a JPEG");
  const out = [b.subarray(0, 2)], removed = [], segs = [];
  let at = 2;
  while (at + 1 < b.length) {
    if (b[at] !== 0xff) throw new Error(`JPEG: no marker at byte ${at}`);
    const m = b[at + 1];
    if (m === 0xff) { out.push(b.subarray(at, at + 1)); at++; continue; }
    if (m === 0xd9) { out.push(b.subarray(at, at + 2)); at += 2; break; }
    if ((m >= 0xd0 && m <= 0xd7) || m === 0x01) { out.push(b.subarray(at, at + 2)); at += 2; continue; }
    const len = be16(b, at + 2), seg = b.subarray(at, at + 2 + len);
    if (m === 0xda) { const e = scanEnd(b, at + 2 + len); out.push(b.subarray(at, e)); at = e; continue; }
    const v = jpegVerdict(m, seg);
    if (v === "keep") out.push(seg);
    else if (v === "icc") { segs.push({ at, len, slot: out.length }); out.push(null); }
    else if (opts.sameLength) { out.push(comOver(seg)); removed.push(v === "jfif-thumb" ? "JFIF thumbnail" : jpegLabel(m, seg)); }
    else if (v === "jfif-thumb") { const j = seg.slice(0, 18); j[2] = 0; j[3] = 16; j[16] = 0; j[17] = 0; out.push(j); removed.push("JFIF thumbnail"); }
    else removed.push(jpegLabel(m, seg));
    at += 2 + len;
  }
  if (at < b.length) {
    if (b.subarray(at).some((x) => x)) removed.push(`${b.length - at} bytes after the end of the image (appended pictures or data)`);
    if (opts.sameLength) out.push(new Uint8Array(b.length - at));
  }
  if (segs.length) jpegIcc(b, segs, removed).forEach((seg, i) => { out[segs[i].slot] = seg; });
  return { bytes: cleanCat(out), removed: [...new Set(removed)] };
}

// PNG: only the chunks that decide how the image looks stay.
const PNG_KEEP = new Set(["IHDR", "PLTE", "IDAT", "IEND", "tRNS", "gAMA", "cHRM", "sRGB", "sBIT", "bKGD", "pHYs", "acTL", "fcTL", "fdAT", "cICP", "mDCv", "cLLi", "hIST"]);
const PNG_NAMES = { tEXt: "text chunk (tEXt)", zTXt: "compressed text chunk (zTXt)", iTXt: "international text or XMP (iTXt)", eXIf: "EXIF (eXIf)", tIME: "last-modified time (tIME)", caBX: "Content Credentials (caBX)", sPLT: "suggested palette with its name (sPLT)" };

function pngChunk(type, data) {
  const td = cleanCat([cleanEnc.encode(type), data]);
  return cleanCat([putBe32(data.length), td, putBe32(cleanCrc32(td))]);
}

async function pngIcc(data, removed) {
  const nul = data.indexOf(0);
  if (nul < 1 || data[nul + 1] !== 0) throw new Error("PNG iCCP chunk not understood");
  const { bytes, fields } = blankIccText(await zInflate(data.subarray(nul + 2)));
  if (latin1(data, 0, nul) !== "ICC profile") removed.push("ICC profile name");
  if (!fields.length && latin1(data, 0, nul) === "ICC profile") return pngChunk("iCCP", data);
  removed.push(...fields);
  return pngChunk("iCCP", cleanCat([cleanEnc.encode("ICC profile"), Uint8Array.of(0, 0), await zDeflate(bytes)]));
}

export async function cleanPng(b) {
  if (!asciiAt(b, 1, "PNG")) throw new Error("not a PNG");
  const out = [b.subarray(0, 8)], removed = [];
  for (let at = 8; at + 12 <= b.length;) {
    const len = be32(b, at), type = latin1(b, at + 4, 4), whole = b.subarray(at, at + 12 + len);
    if (type === "iCCP") out.push(await pngIcc(b.subarray(at + 8, at + 8 + len), removed));
    else if (PNG_KEEP.has(type)) out.push(whole);
    else removed.push(PNG_NAMES[type] || `${type} chunk`);
    at += 12 + len;
    if (type === "IEND") { if (at < b.length) removed.push(`${b.length - at} bytes after the end of the image`); break; }
  }
  return { bytes: cleanCat(out), removed: [...new Set(removed)] };
}

function gifSubBlocks(b, at) { while (b[at]) at += 1 + b[at]; return at + 1; }

export function cleanGif(b) {
  if (!asciiAt(b, 0, "GIF8")) throw new Error("not a GIF");
  const gct = b[10] & 0x80 ? 3 * (2 << (b[10] & 7)) : 0, out = [b.subarray(0, 13 + gct)], removed = [];
  let at = 13 + gct;
  while (at < b.length && b[at] !== 0x3b) {
    if (b[at] === 0x2c) {
      const lct = b[at + 9] & 0x80 ? 3 * (2 << (b[at + 9] & 7)) : 0, end = gifSubBlocks(b, at + 10 + lct + 1);
      out.push(b.subarray(at, end)); at = end; continue;
    }
    if (b[at] !== 0x21) throw new Error(`GIF: unknown block at byte ${at}`);
    const label = b[at + 1], end = gifSubBlocks(b, at + 2);
    const app = label === 0xff ? latin1(b, at + 3, 11) : "";
    if (label === 0xf9 || label === 0x01 || app === "NETSCAPE2.0" || app === "ANIMEXTS1.0") out.push(b.subarray(at, end));
    else removed.push(label === 0xfe ? "comment" : label === 0xff ? (app.startsWith("XMP Data") ? "XMP" : `application block ${app.trim()}`) : `extension 0x${label.toString(16)}`);
    at = end;
  }
  out.push(Uint8Array.of(0x3b));
  if (at + 1 < b.length) removed.push(`${b.length - at - 1} bytes after the end of the image`);
  return { bytes: cleanCat(out), removed: [...new Set(removed)] };
}

const WEBP_KEEP = new Set(["VP8 ", "VP8L", "VP8X", "ALPH", "ANIM", "ANMF", "ICCP"]);

export function cleanWebp(b) {
  if (!asciiAt(b, 0, "RIFF") || !asciiAt(b, 8, "WEBP")) throw new Error("not a WebP");
  const out = [], removed = [];
  const end = Math.min(b.length, 8 + le32(b, 4));
  for (let at = 12; at + 8 <= end;) {
    const type = latin1(b, at, 4), len = le32(b, at + 4), whole = b.subarray(at, at + 8 + len + (len & 1));
    if (type === "ICCP") { const { bytes, fields } = blankIccText(b.subarray(at + 8, at + 8 + len)); out.push(cleanCat([b.subarray(at, at + 8), bytes, len & 1 ? Uint8Array.of(0) : new Uint8Array(0)])); removed.push(...fields); }
    else if (type === "VP8X") { const x = whole.slice(); x[8] &= ~0x0c; out.push(x); }
    else if (WEBP_KEEP.has(type)) out.push(whole);
    else removed.push(type === "EXIF" ? "EXIF (camera, time, GPS)" : type === "XMP " ? "XMP" : `${type.trim()} chunk`);
    at += 8 + len + (len & 1);
  }
  if (end < b.length) removed.push(`${b.length - end} bytes after the end of the image`);
  const body = cleanCat(out);
  return { bytes: cleanCat([cleanEnc.encode("RIFF"), putLe32(body.length + 4), cleanEnc.encode("WEBP"), body]), removed: [...new Set(removed)] };
}
