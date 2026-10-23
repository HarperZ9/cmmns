// File names inside a case or an export come from its own tables, which a person may have edited or
// received from someone else. Every such name is resolved here and must stay inside its folder:
// "../" steps, absolute paths and drive letters are refused, so a crafted case can neither read nor
// write a file outside the folder it describes.
import { resolve, relative, isAbsolute, sep } from "node:path";

export function within(base, rel, what = "the case folder") {
  const name = String(rel == null ? "" : rel);
  if (!name || isAbsolute(name) || /^[a-z]:/i.test(name) || name.includes("\0")) throw new Error(`"${name}" is not a file name inside ${what}; refusing to use it`);
  const root = resolve(base), full = resolve(root, name), r = relative(root, full);
  if (!r || r === ".." || r.startsWith(".." + sep) || isAbsolute(r)) throw new Error(`"${name}" points outside ${what}; refusing to use it`);
  return full;
}

// The same check as a yes or no, for code that skips a bad row instead of stopping.
export function isWithin(base, rel) {
  try { within(base, rel); return true; } catch { return false; }
}
