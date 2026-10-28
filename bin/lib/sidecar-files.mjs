// `daylight sidecar check <folder> [--fix]`, the file half: does each note name the files its own
// save wrote? In 3.8.0 and earlier a save whose name was taken was written as "name (1).jpg" while its note
// still listed "name.jpg", a file of another save, sometimes of another post. A listed file is
// wrong when it is missing, when its bytes carry another post's address, or when it was written
// before the note's save began or long after it. A replacement is taken only on two proofs: the
// file carries this note's post address, and it was written within this save's time window. One
// such file per listed name, or nothing is changed. Reads local files only; --fix rewrites only the
// note's `files:` line and its File line.
import { readdirSync, readFileSync, statSync, openSync, readSync, closeSync, writeFileSync } from "node:fs";
import { join, relative, dirname, extname } from "node:path";

// A save writes its files after the note's `saved` time: up to 15 minutes later for a large gallery,
// and a minute of slack before it for clocks that round.
export const WINDOW = { beforeMs: 60000, afterMs: 15 * 60000 };
// An MP4 keeps its metadata in the moov box, at the start or the end, often past the first 256 KB.
const HEAD = 8 * 1048576;

function* walk(dir, depth = 0) {
  if (depth > 8) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) yield* walk(p, depth + 1);
    else yield { path: p, name, mtimeMs: st.mtimeMs, size: st.size };
  }
}

// The front matter's fields this check reads, each a JSON value on its own line.
export function noteFields(md) {
  if (!md.startsWith("---\nformat: \"daylight.sidecar/1\"")) return null;
  const end = md.indexOf("\n---", 4), head = md.slice(0, end < 0 ? md.length : end), out = {};
  for (const k of ["files", "saved", "post", "kind"]) {
    const m = new RegExp(`^${k}: (.*)$`, "m").exec(head);
    if (m) { try { out[k] = JSON.parse(m[1]); } catch { out[k] = null; } }
  }
  return Array.isArray(out.files) ? out : null;
}

// The post addresses written inside a file (XMP dc:source, an MP4 comment), from its head and tail.
export function embeddedPosts(path, size) {
  const fd = openSync(path, "r");
  try {
    const parts = [[0, Math.min(size, HEAD)], [Math.max(HEAD, size - HEAD), size]].filter(([a, b]) => b > a);
    const text = parts.map(([a, b]) => { const buf = Buffer.alloc(b - a); readSync(fd, buf, 0, b - a, a); return buf.toString("latin1"); }).join("\n");
    return new Set([...text.matchAll(/https:\/\/(?:x|twitter)\.com\/[A-Za-z0-9_]{1,30}\/status\/(\d{5,25})/g)].map((m) => m[1]));
  } finally { closeSync(fd); }
}

const postId = (url) => { const m = /\/status\/(\d{5,25})/.exec(String(url || "")); return m ? m[1] : null; };

// Is this file, by its own evidence, from this note's save? "yes", "no" or "unknown" (no address inside).
function fromSave(file, note) {
  const saved = Date.parse(note.saved), id = postId(note.post);
  if (!file) return "no";
  if (!Number.isFinite(saved) || file.mtimeMs < saved - WINDOW.beforeMs || file.mtimeMs > saved + WINDOW.afterMs) return "no";
  if (!id) return "unknown";
  const posts = file.posts();
  if (posts.has(id)) return "yes";
  return posts.size ? "no" : "unknown";
}

// The other names a browser gives a taken name: "a.jpg" -> "a (1).jpg", "a (2).jpg".
function variants(name, byName) {
  const ext = extname(name), stem = name.slice(0, name.length - ext.length).replace(/ \(\d+\)$/, "");
  const esc = (x) => x.replace(/[.*+?^$()|[\]{}\\]/g, "\\$&");
  const re = new RegExp("^" + esc(stem) + "(?: \\(\\d+\\))?" + esc(ext) + "$");
  return [...byName.values()].filter((f) => f.name !== name && re.test(f.name));
}

