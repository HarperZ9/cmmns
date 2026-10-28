// Share clean for video and audio containers: MP4 and QuickTime (also M4A), and WebM or Matroska.
// Nothing moves. A metadata box or element is overwritten in place by padding of the same length
// (an MP4 "free" box, a Matroska Void element) with its content zeroed, so every chunk offset,
// seek entry and cue stays valid and the coded frames and samples are the same bytes as before.
// Each function returns { bytes, removed }.

import { readBoxes, readEbml } from "./media-read.js";
import { be32, asciiAt, indexOfBytes, cleanEnc } from "./clean-util.js";

// Google's spherical-video uuid tells players how to project the picture; it is kept.
const SPHERICAL_UUID = "ffcc8263f8554a938814587a02521fdd";
const TIME_BOXES = new Set(["mvhd", "tkhd", "mdhd"]);

function freeBox(out, box) {
  out.set(cleanEnc.encode("free"), box.start + 4);
  out.fill(0, box.start + box.headerSize, box.start + box.size);
}

function mp4Label(b, box) {
  const inside = b.subarray(box.start, box.start + box.size);
  const loc = indexOfBytes(inside, "location.ISO6709") >= 0 || indexOfBytes(inside, Uint8Array.of(0xa9, 0x78, 0x79, 0x7a)) >= 0;
  const what = box.type === "udta" ? "user data (title, comment, device, CMMNS's description)" : box.type === "meta" ? "metadata tags (ilst, keys)" : box.type === "uuid" ? "vendor block (uuid, often XMP)" : "leftover bytes in free space";
  return loc ? `${what}, with a location` : what;
}

// Zeroes creation and modification times in mvhd, tkhd and mdhd. Version 1 uses 64-bit times.
function zeroTimes(out, box) {
  const at = box.start + box.headerSize, wide = out[at] === 1, end = at + 4 + (wide ? 16 : 8);
  const set = out.subarray(at + 4, end).some((x) => x);
  out.fill(0, at + 4, end);
  return set;
}

export function cleanMp4(b) {
  const top = readBoxes(b);
  if (!top.length || !top.some((x) => x.type === "moov" || x.type === "ftyp")) throw new Error("not an MP4 or QuickTime file");
  const out = b.slice(), removed = [];
  let times = 0;
  const walk = (list) => {
    for (const box of list) {
      const uuid = box.type === "uuid" ? Array.from(b.subarray(box.start + box.headerSize, box.start + box.headerSize + 16), (x) => x.toString(16).padStart(2, "0")).join("") : null;
      if (box.type === "udta" || box.type === "meta" || (uuid && uuid !== SPHERICAL_UUID)) { removed.push(mp4Label(b, box)); freeBox(out, box); continue; }
      if ((box.type === "free" || box.type === "skip") && out.subarray(box.start + box.headerSize, box.start + box.size).some((x) => x)) { removed.push(mp4Label(b, box)); out.fill(0, box.start + box.headerSize, box.start + box.size); continue; }
      if (TIME_BOXES.has(box.type) && zeroTimes(out, box)) times++;
      if (box.children) walk(box.children);
    }
  };
  walk(top);
  if (times) removed.push(`creation and modification times (${times} boxes)`);
  return { bytes: out, removed: [...new Set(removed)] };
}

// A Void element (0xEC) covering exactly [start, end): one size byte when it fits, else eight.
function voidOver(out, start, end) {
  const total = end - start;
  if (total < 2) return false;
  out.fill(0, start, end);
  out[start] = 0xec;
  if (total <= 128) { out[start + 1] = 0x80 | (total - 2); return true; }
  if (total < 9) return false;
  let n = total - 9;
  out[start + 1] = 0x01;
  for (let k = 8; k >= 2; k--) { out[start + k] = n % 256; n = Math.floor(n / 256); }
  return true;
}

const WEBM_TEXT = { "7BA9": "title", "4D80": "muxing app", "5741": "writing app", "4461": "date made", "536E": "track name" };
const WEBM_VOID = { "1254C367": "tags", "1941A469": "attachments" };

function webmWalk(b, out, list, removed) {
  for (const el of list) {
    if (WEBM_VOID[el.id] && !el.unknownSize) { if (voidOver(out, el.start, el.end)) removed.push(WEBM_VOID[el.id]); continue; }
    if (WEBM_TEXT[el.id]) { if (out.subarray(el.dataStart, el.end).some((x) => x)) removed.push(WEBM_TEXT[el.id]); out.fill(0, el.dataStart, el.end); continue; }
    if (el.id === "EC" && out.subarray(el.dataStart, el.end).some((x) => x)) { out.fill(0, el.dataStart, el.end); removed.push("leftover bytes in padding"); continue; }
    if (el.children && ["18538067", "1549A966", "1654AE6B", "AE"].includes(el.id)) webmWalk(b, out, el.children, removed);
  }
}

export function cleanWebm(b) {
  if (be32(b, 0) !== 0x1a45dfa3) throw new Error("not a WebM or Matroska file");
  const out = b.slice(), removed = [];
  webmWalk(b, out, readEbml(b), removed);
  return { bytes: out, removed: [...new Set(removed)] };
}

export const isMp4Like = (b) => asciiAt(b, 4, "ftyp") || asciiAt(b, 4, "moov") || asciiAt(b, 4, "mdat") || asciiAt(b, 4, "free") || asciiAt(b, 4, "wide");
