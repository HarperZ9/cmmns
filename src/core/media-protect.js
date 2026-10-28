// Protected media, found before anything is saved. CMMNS never touches DRM or Encrypted
// Media Extensions streams: it says plainly that the media is protected and stops. Three places can
// show protection: the page element (a video with MediaKeys attached plays through EME), the
// manifest (HLS keys, DASH ContentProtection, media-hls.js and media-dash.js), and the file itself
// (MP4 encryption boxes, WebM ContentEncryption). Pure: the content script passes what it read.

import { readBoxes } from "./media-read.js";

export const PROTECTED_LINE = "This media is protected (DRM or encrypted). CMMNS does not save protected media, and there is nothing to change in the settings to allow it.";

// The four-character codes that only appear in encrypted MP4: protected sample entries, the
// protection scheme box, the track encryption box and the system-specific header.
const MP4_ENCRYPTED = ["encv", "enca", "sinf", "tenc", "pssh", "senc"];

function hasCode(bytes, start, end, code) {
  const c = [...code].map((ch) => ch.charCodeAt(0));
  for (let i = start; i + 4 <= end; i++) if (bytes[i] === c[0] && bytes[i + 1] === c[1] && bytes[i + 2] === c[2] && bytes[i + 3] === c[3]) return true;
  return false;
}

// The encryption marker in an MP4 or fragmented MP4 file, read only inside moov and moof headers
// (never inside mdat, where sample data could carry any four bytes), or null.
export function mp4Encryption(bytes) {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  let boxes;
  try { boxes = readBoxes(u); } catch { return null; }
  for (const b of boxes) {
    if (!["moov", "moof"].includes(b.type)) continue;
    const end = Math.min(u.length, b.start + b.size);
    const hit = MP4_ENCRYPTED.find((code) => hasCode(u, b.start + b.headerSize, end, code));
    if (hit) return hit;
  }
  return null;
}

// True when a WebM or Matroska header carries ContentEncryption (id 0x5035) with an algorithm
// (ContentEncAlgo, 0x47E1). Only the first 256 KB are read: Tracks come before any Cluster.
export function webmEncryption(bytes) {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  let end = Math.min(u.length, 262144);
  // Stop at the first Cluster (0x1F43B675): past it the bytes are media data.
  for (let i = 0; i + 3 < end; i++) if (u[i] === 0x1f && u[i + 1] === 0x43 && u[i + 2] === 0xb6 && u[i + 3] === 0x75) { end = i; break; }
  for (let i = 0; i + 1 < end; i++) {
    if (u[i] !== 0x50 || u[i + 1] !== 0x35) continue;
    for (let j = i + 2; j + 1 < Math.min(end, i + 40); j++) if (u[j] === 0x47 && u[j + 1] === 0xe1) return true;
  }
  return false;
}

// What the page said about one element: { mediaKeys: boolean, encrypted: boolean } where
// mediaKeys is the element's MediaKeys and encrypted is an "encrypted" event the scan saw.
export function elementProtection(el) {
  if (el && (el.mediaKeys || el.encrypted)) return "The page plays this media through Encrypted Media Extensions (DRM).";
  return null;
}

// The first reason any check gives, as { protected, reason, line }.
export function mediaProtection(...reasons) {
  const reason = reasons.find(Boolean) || null;
  return { protected: !!reason, reason, line: reason ? PROTECTED_LINE : null };
}

// The file's own marker, for bytes already fetched, as a reason or null.
export function fileProtection(bytes) {
  const mp4 = mp4Encryption(bytes);
  if (mp4) return `The file carries an MP4 encryption box (${mp4}).`;
  if (webmEncryption(bytes)) return "The file carries WebM content encryption.";
  return null;
}
