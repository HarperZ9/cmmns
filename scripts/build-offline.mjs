// The offline data build: rebuilds every table it can from the snapshots pinned in data/LOCK.json,
// with the network blocked (scripts/offline-guard.mjs), then bundles the extension.
//   npm run build:offline              rebuild what this machine has snapshots for; check the rest
//   npm run build:offline -- --strict  also fail when a step is skipped for a missing snapshot
// Fails when any snapshot's hash differs from the lock, when any table differs from its locked hash
// after the rebuild, or when any step tries to reach the network.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, loadLock, checkSnapshots, checkOutputs, stepReady, resolvePath, dataDir, report } from "./data-lock.mjs";

const GUARD = pathToFileURL(join(ROOT, "scripts/offline-guard.mjs")).href;
const strict = process.argv.includes("--strict");

function runGuarded(script, args, built) {
  const env = { ...process.env, RADAR_DATA: dataDir(), ...(built ? { RADAR_BUILT: built } : {}) };
  const r = spawnSync(process.execPath, ["--import", GUARD, join(ROOT, script), ...args], { cwd: ROOT, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`${script} failed (exit ${r.status}):\n${(r.stderr || "").slice(-2000)}`);
  return r.stdout.trim().split("\n").pop();
}

// Each locked step: run it when every input is present and pinned, otherwise say why not.
function runSteps(lock, snaps) {
  const skipped = [];
  for (const step of lock.builds) {
    if (!step.script) { console.log(`pinned   ${step.id}: no offline source; ${step.outputs.join(", ")} checked against the lock`); continue; }
    if (!stepReady(lock, step, snaps)) {
      skipped.push(step.id);
      console.log(`skipped  ${step.id}: a snapshot it needs is not on this machine (${dataDir()}); outputs checked against the lock`);
      continue;
    }
    const args = step.args.map((a) => (a === "$RADAR_DATA" ? dataDir() : a.startsWith("$RADAR_DATA/") ? resolvePath(a) : a));
    console.log(`rebuilt  ${step.id}: ${runGuarded(step.script, args, step.built)}`);
  }
  return skipped;
}

function main() {
  const lock = loadLock(), snaps = checkSnapshots(lock);
  if (report(snaps.filter((r) => r.status !== "ok" && r.status !== "absent")) > 0) throw new Error("a snapshot differs from data/LOCK.json; review it with scripts/upstream-guard.mjs before refreshing the lock");
  const skipped = runSteps(lock, snaps);
  const outs = checkOutputs(lock), bad = outs.filter((r) => r.status !== "ok");
  if (bad.length) { report(bad); throw new Error("a rebuilt or shipped table differs from data/LOCK.json"); }
  console.log(`bundle   ${runGuarded("scripts/build.mjs", [])}`);
  console.log(`offline build done: ${lock.builds.length - skipped.length} of ${lock.builds.length} steps rebuilt or pinned, ${outs.length} tables match the lock`);
  if (strict && skipped.length) throw new Error(`--strict: skipped ${skipped.join(", ")}`);
}

try { main(); } catch (e) { console.error(`[build:offline] ${e.message}`); process.exit(1); }
