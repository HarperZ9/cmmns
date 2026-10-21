// The dataset lockfile, data/LOCK.json: every input the data build reads (source, retrieval date,
// licence, row count, SHA-256 of the raw snapshot) and the SHA-256 of every table it writes.
// project-docs/DATA-SOVEREIGNTY.md explains the fields.
//   node scripts/data-lock.mjs check             verify every present snapshot and every output
//   node scripts/data-lock.mjs refresh [ids...]  re-hash after a reviewed update (snapshots: only the named ids)
// Paths that start with $RADAR_DATA/ live outside the repository (too large, or holding other
// people's posts or names); RADAR_DATA defaults to ../radar-data next to the repository.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const LOCK_PATH = process.env.RADAR_LOCK ? resolve(process.env.RADAR_LOCK) : join(ROOT, "data/LOCK.json");
export const dataDir = () => resolve(ROOT, process.env.RADAR_DATA || "../radar-data");
export const resolvePath = (p) => (p.startsWith("$RADAR_DATA/") ? join(dataDir(), p.slice("$RADAR_DATA/".length)) : join(ROOT, p));
// Snapshots are hashed byte for byte. Built tables are hashed with LF line ends (src/core/sig.js
// lfBytes), the same way evidence bundles and the signed bundled-data pack hash them.
export const sha256File = (abs) => createHash("sha256").update(readFileSync(abs)).digest("hex");
export const sha256Table = (abs) => createHash("sha256").update(Buffer.from(readFileSync(abs).toString("latin1").replace(/\r\n/g, "\n"), "latin1")).digest("hex");
export const loadLock = (path = LOCK_PATH) => JSON.parse(readFileSync(path, "utf8"));

// One result per file: { id, path, status: "ok" | "mismatch" | "absent" | "unpinned", want, got }.
function checkFile(id, path, want, hash = sha256File) {
  const abs = resolvePath(path);
  if (!existsSync(abs)) return { id, path, status: "absent", want, got: null };
  const got = hash(abs);
  return { id, path, status: !want ? "unpinned" : got === want ? "ok" : "mismatch", want, got };
}

export function checkSnapshots(lock) {
  const out = [];
  for (const [id, d] of Object.entries(lock.datasets)) {
    for (const [path, f] of Object.entries((d.snapshot && d.snapshot.files) || {})) {
      const r = checkFile(id, path, f.sha256);
      // A committed snapshot must be in the tree; an external one may be missing on this machine.
      if (r.status === "absent" && d.snapshot.committed) r.status = "mismatch";
      out.push(r);
    }
  }
  return out;
}

export const checkOutputs = (lock) => Object.entries(lock.outputs).map(([path, sha]) => checkFile("output", path, sha, sha256Table));

// Inputs of a build step that are all present and pinned on this machine.
export function stepReady(lock, step, snapshotResults) {
  return step.inputs.every((id) => {
    const d = lock.datasets[id];
    if (!d || !d.snapshot) return false;
    const mine = snapshotResults.filter((r) => r.id === id);
    return mine.length > 0 && mine.every((r) => r.status === "ok");
  });
}

export function refresh(lock, ids = []) {
  for (const [id, d] of Object.entries(lock.datasets)) {
    if (!d.snapshot || (ids.length && !ids.includes(id))) continue;
    for (const [path, f] of Object.entries(d.snapshot.files)) {
      const abs = resolvePath(path);
      if (!existsSync(abs)) continue;
      f.sha256 = sha256File(abs);
      f.bytes = readFileSync(abs).length;
    }
  }
  for (const path of Object.keys(lock.outputs)) if (existsSync(resolvePath(path))) lock.outputs[path] = sha256Table(resolvePath(path));
  return lock;
}

export function report(results) {
  const bad = results.filter((r) => r.status === "mismatch" || r.status === "unpinned");
  for (const r of results) console.log(`${r.status.padEnd(8)} ${r.id.padEnd(28)} ${r.path}`);
  for (const r of bad) console.error(`[lock] ${r.path}: locked ${r.want || "(none)"}, found ${r.got || "(missing)"}`);
  return bad.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd, ...ids] = process.argv.slice(2), lock = loadLock();
  if (cmd === "refresh") {
    writeFileSync(LOCK_PATH, JSON.stringify(refresh(lock, ids), null, 1) + "\n");
    console.log("data/LOCK.json refreshed; review the diff before committing it");
  } else if (cmd === "check") {
    const bad = report([...checkSnapshots(lock), ...checkOutputs(lock)]);
    process.exit(bad ? 1 : 0);
  } else { console.error("usage: node scripts/data-lock.mjs check | refresh [dataset ids]"); process.exit(2); }
}
