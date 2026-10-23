// `radar export`: one saved evidence chain written out as one of the four export profiles
// (src/core/export-profiles.js). Reads local files only and writes into a new folder.
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { exportProfile, PROFILES } from "../../src/core/export-profiles.js";
import { radarVersion, ROOT } from "./data.mjs";

// Every catalogue entry as "id@version" -> entry, so a cited definition prints with its elements.
// Without the catalogue folder the dossier says the cited entry was not supplied.
export function catalogueEntries(dir = join(ROOT, "catalogue", "definitions")) {
  const out = {};
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".json"))) {
    const e = JSON.parse(readFileSync(join(dir, f), "utf8"));
    out[`${e.id}@${e.version}`] = e;
  }
  return out;
}

const readJson = (file, what) => {
  try { return JSON.parse(readFileSync(file, "utf8")); } catch (e) { throw new Error(`could not read ${what} ${file}: ${e.message}`); }
};

export async function runExport(file, f) {
  const profile = typeof f.profile === "string" ? f.profile : null;
  if (!profile) throw new Error(`--profile is required: ${PROFILES.join(", ")}`);
  const out = typeof f.out === "string" ? f.out : `export-${profile}`;
  if (existsSync(out) && readdirSync(out).length) throw new Error(`${out} is not empty; choose a new folder with --out`);
  const r = await exportProfile(readJson(file, "evidence chain"), profile, {
    tool: `Daylight Commons ${radarVersion()} (CLI)`, definitions: catalogueEntries(),
    replies: typeof f.reply === "string" ? readJson(f.reply, "right-of-reply log") : [],
    corrections: typeof f.corrections === "string" ? readJson(f.corrections, "corrections") : [],
    seed: typeof f.seed === "string" ? f.seed : undefined,
  });
  if (!r.ok) throw new Error(`export refused: ${r.reason}`);
  mkdirSync(out, { recursive: true });
  for (const [name, text] of Object.entries(r.files)) writeFileSync(join(out, name), text);
  return { out, files: Object.keys(r.files).sort() };
}
