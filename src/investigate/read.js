// `case read`: the Reading lens over every captured post and page. Until the Reading lens release
// lands, this runs radar-core's analyzeText (the same reading `radar analyze` gives) on each
// capture's extracted text. The analyser is passed in, so this module loads no data tables itself.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const MAX_CHARS = 20000;

// analyze(text, { id }) -> an evidence envelope. Returns one row per source with text.
export function readCase(data, analyze) {
  const rows = [];
  for (const s of data.sources) {
    const f = s.capture && s.capture.text_file ? join(data.dir, s.capture.text_file) : null;
    if (!f || !existsSync(f)) { rows.push({ source: s.id, read: false, why: "no extracted text" }); continue; }
    const text = readFileSync(f, "utf8").slice(0, MAX_CHARS);
    if (!text.trim()) { rows.push({ source: s.id, read: false, why: "the capture has no text" }); continue; }
    const env = analyze(text, { id: s.id });
    const items = (env.evidence || []).map((e) => ({ kind: e.kind, level: e.level, label: e.label, shows: e.shows, spans: (e.spans || []).slice(0, 5).map((x) => x.text), doesNotProve: e.doesNotProve }));
    rows.push({ source: s.id, read: true, chars: text.length, truncated: text.length >= MAX_CHARS, items });
  }
  return { format: "daylight-case-reading/1", lens: "radar-core analyzeText", rows,
    doesNotProve: "The lens names wording techniques and known fact-checked claims in the text. It does not show that a source is wrong, or why it was written." };
}

export function readingLines(r) {
  const L = [];
  for (const row of r.rows) {
    if (!row.read) { L.push(`${row.source}: not read (${row.why})`); continue; }
    const named = row.items.filter((i) => i.level !== "info");
    L.push(`${row.source}: ${row.items.length} items${named.length ? "; " + named.map((i) => `${i.label}${i.spans.length ? ` ("${i.spans[0]}")` : ""}`).join("; ") : ""}`);
  }
  L.push("", `Lens: ${r.lens}. Does not prove: ${r.doesNotProve}`);
  return L.join("\n") + "\n";
}
