// `cmmns sidecar check <folder>`: reads every daylight.sidecar/1 note under a folder and flags the
// ones whose "Continued by the author" parts cannot be trusted. CMMNS 3.6.0 joined posts
// that only sat next to each other on the page, so a note saved from a profile or timeline page may
// hold unrelated posts as a continuation. Notes from 3.6.1 on mark a proved thread
// (thread_complete: true). Reads local files only.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { continuationStatus } from "../../src/core/media-thread.js";

function* notes(dir, depth = 0) {
  if (depth > 8) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) yield* notes(p, depth + 1);
    else if (name.endsWith(".md")) yield p;
  }
}

// { checked, flagged: [{ file, status }], counts } for a folder.
export function checkSidecars(dir) {
  const counts = { verified: 0, unknown: 0, unverified: 0, none: 0 }, flagged = [];
  let checked = 0;
  for (const p of notes(dir)) {
    const md = readFileSync(p, "utf8");
    if (!md.startsWith("---\nformat: \"daylight.sidecar/1\"")) continue;
    checked++;
    const status = continuationStatus(md);
    counts[status]++;
    if (status === "unverified" || status === "unknown") flagged.push({ file: relative(dir, p), status });
  }
  return { checked, flagged, counts };
}

export function checkLines(r) {
  const out = [`Checked ${r.checked} notes: ${r.counts.verified} with a proved thread, ${r.counts.none} with no thread, ${r.counts.unknown} where the thread could not be proved, ${r.counts.unverified} with an unproved continuation.`];
  for (const f of r.flagged) out.push(`${f.status === "unverified" ? "Check" : "Note "}  ${f.file}${f.status === "unverified" ? "  (its continuation may hold unrelated posts; open the post to compare)" : "  (the thread was not saved; save again from the post's own page)"}`);
  return out.join("\n") + "\n";
}
