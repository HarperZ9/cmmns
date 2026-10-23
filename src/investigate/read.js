// `case read`: the Reading lens (src/core/reading.js) and the detector (radar-core analyzeText)
// over every captured post and page. The lens runs with every technique switched on, because in a
// case each finding is a lead for a person to read, and the release ships each technique off until
// it reaches its precision bar; the output says which findings would show by default. The detector
// is passed in, so this module loads no data tables itself.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { readThread, patternCounts, readingOn, lensOn } from "../core/reading.js";

const MAX_CHARS = 20000;

function textOf(data, s) {
  const f = s.capture && s.capture.text_file ? join(data.dir, s.capture.text_file) : null;
  return f && existsSync(f) ? readFileSync(f, "utf8").slice(0, MAX_CHARS) : null;
}

// analyze(text, { id }) -> an evidence envelope. Returns one row per source and the case's frames.
export function readCase(data, analyze) {
  const posts = [], rows = [];
  for (const s of data.sources) {
    const text = textOf(data, s);
    if (text == null || !text.trim()) { rows.push({ source: s.id, read: false, why: text == null ? "no extracted text" : "the capture has no text" }); continue; }
    const env = analyze(text, { id: s.id });
    const items = (env.evidence || []).map((e) => ({ kind: e.kind, level: e.level, label: e.label, shows: e.shows, spans: (e.spans || []).slice(0, 5).map((x) => x.text), context: e.context ?? e.doesNotProve }));
    rows.push({ source: s.id, read: true, chars: text.length, truncated: text.length >= MAX_CHARS, items, lens: [] });
    posts.push({ id: s.id, author: s.author || s.id, text, role: "root" });
  }
  const all = lensOn({ lensAll: true }), shipped = readingOn();
  const read = posts.map((p) => ({ id: p.id, findings: readThread([p], { on: all })[0].findings }));
  for (const r of read) rows.find((x) => x.source === r.id).lens = r.findings.map((f) => ({ technique: f.technique, name: f.name, match: f.match, weight: f.weight, shownByDefault: f.shown && shipped.has(f.technique) }));
  return { format: "daylight-case-reading/2", lens: "Reading lens (src/core/reading.js), every technique on; detector (radar-core analyzeText)", rows, frames: patternCounts(read, posts),
    context: "The lens names how a text argues and the detector names wording signs and known fact-checked claims. Neither shows that a source is wrong, or why it was written. Techniques below their precision bar are shown here for a person to read." };
}

export function readingLines(r) {
  const L = [];
  for (const row of r.rows) {
    if (!row.read) { L.push(`${row.source}: not read (${row.why})`); continue; }
    const parts = [...row.lens.map((f) => `${f.name} ("${f.match}")`), ...row.items.filter((i) => i.level !== "info" || i.kind === "names-theory").map((i) => `${i.label}${i.spans.length ? ` ("${i.spans[0]}")` : ""}`)];
    L.push(`${row.source}: ${parts.length ? parts.join("; ") : "nothing named"}`);
  }
  const frames = r.frames.filter((f) => f.pattern);
  if (frames.length) L.push("", "Frames used by two or more sources and authors: " + frames.map((f) => `${f.name} (${f.posts} sources, ${f.authors} authors)`).join("; "));
  L.push("", `${r.lens}. ${r.context}`);
  return L.join("\n") + "\n";
}
