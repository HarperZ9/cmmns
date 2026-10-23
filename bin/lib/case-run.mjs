// The `daylight case` commands that run the pipeline or write exports: run, review, watch, export,
// verify-export, read and import.
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { runCase } from "../../src/investigate/run.js";
import { pending, describe, decide, decideIds } from "../../src/investigate/review.js";
import { watchCase, SCHEDULE_HELP } from "../../src/investigate/watch.js";
import { writeExport, checkExportFiles, PROFILES, BUNDLE_FILE } from "../../src/investigate/export.js";
import { readCase, readingLines } from "../../src/investigate/read.js";
import { importLegacy } from "../../src/investigate/legacy.js";
import { makeModel } from "../../src/investigate/models.js";
import { loadOcr } from "../../src/investigate/ingest.js";
import { verifyBundle } from "../../src/core/bundle-verify.js";
import { ROOT } from "./data.mjs";
import { signer, analyzer, gitHistory, gitUser, gitCommit, toolName } from "./case-env.mjs";

const list = (s) => (typeof s === "string" && s ? s.split(",").map((x) => x.trim()).filter(Boolean) : []);
const readingOf = (dir) => { const f = join(dir, "derived", "reading.json"); return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null; };

async function exportProfiles(env, profiles, f) {
  const { sign, made } = await signer(typeof f["key-file"] === "string" ? f["key-file"] : undefined);
  const out = [];
  for (const p of profiles) {
    const r = await writeExport(env.data(), p, { at: env.now(), tool: toolName(), sign, history: gitHistory(env.dir), reading: readingOf(env.dir), force: !!f.force });
    out.push(r.written ? `${p}: ${r.version} written to ${r.dir} (${r.files.length} files, ${r.redacted} accounts shown as pseudonyms)` : `${p}: unchanged since ${r.version}`);
  }
  env.commit(`case export ${profiles.join(", ")}`);
  return out.join("\n") + (made ? "\nA new signing key was made and saved outside the case." : "") + "\n";
}

async function exportCmd(env, { f }) {
  const profiles = f.profile === "all" ? PROFILES : [f.profile];
  if (!PROFILES.includes(profiles[0])) throw new Error(`--profile must be one of ${PROFILES.join(", ")} or all`);
  return exportProfiles(env, profiles, f);
}

async function verifyExport(env, { _: [dir] }) {
  const d = resolve(dir || ".");
  const bundle = JSON.parse(readFileSync(join(d, BUNDLE_FILE), "utf8"));
  const v = await verifyBundle(bundle), files = checkExportFiles(d);
  const ok = v.ok && files.every((x) => x.ok);
  const lines = [...v.checks.map((c) => `${c.ok ? "ok" : "FAIL"} ${c.name}: ${c.text}`), ...files.map((x) => `${x.ok ? "ok" : "FAIL"} ${x.file}: ${x.text}`), ok ? `Export verified: signed by key ${v.keyId}, every file matches.` : "Export NOT verified."];
  if (!ok) process.exitCode = 1;
  return lines.join("\n") + "\n";
}

function read(env, { f }) {
  const r = readCase(env.data(), analyzer());
  return f.json ? JSON.stringify(r, null, 2) + "\n" : readingLines(r);
}

function importCmd(env, { _: [folder], f }) {
  if (!folder) throw new Error("case import needs the old case folder");
  const r = importLegacy(env.dir, resolve(folder), { withCaptures: !!f["with-captures"] });
  env.commit(`case import ${folder}`);
  return `Imported ${r.sources} sources and ${r.events} timeline events${r.copied ? `, with ${r.copied} capture files` : "; capture files stay in the old folder, their hashes are recorded"}. The old folder was not changed.\n`;
}

async function run(env, { _: seeds, f }) {
  const meta = env.data().meta;
  const model = makeModel(meta.models || { provider: "none" });
  const { sign } = await signer(typeof f["key-file"] === "string" ? f["key-file"] : undefined);
  let ocr = null;
  const lines = [];
  const r = await runCase(seeds, {
    dir: env.dir, now: env.now, fetchFn: env.fetchFn, sleep: env.sleep, model, analyze: analyzer(), sign, tool: toolName(), env: env.env || process.env,
    ocr: async () => (ocr || (ocr = await loadOcr(ROOT))), history: () => gitHistory(env.dir),
    opts: { archive: !f["no-archive"], stop: typeof f.stop === "string" ? f.stop : null, followPrimary: !f["no-follow"] }, log: (s) => lines.push(s),
  });
  gitCommit(env.dir, `case run (${r.state.runs})`);
  const waiting = pending(env.data()).length;
  return `${lines.join("\n")}\nRun ${r.state.runs} finished. ${waiting} item${waiting === 1 ? "" : "s"} wait for review: daylight case review\n`;
}

// One key per item: a accept, r reject, s skip, q stop.
async function interactive(env, by) {
  const q = pending(env.data());
  if (!q.length) return "Nothing waits for review.\n";
  const rl = createInterface({ input: process.stdin });
  const ask = () => new Promise((res) => { process.stdin.setRawMode?.(true); process.stdin.once("data", (b) => { process.stdin.setRawMode?.(false); res(String(b)[0].toLowerCase()); }); });
  let done = 0;
  try {
    for (const it of q) {
      process.stdout.write(`\n${describe(env.data(), it)}\n[a]ccept [r]eject [s]kip [q]uit: `);
      const k = await ask();
      if (k === "q") break;
      if (k === "a" || k === "r") { decide(env.dir, it, k === "a" ? "accepted" : "rejected", by, env.now()); done++; }
    }
  } finally { rl.close(); }
  env.commit(`case review: ${done} decided`);
  return `\n${done} decided, ${pending(env.data()).length} still waiting.\n`;
}

async function review(env, { f }) {
  const by = typeof f.by === "string" ? f.by : gitUser(env.dir);
  if (f.accept || f.reject) {
    const rows = decideIds(env.dir, env.data(), { accept: list(f.accept), reject: list(f.reject) }, by, env.now());
    env.commit(`case review: ${rows.length} decided`);
    return `${rows.length} decided by ${by}.\n`;
  }
  if (f.list || f.json || !process.stdin.isTTY) {
    const q = pending(env.data());
    return f.json ? JSON.stringify(q.map((x) => ({ table: x.table, ...x.row })), null, 2) + "\n" : (q.map((x) => describe(env.data(), x)).join("\n") || "Nothing waits for review.") + "\n";
  }
  return interactive(env, by);
}

async function watch(env, { f }) {
  if (f.schedule) return SCHEDULE_HELP;
  const changes = await watchCase({ dir: env.dir, data: env.data, fetchFn: env.fetchFn, now: env.now });
  let out = changes.length ? changes.map((c) => `${c.kind} ${c.ref}: ${c.text}`).join("\n") + "\n" : "No change found.\n";
  env.commit(`case watch: ${changes.length} changes`);
  if (f.export && changes.length) out += await exportProfiles(env, PROFILES, f);
  return out;
}

export const RUN_COMMANDS = { run, review, watch, export: exportCmd, "verify-export": verifyExport, read, import: importCmd };
