// Upstream-change guard: compares a freshly built (or fetched) table with the locked one and
// prints a reviewable diff, so an upstream editor cannot silently change what Radar tells users.
// It flags, for a person to read before the lock is refreshed:
//   - mass removal: many keys gone at once;
//   - bulk edit: many keys changed at once;
//   - a label flip on a high-reach site (data/high-reach.json): owner, parent, publisher, state,
//     country or owner type changed, or the site dropped;
//   - any state label added, changed or removed, at any reach;
//   - a fact-checker whose rows all vanished.
//   node scripts/upstream-guard.mjs --old <locked file> --new <fresh file> [--kind owners|state|sites|claims|ops|confusables] [--json]
// --old defaults to the committed copy of --new (git show HEAD:<path>). Exits 1 when anything is
// flagged high, so a refresh stops until someone reads the report. No network access.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { VIEWS, LABEL_FIELDS, detectKind, domainOf } from "./upstream-views.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const THRESHOLDS = { removedShare: 0.02, removedMin: 20, changedShare: 0.05, changedMin: 50, checkerMin: 20 };

export function diffViews(oldMap, newMap) {
  const added = [], removed = [], changed = [];
  for (const [k, v] of newMap) if (!oldMap.has(k)) added.push({ key: k, to: v });
  for (const [k, v] of oldMap) {
    if (!newMap.has(k)) { removed.push({ key: k, from: v }); continue; }
    const w = newMap.get(k);
    for (const f of new Set([...Object.keys(v), ...Object.keys(w)])) if ((v[f] ?? "") !== (w[f] ?? "")) changed.push({ key: k, field: f, from: v[f] ?? "", to: w[f] ?? "" });
  }
  return { added, removed, changed, before: oldMap.size, after: newMap.size };
}

const inReach = (reach, key) => { const d = domainOf(key).replace(/^www\./, ""); return [...reach].some((r) => d === r || d.endsWith("." + r)); };

// Volume flags: a large share of keys removed or edited in one refresh.
function volumeFlags(d, t) {
  const out = [], changedKeys = new Set(d.changed.map((c) => c.key)).size;
  if (d.removed.length >= Math.max(t.removedMin, t.removedShare * d.before)) out.push({ level: "high", kind: "mass removal", detail: `${d.removed.length} of ${d.before} keys removed` });
  if (changedKeys >= Math.max(t.changedMin, t.changedShare * d.before)) out.push({ level: "high", kind: "bulk edit", detail: `${changedKeys} of ${d.before} keys changed` });
  return out;
}

// Label flags: a high-reach site whose label changed or vanished; any state label change.
function labelFlags(d, kind, reach) {
  const out = [], fields = LABEL_FIELDS[kind] || [];
  for (const c of d.changed) {
    if (fields.includes(c.field) && inReach(reach, c.key)) out.push({ level: "high", kind: "high-reach label flip", detail: `${c.key}: ${c.field} "${c.from}" -> "${c.to}"` });
    else if (c.field === "state") out.push({ level: "medium", kind: "state label change", detail: `${c.key}: "${c.from}" -> "${c.to}"` });
  }
  for (const r of d.removed) if (inReach(reach, r.key)) out.push({ level: "high", kind: "high-reach removal", detail: `${r.key} dropped` });
  if (kind === "state") {
    for (const a of d.added) out.push({ level: "medium", kind: "state label added", detail: `${a.key}: ${a.to.state}` });
    for (const r of d.removed) if (!inReach(reach, r.key)) out.push({ level: "medium", kind: "state label removed", detail: `${r.key}: ${r.from.state}` });
  }
  return out;
}

// A fact-checker with many rows before and none after: a source dropping out, or being dropped.
function checkerFlags(oldMap, newMap, t) {
  const count = (m) => { const c = new Map(); for (const v of m.values()) c.set(v.checker, (c.get(v.checker) || 0) + 1); return c; };
  const before = count(oldMap), after = count(newMap), out = [];
  for (const [who, n] of before) if (n >= t.checkerMin && !after.has(who)) out.push({ level: "high", kind: "fact-checker vanished", detail: `${who}: ${n} rows before, none after` });
  return out;
}

