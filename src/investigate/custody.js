// The legal profile: a chain-of-custody bundle in the manner of the Berkeley Protocol on Digital
// Open Source Investigations (identification, collection, preservation, verification). For each
// item: its identifier, where and when it was collected, how, with which tool, its hash at
// collection, the archive copy, and the case's own change history. Captures by accounts that are
// not public figures are withheld from the bundle; their hashes stay in the record.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { within } from "./paths.js";
import { sha256 } from "./capture.js";

export function custodyRows(data, isPublic) {
  return data.sources.map((s) => {
    const f = s.capture && s.capture.file ? within(data.dir, s.capture.file) : null;
    const present = !!(f && existsSync(f));
    const now = present ? sha256(readFileSync(f)) : null;
    const withheld = s.kind === "x-post" && s.author && !isPublic(s.author);
    return {
      id: s.id, url: s.url, file: s.file, kind: s.kind, collected: s.accessed, method: s.read_mode, published: s.source_date,
      sha256_at_collection: s.capture ? s.capture.sha256 : null, sha256_now: now,
      integrity: !present ? "capture file missing" : now === (s.capture && s.capture.sha256) ? "unchanged since collection" : "CHANGED since collection",
      archive: s.archive || null, included: present && !withheld ? `captures/${s.capture.file.split("/").pop()}` : null,
      withheld: withheld ? "capture by an account not marked public-figure; held by the investigator" : null,
    };
  });
}

export function custodyMarkdown(data, rows, ctx) {
  const L = [`# Chain of custody: ${data.meta.name}`, "", `Generated ${ctx.at} by ${ctx.tool}. Case opened ${data.meta.created}.`, "",
    "Each item below was collected by the tool named, from the address given, at the time given. The sha256 was computed from the bytes at collection and again at export. A match shows the bytes have not changed since collection. It does not show that the content is true or who made it.", ""];
  for (const r of rows) {
    L.push(`## ${r.id}`, "", `- Address: ${r.url || r.file || "none"}`, `- Collected: ${r.collected}, ${r.method}`, `- Published: ${r.published || "not stated"}`,
      `- sha256 at collection: ${r.sha256_at_collection || "not recorded"}`, `- sha256 at export: ${r.sha256_now || "not available"} (${r.integrity})`,
      `- Archive: ${r.archive && r.archive.url ? `${r.archive.url}, requested ${r.archive.requested}` : `none${r.archive && r.archive.error ? `: ${r.archive.error}` : r.archive && r.archive.note ? `: ${r.archive.note}` : ""}`}`,
      `- In this bundle: ${r.included || `no. ${r.withheld || "not available"}`}`, "");
  }
  L.push("## Handling log", "", "The case folder is its own git repository. Each line is one recorded change.", "", ...(ctx.history || ["(no history available)"]).map((h) => `- ${h}`), "");
  return L.join("\n");
}
