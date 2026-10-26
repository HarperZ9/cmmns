// Share clean for PDF. A PDF's cross-reference table counts bytes, so every change is made in
// place at the same length: the document information dictionary (author, title, creator,
// producer, dates) is emptied to spaces, each XMP metadata stream is overwritten with spaces and
// its compression filter removed, the file identifiers are zeroed, and each embedded JPEG photo
// loses its EXIF, XMP and comments as same-length empty comments. Page content is never touched.
// Returns { bytes, removed }; throws for an encrypted PDF or when the information dictionary sits
// inside a compressed object stream, which cannot be cleaned without rewriting the file.

import { cleanDec } from "./clean-util.js";
import { cleanJpeg } from "./clean-image.js";

// The end (exclusive) of the dictionary that opens at s[at] === "<<".
function dictEnd(s, at) {
  let depth = 0, i = at;
  while (i < s.length) {
    const c = s[i];
    if (c === "(") { let d = 1; i++; while (i < s.length && d) { if (s[i] === "\\") i++; else if (s[i] === "(") d++; else if (s[i] === ")") d--; i++; } continue; }
    if (c === "<" && s[i + 1] === "<") { depth++; i += 2; continue; }
    if (c === ">" && s[i + 1] === ">") { depth--; i += 2; if (!depth) return i; continue; }
    if (c === "<") { i = s.indexOf(">", i) + 1 || s.length; continue; }
    i++;
  }
  return -1;
}

const spaces = (out, a, b) => { for (let i = a; i < b; i++) if (out[i] !== 0x0a && out[i] !== 0x0d) out[i] = 0x20; };

function objects(s) {
  const out = [];
  for (const m of s.matchAll(/(?<![0-9])(\d+)\s+(\d+)\s+obj\s*<</g)) {
    const open = m.index + m[0].length - 2, end = dictEnd(s, open);
    if (end > 0) out.push({ num: m[1], gen: m[2], open, end, dict: s.slice(open, end) });
  }
  return out;
}

function streamRange(s, end) {
  const m = /^\s*stream\r?\n/.exec(s.slice(end, end + 32));
  if (!m) return null;
  const start = end + m[0].length;
  let stop = s.indexOf("endstream", start);
  if (stop < 0) return null;
  if (s[stop - 1] === "\n") stop--;
  if (s[stop - 1] === "\r") stop--;
  return [start, stop];
}

function cleanInfo(s, out, objs, removed) {
  const refs = [...s.matchAll(/\/Info\s+(\d+)\s+(\d+)\s+R/g)].map((m) => `${m[1]} ${m[2]}`);
  for (const ref of new Set(refs)) {
    const hits = objs.filter((o) => `${o.num} ${o.gen}` === ref);
    if (!hits.length) throw new Error("the document information sits inside a compressed object stream; Share clean cannot remove it without rewriting the PDF");
    let had = false;
    for (const o of hits) { if (/\S/.test(o.dict.slice(2, -2))) had = true; spaces(out, o.open + 2, o.end - 2); }
    if (had) removed.push("document information (author, title, creator, producer, dates)");
  }
}

function cleanStreams(s, out, objs, removed) {
  for (const o of objs) {
    const isXmp = /\/Type\s*\/Metadata\b/.test(o.dict);
    const dct = /\/Filter\s*(\/DCTDecode|\[\s*\/DCTDecode\s*\])/.test(o.dict);
    if (!isXmp && !dct) continue;
    const r = streamRange(s, o.end);
    if (!r) continue;
    if (isXmp) {
      if (!/\S/.test(s.slice(r[0], r[1])) && !/\/Filter/.test(o.dict)) continue;
      spaces(out, r[0], r[1]);
      for (const m of o.dict.matchAll(/\/(Filter|DecodeParms)\s*(\/\w+|\[[^\]]*\]|<<[^>]*>>)/g)) spaces(out, o.open + m.index, o.open + m.index + m[0].length);
      removed.push("XMP metadata");
    } else {
      try {
        const c = cleanJpeg(out.subarray(r[0], r[1]), { sameLength: true });
        if (c.removed.length && c.bytes.length === r[1] - r[0]) { out.set(c.bytes, r[0]); removed.push(...c.removed.map((x) => `embedded photo: ${x}`)); }
      } catch { removed.push("an embedded photo could not be read and was left as it was"); }
    }
  }
}

export function cleanPdf(b) {
  const s = cleanDec.decode(b);
  if (!s.startsWith("%PDF-")) throw new Error("not a PDF");
  if (/\/Encrypt\s+\d+\s+\d+\s+R|\/Encrypt\s*<</.test(s)) throw new Error("the PDF is encrypted; Share clean cannot read its metadata");
  const out = b.slice(), removed = [], objs = objects(s);
  cleanInfo(s, out, objs, removed);
  cleanStreams(s, out, objs, removed);
  for (const m of s.matchAll(/\/ID\s*\[\s*<([0-9A-Fa-f]*)>\s*<([0-9A-Fa-f]*)>\s*\]/g)) {
    if (!/[1-9A-Fa-f]/.test(m[1] + m[2])) continue;
    for (let i = m.index; i < m.index + m[0].length; i++) if (/[0-9A-Fa-f]/.test(s[i]) && i > m.index + 3) out[i] = 0x30;
    removed.push("file identifiers (/ID)");
  }
  return { bytes: out, removed: [...new Set(removed)] };
}

// What a cleaned PDF still says about its makers, read back. Empty when clean.
export function pdfResidue(b) {
  const s = cleanDec.decode(b), left = [];
  for (const o of objects(s)) {
    if (/\/(Author|Creator|Producer|Title|Subject|Keywords|CreationDate|ModDate)\s*[(<]/.test(o.dict) && [...s.matchAll(/\/Info\s+(\d+)\s+(\d+)\s+R/g)].some((m) => m[1] === o.num)) left.push("document information");
  }
  if (/<x:xmpmeta|<\?xpacket begin/.test(s)) left.push("XMP");
  return [...new Set(left)];
}
