// Share clean for a case export (`case export --clean`, and always in source-protection mode).
// Every binary file in the export goes through src/core/clean.js. A file Share clean cannot read
// is left out and listed, never passed on as it was; text captures (pages, JSON, plain text) carry
// no file metadata container and are kept, and listed as kept. The lineage of each clean copy
// (original hash to clean hash) goes to lineage/clean.jsonl in the case folder, beside the
// evidence copy, and never into the export.
import { mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { shareClean, cleanFormat, cleanLineage, CLEAN_LIMITS } from "../core/clean.js";

const TEXT = /\.(html?|txt|json|jsonl|md|csv)$/i;

export const LINEAGE_FILE = join("lineage", "clean.jsonl");

function report(out) {
  const L = ["# Share clean", "", "Every file below was cleaned of what it says about itself before export.", ""];
  for (const c of out.cleaned) L.push(`- ${c.file}: removed ${c.removed.length ? c.removed.join("; ") : "nothing; it carried no metadata"}`);
  if (out.text.length) L.push("", "Text captures kept as they are (no file metadata to remove; the words themselves are unchanged):", "", ...out.text.map((f) => `- ${f}`));
  if (out.withheld.length) L.push("", "Left out, because Share clean cannot read them:", "", ...out.withheld.map((w) => `- ${w.file}: ${w.reason}`));
  L.push("", CLEAN_LIMITS, "");
  return L.join("\n");
}

export async function cleanExportFiles(data, files, ctx) {
  const out = { cleaned: [], text: [], withheld: [] }, lineage = [];
  for (const name of Object.keys(files)) {
    const body = files[name];
    if (!Buffer.isBuffer(body)) continue;
    if (!cleanFormat(body)) {
      if (TEXT.test(name)) out.text.push(name);
      else { delete files[name]; out.withheld.push({ file: name, reason: "not a format Share clean reads" }); }
      continue;
    }
    const r = await shareClean(body);
    if (!r.ok) { delete files[name]; out.withheld.push({ file: name, reason: r.reason }); continue; }
    files[name] = Buffer.from(r.bytes);
    out.cleaned.push({ file: name, removed: r.removed });
    lineage.push({ ...(await cleanLineage(body, r, ctx.at)), export: name });
  }
  if (lineage.length) {
    mkdirSync(join(data.dir, "lineage"), { recursive: true });
    appendFileSync(join(data.dir, LINEAGE_FILE), lineage.map((l) => JSON.stringify(l)).join("\n") + "\n");
  }
  files["SHARE-CLEAN.md"] = report(out);
  return out;
}
