// Importing a hand-made case (the 2026-10-23 cases: a sources.jsonl in one of two hand formats,
// a CASE.md with timeline tables) into the case format. Source ids are kept when they are S ids,
// so the old CASE.md still reads against the new sources. Capture files are copied only when asked.
// The import never edits the original folder.
import { readFileSync, existsSync, copyFileSync } from "node:fs";
import { join, extname } from "node:path";
import { within, isWithin } from "./paths.js";
import { readJsonl, writeJsonl, TABLES } from "./store.js";
import { dayOf } from "./timeline.js";

const ORIGIN = /\((\w[\w .&'-]*?) origin\)/i;
const KIND = { "x-post": "x-post", news: "web", magazine: "web", "truth-social": "post", "federal-record": "record", "sec-filing": "record", law: "record", policy: "web" };

// One legacy row to a source row. legacyId keeps the old id when it was not an S id.
export function legacySource(r, id) {
  const c = r.capture || {};
  const file = c.raw_file || c.local_file || null, hash = c.sha256_raw || c.sha256 || c.sha256_text || null;
  const arch = r.archive || {};
  const wayback = r.archive_url || arch.wayback_url || null;
  const date = String(r.source_date || "");
  return {
    id, legacy_id: r.id !== id ? r.id : undefined, kind: KIND[r.kind] || r.kind || "web", url: r.url || null, file: null,
    title: r.source || r.role || null, author: r.author || (String(r.source || "").match(/\((@\w+)\)/) || [])[1] || null,
    source_date: /^\d{4}-\d{2}-\d{2}/.test(date) ? date : null, source_date_note: /^\d{4}-\d{2}-\d{2}/.test(date) ? undefined : date || undefined,
    accessed: c.captured_utc && /^\d{4}-\d{2}-\d{2}T/.test(c.captured_utc) ? c.captured_utc : r.access_date || (dayOf(c.captured_utc) || null),
    read_mode: c.method || null, tier: r.tier || null, origin: (String(r.tier || "").match(ORIGIN) || [])[1] || null, what: r.what || null,
    capture: { file: file ? `captures/${id}${extname(file) || ".bin"}` : null, sha256: hash, hash_of: c.sha256_raw || c.sha256 ? "raw bytes" : c.sha256_text ? "extracted text" : null, legacy_file: file, text_file: null },
    archive: wayback ? { service: "Wayback Machine", url: wayback, requested: arch.lookup_utc || null } : { service: null, note: r.archive_note || arch.archive_today_error || "no archive copy recorded" },
    post: null,
  };
}

// Rows from a legacy folder. S ids are kept; other ids get the next free S id in file order.
export function legacySources(folder) {
  const rows = readJsonl(join(folder, "sources.jsonl"));
  const taken = new Set(rows.map((r) => r.id).filter((x) => /^S\d+$/.test(x)));
  let n = 0;
  const nextFree = () => { do n++; while (taken.has(`S${String(n).padStart(2, "0")}`)); return `S${String(n).padStart(2, "0")}`; };
  return rows.map((r) => legacySource(r, /^S\d+$/.test(r.id) ? r.id : nextFree()));
}

// Markdown timeline tables ("| Date (UTC) | Event | Source |") from a CASE.md, as event rows.
export function legacyEvents(md, year) {
  const out = [];
  let inTable = false;
  for (const line of String(md).split(/\r?\n/)) {
    if (/^\|\s*Date[^|]*\|\s*Event\s*\|\s*Source\s*\|/i.test(line)) { inTable = true; continue; }
    if (!inTable) continue;
    if (!line.startsWith("|")) { inTable = false; continue; }
    if (/^\|\s*-+/.test(line)) continue;
    const [d, ev, src] = line.split("|").slice(1, 4).map((x) => x.trim());
    const m = d.match(/(\d{2})-(\d{2})(?:\s+(\d{2}:\d{2}))?/);
    if (!m) continue;
    const sources = (src.match(/S\d{2}/g) || []);
    out.push({ date: `${year}-${m[1]}-${m[2]}${m[3] ? `T${m[3]}:00Z` : ""}`, text: ev.replace(/\*\*/g, ""), source: sources[0] || null, also: sources.slice(1), date_text: d });
  }
  return out;
}

// Imports into an initialised case folder. withCaptures copies the capture files across.
export function importLegacy(caseDir, folder, { withCaptures = false, year } = {}) {
  if (!existsSync(join(folder, "sources.jsonl"))) throw new Error(`${folder} has no sources.jsonl`);
  const sources = legacySources(folder).map((s) => JSON.parse(JSON.stringify(s)));
  let copied = 0;
  for (const s of sources) {
    const src = s.capture.legacy_file && isWithin(folder, s.capture.legacy_file) ? within(folder, s.capture.legacy_file, "the old case folder") : null;
    if (withCaptures && src && existsSync(src)) { copyFileSync(src, join(caseDir, s.capture.file)); copied++; } else if (s.capture.file) s.capture.included = false;
  }
  writeJsonl(join(caseDir, TABLES.sources[0]), sources);
  const md = existsSync(join(folder, "CASE.md")) ? readFileSync(join(folder, "CASE.md"), "utf8") : "";
  const yr = year || (md.match(/opened (\d{4})-/) || [])[1] || new Date().getUTCFullYear();
  const events = legacyEvents(md, yr).map((e, i) => ({ id: `T${String(i + 1).padStart(2, "0")}`, ...e }));
  writeJsonl(join(caseDir, TABLES.events[0]), events);
  return { sources: sources.length, events: events.length, copied };
}
