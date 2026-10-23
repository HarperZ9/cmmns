// Checkpoints, the run lock and the watchdog for `case run`. The state file records every item
// each stage has finished, so a second run skips them and a crashed run resumes where it stopped.
// It is written to a temporary file and renamed, so a crash never leaves half a state file.
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";

export const RUN_DIR = ".run";
const STALE_MS = 10 * 60 * 1000;

export function loadState(dir) {
  const f = join(dir, RUN_DIR, "state.json");
  if (!existsSync(f)) return { format: "daylight-case-run/1", seeds: [], queue: [], failed: {}, stages: {}, runs: 0 };
  return JSON.parse(readFileSync(f, "utf8"));
}

export function saveState(dir, state) {
  mkdirSync(join(dir, RUN_DIR), { recursive: true });
  const f = join(dir, RUN_DIR, "state.json"), tmp = f + ".tmp";
  writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n");
  renameSync(tmp, f);
}

export const isDone = (state, stage, key) => !!(state.stages[stage] && state.stages[stage].items && state.stages[stage].items[key]);
export function markDone(state, stage, key, note) {
  const s = state.stages[stage] || (state.stages[stage] = { items: {} });
  s.items[key] = note || "ok";
}

const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; } };

// Takes the run lock. A lock held by a live process with a fresh heartbeat refuses the run; a
// stale one (dead process, or no heartbeat for ten minutes) is taken over and said so.
export function takeLock(dir, now = Date.now()) {
  mkdirSync(join(dir, RUN_DIR), { recursive: true });
  const f = join(dir, RUN_DIR, "lock");
  let note = null;
  if (existsSync(f)) {
    const l = JSON.parse(readFileSync(f, "utf8"));
    if (l.pid !== process.pid && alive(l.pid) && now - l.heartbeat < STALE_MS) throw new Error(`another run (process ${l.pid}) is working on this case; its heartbeat is ${Math.round((now - l.heartbeat) / 1000)} s old`);
    note = `took over a stale lock from process ${l.pid}`;
  }
  writeFileSync(f, JSON.stringify({ pid: process.pid, heartbeat: now }));
  return { note, beat: () => writeFileSync(f, JSON.stringify({ pid: process.pid, heartbeat: Date.now() })), release: () => rmSync(f, { force: true }) };
}

// Rejects when work takes longer than ms. The item is recorded as timed out and the run goes on.
export function withTimeout(promise, ms, what) {
  let t;
  return Promise.race([promise, new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`watchdog: ${what} took longer than ${Math.round(ms / 1000)} s`)), ms); })]).finally(() => clearTimeout(t));
}

// A deliberate crash for the resume test: DAYLIGHT_CASE_CRASH_AT="<stage>:<n>" exits after the
// n-th item of that stage has done its work and before its checkpoint is written.
export function crashHook(env = process.env) {
  const spec = env.DAYLIGHT_CASE_CRASH_AT;
  if (!spec) return () => {};
  const [stage, n] = spec.split(":"), counts = {};
  return (s) => { if (s !== stage) return; counts[s] = (counts[s] || 0) + 1; if (counts[s] === Number(n)) { process.stderr.write(`case run: simulated crash in ${s} after item ${n}\n`); process.exit(99); } };
}
