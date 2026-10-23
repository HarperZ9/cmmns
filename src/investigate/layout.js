// `case init`: the folder layout of a new case, its README and case.json. The git repository is
// made by the command line (bin/lib/case.mjs), so this module stays pure file work.
import { mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { TABLES } from "./store.js";

export const CASE_FORMAT = "daylight-case/1";
export const DIRS = ["captures", "exports"];

export function readme(name, created) {
  return `# Case: ${name}

Opened ${created.slice(0, 10)}. Made with \`daylight case\` (Daylight Commons).

## Files

- \`sources.jsonl\`: one row per source. URL, access time, read mode, Wayback result, sha256 of the capture.
- \`captures/\`: the captured bytes and their extracted text. Names start with the source id.
- \`claims.jsonl\`: the claim inventory. Each claim has a source and a rung:
  documented, inference, unproven or contradicted.
- \`events.jsonl\`: dated events for the timeline.
- \`edges.jsonl\`: who quoted, replied to or reposted whom, each with a source.
- \`leads.jsonl\`: open leads, the record that would settle each one, and who holds it.
- \`absent.jsonl\`: deleted, edited, sealed and missing records, with their custodians.
- \`actors.jsonl\`: accounts and people named in the case. Only those marked public-figure keep
  their handle in newsroom and legal exports.
- \`labels.jsonl\`: blind labels of claim rungs by more than one labeller.
- \`exports/\`: signed exports. Each one checks offline.

## Commands

    daylight case add <url|file>
    daylight case claim "<text>" --source S01 --rung documented
    daylight case trace C01
    daylight case timeline
    daylight case export --profile newsroom

Every command except \`add <url>\` works offline. \`add <url>\` fetches that page and asks the
Wayback Machine to save it, unless you pass --no-archive.
`;
}

// Makes the case folder. Refuses a folder that already has files in it.
export function initCase(dir, name, now = new Date().toISOString()) {
  if (!name || !String(name).trim()) throw new Error("a case needs a name: case init <name>");
  if (existsSync(dir) && readdirSync(dir).length) throw new Error(`${dir} is not empty; choose a new folder`);
  mkdirSync(dir, { recursive: true });
  for (const d of DIRS) { mkdirSync(join(dir, d), { recursive: true }); writeFileSync(join(dir, d, ".keep"), ""); }
  const meta = { format: CASE_FORMAT, name: String(name), created: now, salt: randomBytes(16).toString("hex"), models: { provider: "none" } };
  writeFileSync(join(dir, "case.json"), JSON.stringify(meta, null, 2) + "\n");
  for (const [file] of Object.values(TABLES)) writeFileSync(join(dir, file), "");
  writeFileSync(join(dir, "README.md"), readme(meta.name, now));
  writeFileSync(join(dir, ".gitattributes"), "captures/** -text\n");
  return meta;
}

// A folder name from a case name: lower case, words joined by hyphens.
export const slug = (name) => String(name).toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 60) || "case";
