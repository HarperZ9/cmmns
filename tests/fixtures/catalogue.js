// Loads the definition catalogue (catalogue/definitions/*.json) and the signal registry for tests.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const CATALOGUE_DIR = join(import.meta.dirname, "..", "..", "catalogue");

export function loadCatalogue() {
  const dir = join(CATALOGUE_DIR, "definitions");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  const entries = files.map((f) => ({ file: f, entry: JSON.parse(readFileSync(join(dir, f), "utf8")) }));
  const registry = JSON.parse(readFileSync(join(CATALOGUE_DIR, "signals.json"), "utf8"));
  return { entries, registry, list: entries.map((e) => e.entry) };
}

export const byId = (list, id) => list.find((e) => e.id === id);