// Owner rows carrying a hand-kept correction (data/owner-corrections.json): when Wikidata now says
// the same as the correction, it can be retired; when Wikidata changed again, someone should look.
export function correctionFlags(oldData, newData) {
  const sort = (o) => String(o || "").split("; ").sort().join("; "), out = [];
  const before = new Map(((oldData && oldData.rows) || []).filter((r) => r.correction).map((r) => [r.domain, r.correction.upstream]));
  for (const r of (newData && newData.rows) || []) {
    if (!r.correction) continue;
    const up = r.correction.upstream, was = before.get(r.domain);
    if (sort(up.owner) === sort(r.owner) && (up.via || "owner") === (r.via || "owner")) out.push({ level: "medium", kind: "correction can be retired", detail: `${r.domain}: Wikidata now says "${up.owner}", the same as the correction` });
    else if (was && sort(was.owner) !== sort(up.owner)) out.push({ level: "medium", kind: "upstream changed under a correction", detail: `${r.domain}: Wikidata "${was.owner}" -> "${up.owner}"; the correction still shows "${r.owner}"` });
  }
  return out;
}

export function guard(oldData, newData, { kind = detectKind(newData), reach = new Set(), thresholds = THRESHOLDS } = {}) {
  const oldMap = VIEWS[kind](oldData), newMap = VIEWS[kind](newData), d = diffViews(oldMap, newMap);
  const flags = [...volumeFlags(d, thresholds), ...labelFlags(d, kind, reach), ...(kind === "claims" ? checkerFlags(oldMap, newMap, thresholds) : []), ...(kind === "owners" ? correctionFlags(oldData, newData) : [])];
  return { kind, ...d, flags, high: flags.filter((f) => f.level === "high").length };
}

export function formatReport(r, limit = 40) {
  const lines = [`${r.kind}: ${r.before} -> ${r.after} keys; ${r.added.length} added, ${r.removed.length} removed, ${r.changed.length} field changes`];
  lines.push(r.flags.length ? `${r.flags.length} flagged (${r.high} high):` : "nothing flagged");
  for (const f of r.flags.slice(0, limit)) lines.push(`  [${f.level}] ${f.kind}: ${f.detail}`);
  if (r.flags.length > limit) lines.push(`  ... and ${r.flags.length - limit} more (use --json for all)`);
  for (const [name, list, show] of [["changed", r.changed, (c) => `${c.key}: ${c.field} "${c.from}" -> "${c.to}"`], ["removed", r.removed, (x) => x.key], ["added", r.added, (x) => x.key]]) {
    if (!list.length) continue;
    lines.push(`${name} (first ${Math.min(limit, list.length)} of ${list.length}):`);
    for (const x of list.slice(0, limit)) lines.push("  " + show(x));
  }
  return lines.join("\n");
}

// A table as the guard reads it: claims parts are joined, confusables stay text. read(name) returns
// the text of a file next to the table (for claims parts).
export function readTable(text, path, read) {
  if (/\.txt$/.test(path)) return text;
  const t = JSON.parse(text);
  if (Array.isArray(t.parts)) t.rows = [...t.rows, ...t.parts.flatMap((p) => JSON.parse(read(p)).rows)];
  return t;
}

const fromDisk = (path) => readTable(readFileSync(path, "utf8"), path, (n) => readFileSync(join(dirname(path), n), "utf8"));
function fromGit(path) {
  const rel = relative(ROOT, resolve(path)).replace(/\\/g, "/"), show = (p) => execFileSync("git", ["show", `HEAD:${p}`], { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 30 });
  return readTable(show(rel), rel, (n) => show(rel.replace(/[^/]+$/, n)));
}

function cli() {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
  const fresh = arg("--new");
  if (!fresh) { console.error("usage: node scripts/upstream-guard.mjs --new <file> [--old <file>] [--kind K] [--json]"); process.exit(2); }
  const reach = new Set(JSON.parse(readFileSync(join(ROOT, "data/high-reach.json"), "utf8")).domains);
  const oldData = arg("--old") ? fromDisk(arg("--old")) : fromGit(fresh), newData = fromDisk(fresh);
  const r = guard(oldData, newData, { kind: arg("--kind") || detectKind(newData), reach });
  console.log(process.argv.includes("--json") ? JSON.stringify(r, null, 1) : formatReport(r));
  process.exit(r.high ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) cli();
