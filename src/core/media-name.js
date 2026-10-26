// Names and types for a downloaded file. The type comes from the file's own first bytes when they
// are known, then the server's content type, then the address, so a WebP served from an address
// ending in .jpg is saved as .webp. File names are made from the page or post title and the
// media's own name, safe on Windows, macOS and Linux, and never a path.

const EXT = {
  "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp", "image/avif": "avif", "image/heic": "heic", "image/heif": "heif",
  "image/svg+xml": "svg", "image/bmp": "bmp", "image/x-icon": "ico", "image/vnd.microsoft.icon": "ico", "image/tiff": "tif", "image/jxl": "jxl",
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "video/x-matroska": "mkv", "video/mp2t": "ts", "video/x-msvideo": "avi", "video/ogg": "ogv",
  "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "aac", "audio/ogg": "ogg", "audio/webm": "weba", "audio/wav": "wav", "audio/x-wav": "wav",
  "audio/flac": "flac", "audio/opus": "opus", "application/vnd.apple.mpegurl": "m3u8", "application/dash+xml": "mpd", "application/pdf": "pdf",
};
const BY_EXT = Object.fromEntries(Object.entries(EXT).map(([m, e]) => [e, m]));
Object.assign(BY_EXT, { jpeg: "image/jpeg", jfif: "image/jpeg", m4v: "video/mp4", gifv: "video/mp4", oga: "audio/ogg", tiff: "image/tiff" });

export const downloadExt = (mime) => EXT[String(mime || "").toLowerCase().split(";")[0].trim()] || null;

const ascii = (b, at, s) => b.length >= at + s.length && [...s].every((c, k) => b[at + k] === c.charCodeAt(0));
const bytesAt = (b, at, xs) => b.length >= at + xs.length && xs.every((x, k) => b[at + k] === x);

function isoBrand(b) {
  const brand = String.fromCharCode(...b.subarray(8, 12));
  if (/^avi[fs]$/.test(brand)) return "image/avif";
  if (/^(heic|heix|heim|heis)$/.test(brand)) return "image/heic";
  if (/^(mif1|msf1)$/.test(brand)) return "image/heif";
  if (brand === "qt  ") return "video/quicktime";
  if (/^M4A |^M4B /.test(brand)) return "audio/mp4";
  return "video/mp4";
}

function textType(b) {
  const head = String.fromCharCode(...b.subarray(0, Math.min(b.length, 512))).replace(/^﻿|^\xEF\xBB\xBF/, "").trimStart();
  if (head.startsWith("#EXTM3U")) return "application/vnd.apple.mpegurl";
  if (/<svg[\s>]/i.test(head)) return "image/svg+xml";
  if (/^<MPD[\s>]/.test(head) || /<MPD[\s>]/.test(head)) return "application/dash+xml";
  if (/^<(!doctype html|html|head|body)[\s>]/i.test(head)) return "text/html";
  return null;
}

