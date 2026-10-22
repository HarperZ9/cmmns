// Radar's data tables for the CLI, read from the extension's own package on disk (src/ext). The
// CLI never fetches anything. The data lock is the same hash the extension puts on a bundle.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { useData } from "../../src/core/api.js";
import { dataLockOf } from "../../src/core/evidence-bundle.js";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const EXT = join(ROOT, "src", "ext");
const read = (name) => readFileSync(join(EXT, name));
const json = (name) => JSON.parse(read(name).toString("utf8"));

// The data table names: the fixed tables plus the claims parts claims.json names.
export function dataFiles() {
  const main = json("claims.json");
  return ["claims.json", ...(main.parts || []), "ops.json", "owners.json", "personalities.json", "sites.json", "state.json"].filter((f) => existsSync(join(EXT, f))).sort();
}

// Loads every table into radar-core. claims: false skips the fact-check table (faster).
export function loadTables({ claims = true } = {}) {
  const main = claims ? json("claims.json") : null;
  return useData({
    sites: json("sites.json"), owners: json("owners.json"), state: json("state.json"),
    ...(claims ? { claims: main, claimParts: (main.parts || []).map(json) } : {}),
  });
}

export async function dataLock() { return dataLockOf(dataFiles().map((f) => [f, read(f)])); }

export function radarVersion() { return JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version; }
