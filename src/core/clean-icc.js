// An ICC colour profile with its free text blanked in place: the description, copyright, device
// maker and model, viewing conditions and any other text tag. The colour data stays, so the
// picture looks the same; only the words go. Lengths never change, so the profile stays valid.
// The profile id (an MD5 over the profile) is set to zero, which the ICC spec reads as "not computed".

import { be32, asciiAt } from "./clean-util.js";

// Tags whose value is words written by a person or a device, never colour data.
const TEXT_TAGS = new Set(["desc", "cprt", "dmnd", "dmdd", "vued", "scrd", "targ", "ciis", "meta"]);

function blankText(p, start, end) { for (let i = start; i < end; i++) if (p[i] !== 0) p[i] = 0x20; }

function blankMluc(p, at, end) {
  const n = be32(p, at + 8), size = be32(p, at + 12);
  for (let r = 0; r < n; r++) {
    const rec = at + 16 + r * size;
    if (rec + 12 > end) break;
    const len = be32(p, rec + 4), off = be32(p, rec + 8);
    for (let i = at + off; i + 1 < Math.min(end, at + off + len); i += 2) { p[i] = 0; p[i + 1] = 0x20; }
  }
}

function blankDesc(p, at, end) {
  const n = be32(p, at + 8);
  blankText(p, at + 12, Math.min(end, at + 12 + Math.max(0, n - 1)));
  // The Unicode and ScriptCode parts after the ASCII string: counts and characters to zero.
  for (let i = at + 12 + n; i < end; i++) p[i] = 0;
}

// Returns { bytes, fields } where fields names each blanked tag; bytes is a new array.
export function blankIccText(profile) {
  const p = new Uint8Array(profile);
  const fields = [];
  if (p.length < 132 || !asciiAt(p, 36, "acsp")) return { bytes: p, fields, problem: "not an ICC profile" };
  const count = be32(p, 128);
  for (let i = 0; i < count; i++) {
    const t = 132 + i * 12;
    if (t + 12 > p.length) break;
    const sig = String.fromCharCode(...p.subarray(t, t + 4)), at = be32(p, t + 4), end = Math.min(p.length, at + be32(p, t + 8));
    if (!TEXT_TAGS.has(sig) || at + 8 > p.length) continue;
    const before = p.slice(at, end);
    if (asciiAt(p, at, "mluc")) blankMluc(p, at, end);
    else if (asciiAt(p, at, "desc")) blankDesc(p, at, end);
    else if (asciiAt(p, at, "text")) blankText(p, at + 8, end - 1);
    else for (let k = at + 8; k < end; k++) p[k] = 0;
    if (p.subarray(at, end).some((x, k) => x !== before[k])) fields.push(`ICC ${sig}`);
  }
  // Header: creation time, device maker and model, creator and the profile id. None is colour data.
  let header = false;
  for (const [a, b] of [[24, 36], [48, 56], [80, 100]]) for (let k = a; k < b; k++) { if (p[k]) header = true; p[k] = 0; }
  if (header) fields.push("ICC header time and device");
  return { bytes: p, fields };
}