// The MIME type a file's first bytes show, or null. Sixteen bytes are enough for every binary
// format here; SVG, HTML and playlists are read from the first 512.
export function sniffMime(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (b.length < 4) return null;
  if (bytesAt(b, 0, [0x89, 0x50, 0x4e, 0x47])) return "image/png";
  if (bytesAt(b, 0, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (ascii(b, 0, "GIF8")) return "image/gif";
  if (ascii(b, 0, "RIFF")) return ascii(b, 8, "WEBP") ? "image/webp" : ascii(b, 8, "WAVE") ? "audio/wav" : ascii(b, 8, "AVI ") ? "video/x-msvideo" : null;
  if (ascii(b, 4, "ftyp")) return isoBrand(b);
  if (ascii(b, 4, "moof") || ascii(b, 4, "styp") || ascii(b, 4, "sidx")) return "video/mp4";
  if (bytesAt(b, 0, [0x1a, 0x45, 0xdf, 0xa3])) return String.fromCharCode(...b.subarray(0, 64)).includes("webm") ? "video/webm" : "video/x-matroska";
  if (ascii(b, 0, "OggS")) return "audio/ogg";
  if (ascii(b, 0, "fLaC")) return "audio/flac";
  if (ascii(b, 0, "ID3")) return "audio/mpeg";
  if (b[0] === 0xff && (b[1] & 0xf6) === 0xf0) return "audio/aac";
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0 && (b[1] & 0x06) !== 0) return "audio/mpeg";
  if (b[0] === 0x47 && b.length > 188 && b[188] === 0x47) return "video/mp2t";
  if (ascii(b, 0, "%PDF")) return "application/pdf";
  if (bytesAt(b, 0, [0xff, 0x0a]) || bytesAt(b, 0, [0, 0, 0, 0x0c, 0x4a, 0x58, 0x4c, 0x20])) return "image/jxl";
  if (bytesAt(b, 0, [0x49, 0x49, 0x2a, 0]) || bytesAt(b, 0, [0x4d, 0x4d, 0, 0x2a])) return "image/tiff";
  if (bytesAt(b, 0, [0, 0, 1, 0])) return "image/x-icon";
  if (ascii(b, 0, "BM") && b.length > 14) return "image/bmp";
  return textType(b);
}

const extOfUrl = (url) => {
  // ".jpg", or Bluesky's "@jpeg" at the end of the path
  try { const m = /[.@]([a-z0-9]{2,5})$/i.exec(new URL(url).pathname); return m ? m[1].toLowerCase() : null; } catch { return null; }
};
const GENERIC = /^(application\/octet-stream|binary\/octet-stream|text\/plain|application\/x-www-form-urlencoded)?$/;

// { mime, ext, from } for a download: "bytes" when the first bytes decided it, "header" for the
// server's content type, "address" for the address's extension, or "none" with ext "bin".
export function chooseType({ bytes = null, contentType = "", url = "" } = {}) {
  const sniffed = bytes ? sniffMime(bytes) : null;
  if (sniffed && downloadExt(sniffed)) return { mime: sniffed, ext: downloadExt(sniffed), from: "bytes" };
  const ct = String(contentType || "").toLowerCase().split(";")[0].trim();
  if (!GENERIC.test(ct) && downloadExt(ct)) return { mime: ct, ext: downloadExt(ct), from: "header" };
  const e = extOfUrl(url);
  if (e && BY_EXT[e]) return { mime: BY_EXT[e], ext: EXT[BY_EXT[e]], from: "address" };
  return { mime: ct || "application/octet-stream", ext: "bin", from: "none" };
}

const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/i;

// Letters, digits and single hyphens; any script, never a path, at most `max` characters.
export function slug(s, max = 60) {
  const out = String(s || "").normalize("NFKC").replace(/[\u0000-\u001f\u007f<>:"/\\|?*#%&{}$!'`@=+^~[\];,()‐-―•]+/g, " ")
    .replace(/[\s._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max).replace(/-+$/, "");
  return RESERVED.test(out) ? "_" + out : out;
}

// The media's own name from its address, without the extension, or "" when it is only a number
// or a generic word ("media", "image", "giphy", "DASH_720").
function mediaStem(url) {
  let last = "";
  try { last = decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() || ""); } catch { return ""; }
  const stem = last.replace(/\.[a-z0-9]{2,5}$/i, "");
  return /^(media|image|img|video|file|download|giphy|tenor|original|source|default|playlist|master|index|DASH_\w+|HLS\w*|\d{1,4})$/i.test(stem) ? "" : slug(stem, 40);
}

// "<title>-<media name>[-<n>].<ext>": the title of the page or post, the file's own name when it
// has one, its place in a gallery when there are several, and the extension the type decided.
export function downloadName({ title = "", url = "", index = 0, total = 1, ext = "bin" } = {}) {
  const parts = [slug(title, 60), mediaStem(url)].filter(Boolean);
  let stem = [...new Set(parts)].join("-").slice(0, 100).replace(/-+$/, "") || "media";
  if (total > 1) stem += `-${index + 1}`;
  return `${stem}.${String(ext || "bin").replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin"}`;
}