function readDir(root) {
  const dirs = new Map();
  for (const f of walk(root)) {
    const d = dirname(f.path);
    if (!dirs.has(d)) dirs.set(d, { files: new Map(), notes: [] });
    let cache;
    const file = { ...f, posts: () => (cache = cache || embeddedPosts(f.path, f.size)) };
    dirs.get(d).files.set(f.name, file);
    if (f.name.endsWith(".md")) {
      const fields = noteFields(readFileSync(f.path, "utf8"));
      if (fields && fields.files.length && fields.kind !== "text") dirs.get(d).notes.push({ ...fields, path: f.path, name: f.name });
    }
  }
  return dirs;
}

// One note's listed files, each kept or given its replacement. claimed: names already proved to
// belong to some note in this folder.
function judge(note, files, claimed) {
  const out = [];
  for (const name of note.files) {
    const file = files.get(name), verdict = fromSave(file, note);
    if (verdict !== "no") { out.push({ name, verdict, to: null }); continue; }
    const proved = variants(name, files).filter((f) => !claimed.has(f.name) && fromSave(f, note) === "yes");
    out.push({ name, verdict: file ? "other" : "missing", to: proved.length === 1 ? proved[0].name : null, candidates: proved.length });
  }
  return out;
}

// { notes, ok, wrong, fixable, unresolved, fixed, flagged: [...], unlisted } for a folder.
export function checkFiles(root, { fix = false } = {}) {
  const r = { notes: 0, ok: 0, wrong: 0, fixable: 0, unresolved: 0, fixed: 0, unlisted: 0, flagged: [] };
  for (const { files, notes } of readDir(root).values()) {
    const claimed = new Set();
    // A listed file proved to be its note's own is claimed first, so no other note can take it.
    for (const n of notes) for (const name of n.files) if (fromSave(files.get(name), n) === "yes") claimed.add(name);
    for (const n of notes) {
      r.notes++;
      const rows = judge(n, files, claimed), bad = rows.filter((x) => x.verdict === "missing" || x.verdict === "other");
      if (!bad.length) { r.ok++; continue; }
      r.wrong++;
      const all = bad.every((x) => x.to);
      if (all) { r.fixable++; for (const x of bad) claimed.add(x.to); } else r.unresolved++;
      r.flagged.push({ file: relative(root, n.path), post: n.post || null, rows: bad.map(({ name, verdict, to, candidates }) => ({ name, verdict, to, candidates })) });
      if (fix && all) { rewrite(n.path, bad); r.fixed++; }
    }
    const listed = new Set(notes.flatMap((n) => n.files));
    for (const x of claimed) listed.add(x);
    for (const f of files.values()) if (!f.name.endsWith(".md") && !f.name.endsWith(".json") && !listed.has(f.name)) r.unlisted++;
  }
  return r;
}

// Only the `files:` line and the File or Files line change; every other byte stays.
export function repairText(md, swaps) {
  const map = new Map(swaps.map((x) => [x.name, x.to]));
  return md.replace(/^files: (.*)$/m, (_, v) => `files: ${JSON.stringify(JSON.parse(v).map((f) => map.get(f) || f))}`)
    .replace(/^- File: (.*)$/m, (_, v) => `- File: ${map.get(v) || v}`)
    .replace(/^- Files: (.*)$/m, (_, v) => `- Files: ${v.split(", ").map((e) => e.replace(/^(\d+\. )(.*)$/, (__, n, f) => n + (map.get(f) || f))).join(", ")}`);
}

function rewrite(path, swaps) { writeFileSync(path, repairText(readFileSync(path, "utf8"), swaps)); }

export function fileLines(r, fixed) {
  const out = [`Checked the files named by ${r.notes} notes: ${r.ok} name only their own files, ${r.wrong} name a file that is missing or from another save (${r.fixable} can be repaired from the files' own post address and time, ${r.unresolved} cannot). ${r.unlisted} saved files are named by no note.`];
  for (const f of r.flagged) for (const x of f.rows) out.push(`${x.to ? (fixed ? "Fixed" : "Fix  ") : "Check"}  ${f.file}: ${x.name} (${x.verdict === "missing" ? "missing" : "from another save"})${x.to ? ` -> ${x.to}` : x.candidates ? `, ${x.candidates} possible files, none proved` : ", no file proved to be this save's"}`);
  if (fixed) out.push(`Repaired ${r.fixed} notes.`);
  else if (r.fixable) out.push("Run again with --fix to repair the notes that can be repaired.");
  return out.join("\n") + "\n";
}
