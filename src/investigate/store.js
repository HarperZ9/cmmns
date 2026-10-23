// A case folder on disk: one JSON Lines file per record type, plus case.json. Every record is a
// plain object with an id ("S01", "C01", ...). Rows are only appended or rewritten whole; nothing
// here touches the network.
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { join } from "node:path";

// Record type -> [file, id prefix].
export const TABLES = {
  sources: ["sources.jsonl", "S"],
  claims: ["claims.jsonl", "C"],
  events: ["events.jsonl", "T"],
  edges: ["edges.jsonl", "N"],
  leads: ["leads.jsonl", "L"],
  absent: ["absent.jsonl", "A"],
  actors: ["actors.jsonl", "P"],
  labels: ["labels.jsonl", "B"],
  proposals: ["proposals.jsonl", "R"],
  watch: ["watch.jsonl", "W"],
  posts: ["posts.jsonl", "M"],
};

export const RUNGS = ["documented", "inference", "unproven", "contradicted"];

export function readJsonl(file) {
  if (!existsSync(file)) return [];
  const rows = [];
  readFileSync(file, "utf8").split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    try { rows.push(JSON.parse(line)); } catch (e) { throw new Error(`${file} line ${i + 1} is not JSON: ${e.message}`); }
  });
  return rows;
}

export function writeJsonl(file, rows) {
  writeFileSync(file, rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : ""));
}

// The next free id for a table: "S" + the highest number seen + 1, zero-padded to two digits.
export function nextId(prefix, rows) {
  let max = 0;
  for (const r of rows) {
    const m = String(r.id || "").match(new RegExp(`^${prefix}(\\d+)$`));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return prefix + String(max + 1).padStart(2, "0");
}

export function isCase(dir) { return existsSync(join(dir, "case.json")); }

// Every table of a case, plus its metadata.
export function loadCase(dir) {
  if (!isCase(dir)) throw new Error(`${dir} is not a case folder (no case.json). Run "case init <name>" first.`);
  const out = { dir, meta: JSON.parse(readFileSync(join(dir, "case.json"), "utf8")) };
  for (const [name, [file]] of Object.entries(TABLES)) out[name] = readJsonl(join(dir, file));
  return out;
}

// Appends one row to a table, giving it the next id. Returns the row as written.
export function addRow(dir, table, row) {
  const [file, prefix] = TABLES[table];
  const path = join(dir, file);
  const rows = readJsonl(path);
  const out = { id: nextId(prefix, rows), ...row };
  appendFileSync(path, JSON.stringify(out) + "\n");
  return out;
}

// Replaces one row by id with fn(row). Throws when the id is not there.
export function updateRow(dir, table, id, fn) {
  const path = join(dir, TABLES[table][0]);
  const rows = readJsonl(path);
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) throw new Error(`no ${table} row ${id}`);
  rows[i] = fn(rows[i]);
  writeJsonl(path, rows);
  return rows[i];
}

export const byId = (rows) => new Map(rows.map((r) => [r.id, r]));

// Removes every row a pipeline item wrote (rows tagged run_item), so a crashed item can run again
// without leaving duplicates. Returns the number of rows removed.
export function purgeTag(dir, tag) {
  let n = 0;
  for (const [file] of Object.values(TABLES)) {
    const path = join(dir, file), rows = readJsonl(path), keep = rows.filter((r) => r.run_item !== tag);
    if (keep.length !== rows.length) { n += rows.length - keep.length; writeJsonl(path, keep); }
  }
  return n;
}
