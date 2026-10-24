// Small structure readers for inspecting muxed output: the MP4 box tree, the EBML element tree
// of WebM, and Ogg pages with their CRC rechecked. They report structure and do not decode media.

import { muxReadUint } from "./media-bytes.js";
import { oggCrc32 } from "./media-ogg.js";

const MP4_CONTAINERS = new Set(["moov", "trak", "mdia", "minf", "stbl", "dinf", "edts"]);

// Each box: { type, start, size, headerSize, children? }. size covers the whole box.
export function readBoxes(bytes, start = 0, end = bytes.length) {
  const out = [];
  let pos = start;
  while (pos + 8 <= end) {
    let size = muxReadUint(bytes, pos, 4);
    const type = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8));
    let headerSize = 8;
    if (size === 1) {
      if (pos + 16 > end) break;
      size = muxReadUint(bytes, pos + 8, 8);
      headerSize = 16;
    } else if (size === 0) {
      size = end - pos;
    }
    if (size < headerSize) break;
    const box = { type, start: pos, size, headerSize };
    if (MP4_CONTAINERS.has(type)) box.children = readBoxes(bytes, pos + headerSize, Math.min(end, pos + size));
    out.push(box);
    pos += size;
  }
  return out;
}

const EBML_MASTERS = new Set([
  "1A45DFA3", "18538067", "114D9B74", "4DBB", "1549A966", "1654AE6B", "AE", "E0", "E1",
  "1F43B675", "A0", "1C53BB6B", "BB", "B7", "1254C367", "7373", "63C0", "67C8", "1043A770",
  "45B9", "B6", "6D80", "6240", "5035", "E2", "55B0",
]);

function vintLength(first) {
  for (let len = 1; len <= 8; len++) if (first & (0x80 >> (len - 1))) return len;
  return 0;
}

// Each element: { id, start, headerSize, dataStart, size, end, unknownSize?, children? }.
// size is the declared data size; end may run past the parent, which callers can check.
export function readEbml(bytes, start = 0, end = bytes.length) {
  const out = [];
  let pos = start;
  while (pos < end) {
    const idLen = vintLength(bytes[pos]);
    if (!idLen || pos + idLen >= end) break;
    const id = Array.from(bytes.subarray(pos, pos + idLen), (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    const sizeLen = vintLength(bytes[pos + idLen]);
    if (!sizeLen || pos + idLen + sizeLen > end) break;
    let size = bytes[pos + idLen] & (0xff >> sizeLen);
    let allOnes = size === 0xff >> sizeLen;
    for (let i = 1; i < sizeLen; i++) {
      const b = bytes[pos + idLen + i];
      size = size * 256 + b;
      if (b !== 0xff) allOnes = false;
    }
    const dataStart = pos + idLen + sizeLen;
    const el = { id, start: pos, headerSize: idLen + sizeLen, dataStart, size };
    if (allOnes) {
      el.unknownSize = true;
      el.size = end - dataStart;
    }
    el.end = dataStart + el.size;
    if (EBML_MASTERS.has(id)) el.children = readEbml(bytes, dataStart, Math.min(el.end, bytes.length));
    out.push(el);
    pos = el.end;
  }
  return out;
}

export function readEbmlUint(bytes, el) {
  return muxReadUint(bytes, el.dataStart, el.size);
}

export function readEbmlFloat(bytes, el) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset + el.dataStart, el.size);
  return el.size === 4 ? dv.getFloat32(0, false) : dv.getFloat64(0, false);
}

export function readEbmlText(bytes, el) {
  return new TextDecoder().decode(bytes.subarray(el.dataStart, el.dataStart + el.size));
}

// Each page: header fields, lacing values, the body range and crcOk from a recomputed CRC.
export function readOggPages(bytes) {
  const pages = [];
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 0;
  while (pos + 27 <= bytes.length) {
    if (String.fromCharCode(...bytes.subarray(pos, pos + 4)) !== "OggS") break;
    const count = bytes[pos + 26];
    const lacing = Array.from(bytes.subarray(pos + 27, pos + 27 + count));
    const bodySize = lacing.reduce((n, v) => n + v, 0);
    const size = 27 + count + bodySize;
    if (pos + size > bytes.length) break;
    const lo = dv.getUint32(pos + 6, true), hi = dv.getUint32(pos + 10, true);
    const crc = dv.getUint32(pos + 22, true);
    const copy = bytes.slice(pos, pos + size);
    copy.fill(0, 22, 26);
    const flags = bytes[pos + 5];
    pages.push({
      start: pos, size, version: bytes[pos + 4], headerType: flags,
      continued: Boolean(flags & 1), bos: Boolean(flags & 2), eos: Boolean(flags & 4),
      granule: lo === 0xffffffff && hi === 0xffffffff ? -1 : hi * 4294967296 + lo,
      serial: dv.getUint32(pos + 14, true), sequence: dv.getUint32(pos + 18, true),
      crc, crcOk: oggCrc32(copy) === crc, lacing, bodyStart: pos + 27 + count, bodySize,
    });
    pos += size;
  }
  return pages;
}
