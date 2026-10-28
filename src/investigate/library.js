// `case add-library <library folder>`: every post of a library the browser extension saved
// (src/core/library.js, project-docs/LIBRARY-CAPTURE.md) becomes a source in the case, with the
// hash of each of its files checked against the hash index.jsonl recorded at save time. The sidecar
// note is the capture the claim, trace, timeline and Reading tools read. Media stays in the library
// folder unless --copy-media is given; its hashes are in the row either way. Offline: nothing here
// makes a request. Posts already in the case (same library and post id) are skipped, so the command
// can be run again after the library grows.
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { join, basename, extname, resolve } from "node:path";
import { sha256, READ_MODES } from "./capture.js";
import { addRow, readJsonl, TABLES } from "./store.js";
import { LIBRARY_SCOPE } from "../core/library.js";

// The front matter of LIBRARY.md, one JSON value per line, or {} when the file is not there.
export function libraryHeader(dir) {
  const p = join(dir, "LIBRARY.md");
  if (!existsSync(p)) return {};
  const m = /^---\n([\s\S]*?)\n---/.exec(readFileSync(p, "utf8").replace(/\r\n?/g, "\n"));
  const out = {};
  for (const line of m ? m[1].split("\n") : []) {
    const kv = /^([a-z_]+): (.*)$/.exec(line);
    if (kv) { try { out[kv[1]] = JSON.parse(kv[2]); } catch { out[kv[1]] = kv[2]; } }
  }
  return out;
}

// Each file of one index line, with its hash on disk now beside the hash recorded at save.
// check: "match", "differs", "missing" (not in the folder) or "hashed-now" (saved unhashed).
export function checkFiles(dir, line) {
  return (line.files || []).map((f) => {
    const p = join(dir, basename(String(f.name)));
    if (!existsSync(p)) return { name: f.name, sha256: f.sha256 || null, disk: null, check: "missing" };
    const disk = sha256(readFileSync(p));
    return { name: f.name, sha256: f.sha256 || null, disk, check: !f.sha256 ? "hashed-now" : f.sha256 === disk ? "match" : "differs" };
  });
}

function sourceRow(dir, caseDir, id, line, files, head, opts) {
  const side = files.filter((f) => /\.md$/i.test(f.name) && f.disk).pop();
  const bytes = side ? readFileSync(join(dir, basename(side.name))) : Buffer.from(JSON.stringify(line, null, 2) + "\n");
  const text = bytes.toString("utf8"), file = `captures/${id}${side ? ".md" : ".json"}`, textFile = `captures/${id}.txt`;
  writeFileSync(join(caseDir, file), bytes);
  writeFileSync(join(caseDir, textFile), text);
  const copied = [];
  if (opts.copyMedia) for (const [k, f] of files.filter((x) => x !== side && x.disk).entries()) {
    const to = `captures/${id}-${k + 1}${extname(f.name).toLowerCase()}`;
    copyFileSync(join(dir, basename(f.name)), join(caseDir, to));
    copied.push(to);
  }
  return {
    kind: "library-post", url: line.url || null, file: side ? side.name : null, title: null, author: line.handle || null,
    source_date: line.posted || null, accessed: line.saved || null, added: opts.now(), read_mode: `${READ_MODES.file}: a post the browser extension saved from the page`,
    tier: opts.tier || null, origin: opts.origin || null, what: opts.what || null,
    capture: { file, sha256: sha256(bytes), bytes: bytes.length, text_file: textFile, text_sha256: sha256(Buffer.from(text, "utf8")) },
    archive: { service: null, note: "saved by the browser extension from the page; nothing requested" },
    library: { folder: head.library || basename(dir), post: String(line.id), kind: line.kind || null, files, ...(copied.length ? { copied } : {}), ...(line.missing ? { missing: line.missing } : {}) },
    post: null,
  };
}

// opts: { now, copyMedia, origin, tier, what }. Returns { added, already, checks, folder, head }.
export function addLibrary(caseDir, libDir, opts = {}) {
  const dir = resolve(libDir), index = join(dir, "index.jsonl");
  if (!existsSync(index)) throw new Error(`${dir} has no index.jsonl; point at a library folder the extension saved (Daylight/library/<site>-<name>)`);
  const head = libraryHeader(dir), folder = head.library || basename(dir), now = opts.now || (() => new Date().toISOString());
  const have = new Set(readJsonl(join(caseDir, TABLES.sources[0])).filter((s) => s.library).map((s) => `${s.library.folder}/${s.library.post}`));
  const out = { folder, head, added: [], already: 0, checks: { match: 0, differs: [], missing: [], "hashed-now": 0 } };
  for (const line of readJsonl(index)) {
    if (!line || !line.id) continue;
    if (have.has(`${folder}/${line.id}`)) { out.already++; continue; }
    const files = checkFiles(dir, line);
    for (const f of files) {
      if (f.check === "match" || f.check === "hashed-now") out.checks[f.check]++;
      else out.checks[f.check].push(f.name);
    }
    const rows = readJsonl(join(caseDir, TABLES.sources[0])), id = "S" + String(rows.reduce((m, r) => Math.max(m, Number((/^S(\d+)$/.exec(r.id) || [])[1] || 0)), 0) + 1).padStart(2, "0");
    const row = addRow(caseDir, "sources", sourceRow(dir, caseDir, id, line, files, { ...head, library: folder }, { ...opts, now }));
    if (row.id !== id) throw new Error(`source id changed while writing (${id} -> ${row.id}); another process is writing this case`);
    have.add(`${folder}/${line.id}`);
    out.added.push(row.id);
  }
  return out;
}

export function addLibraryLines(r) {
  const c = r.checks, L = [];
  L.push(r.added.length ? `Added ${r.added.length} post${r.added.length === 1 ? "" : "s"} from library ${r.folder} as ${r.added[0]}${r.added.length > 1 ? ` to ${r.added[r.added.length - 1]}` : ""}.` : `No new posts in library ${r.folder}.`);
  if (r.already) L.push(`${r.already} already in the case, skipped.`);
  L.push(`Hashes: ${c.match} match the library index${c["hashed-now"] ? `, ${c["hashed-now"]} were saved unhashed and are hashed now` : ""}.`);
  if (c.differs.length) L.push(`${c.differs.length} file${c.differs.length === 1 ? " differs" : "s differ"} from the hash recorded at save (changed since): ${c.differs.slice(0, 8).join(", ")}${c.differs.length > 8 ? ", ..." : ""}`);
  if (c.missing.length) L.push(`${c.missing.length} file${c.missing.length === 1 ? " is" : "s are"} not in the folder: ${c.missing.slice(0, 8).join(", ")}${c.missing.length > 8 ? ", ..." : ""}`);
  L.push("", ...LIBRARY_SCOPE);
  return L.join("\n") + "\n";
}
