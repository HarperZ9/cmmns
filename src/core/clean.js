// Share clean: a copy of a file to send to someone, with everything the file says about itself
// removed: EXIF with GPS, XMP, IPTC, ICC profile text, PNG text chunks, GIF comments, MP4 user data
// and creation times, WebM tags, PDF document information and XMP, office document authors, and
// Daylight's own embedded description. Lossless wherever the format allows (every format here):
// pictures, frames and samples are copied byte for byte. After cleaning, the copy is cleaned a
// second time; anything that second pass would still remove means the copy is refused, never
// passed as clean. The lineage (original hash to clean hash) is for the user's own evidence copy
// and is never written into the clean file. Pure: bytes in, bytes out, nothing sent anywhere.

import { cleanJpeg, cleanPng, cleanGif, cleanWebp } from "./clean-image.js";
import { cleanMp4, cleanWebm, isMp4Like } from "./clean-av.js";
import { cleanPdf } from "./clean-pdf.js";
import { cleanOffice, zipNames, isOfficePackage } from "./clean-zip.js";
import { asciiAt, be32, le32, cleanSha256 } from "./clean-util.js";

export const CLEAN_LINEAGE_FORMAT = "daylight.clean-lineage/1";
export const CLEAN_FORMATS = ["JPEG", "PNG", "GIF", "WebP", "MP4, MOV and M4A", "WebM and MKV", "PDF", "Word, Excel and PowerPoint (.docx, .xlsx, .pptx)", "OpenDocument (.odt, .ods, .odp)"];
export const CLEAN_LIMITS = "Share clean removes what the file says about itself. What the picture, sound or words show stays as it is: faces, voices, street signs, reflections, screens, a writing style, and the tracking dots some printers add to every page.";

const CLEANERS = { jpeg: cleanJpeg, png: cleanPng, gif: cleanGif, webp: cleanWebp, mp4: cleanMp4, webm: cleanWebm, pdf: cleanPdf, office: cleanOffice };
const EXT = { jpeg: "jpg", png: "png", gif: "gif", webp: "webp", mp4: "mp4", webm: "webm", pdf: "pdf" };

// The format Share clean reads for these bytes, or null.
export function cleanFormat(b) {
  if (!b || b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b[0] === 0x89 && asciiAt(b, 1, "PNG")) return "png";
  if (asciiAt(b, 0, "GIF8")) return "gif";
  if (asciiAt(b, 0, "RIFF") && asciiAt(b, 8, "WEBP")) return "webp";
  if (be32(b, 0) === 0x1a45dfa3) return "webm";
  if (asciiAt(b, 0, "%PDF-")) return "pdf";
  if (isMp4Like(b)) return "mp4";
  if (le32(b, 0) === 0x04034b50) { try { return isOfficePackage(zipNames(b)) ? "office" : null; } catch { return null; } }
  return null;
}

async function run(format, b) {
  const r = await CLEANERS[format](b);
  return { bytes: r.bytes, removed: r.removed || [], notes: r.notes || [] };
}

// { ok, format, bytes, removed, notes } or { ok: false, format, reason }. Never a silent pass.
export async function shareClean(input) {
  // A private copy: the cleaners edit in place, and a Node Buffer's slice() is a view, so working on
  // the caller's bytes could change their evidence copy.
  const b = new Uint8Array(input);
  const format = cleanFormat(b);
  if (!format) return { ok: false, format: null, reason: `not cleaned: Share clean reads ${CLEAN_FORMATS.join(", ")}, and this file is none of them` };
  let first;
  try { first = await run(format, b); } catch (e) { return { ok: false, format, reason: `not cleaned: ${e.message}` }; }
  let second;
  try { second = await run(format, first.bytes); } catch (e) { return { ok: false, format, reason: `not cleaned: the cleaned copy could not be read back (${e.message})` }; }
  if (second.removed.length) return { ok: false, format, reason: `not cleaned: the copy still carries ${second.removed.join(", ")}` };
  return { ok: true, format, bytes: first.bytes, removed: first.removed, notes: [...first.notes, CLEAN_LIMITS] };
}

// A neutral name for the clean copy: nothing from the original name, which can say who and where.
export function cleanName(format, sha256, ext = null) {
  const e = String(ext || EXT[format] || "bin").replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  return `clean-${String(sha256).slice(0, 12)}.${e}`;
}

// The record that ties a clean copy to its original. It stays with the evidence copy, on this
// device; it is never put inside the shared file or sent anywhere.
export async function cleanLineage(original, result, at = new Date().toISOString()) {
  const o = original instanceof Uint8Array ? original : new Uint8Array(original);
  return {
    format: CLEAN_LINEAGE_FORMAT, at, fileFormat: result.format,
    original: { sha256: await cleanSha256(o), bytes: o.length },
    clean: { sha256: await cleanSha256(result.bytes), bytes: result.bytes.length },
    removed: result.removed,
  };
}
