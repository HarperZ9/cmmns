// The protection commands: `cmmns clean <file>` (Share clean), `cmmns protect on|off|status|
// limits` (source-protection mode for every case), and `cmmns self-audit <export files>` (what
// CMMNS's signals show about your own account, from the data export the platform gave you).
// All three read and write local files only.
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, unlinkSync } from "node:fs";
import { dirname, join, basename, extname, resolve } from "node:path";
import { shareClean, cleanName, cleanLineage, CLEAN_FORMATS } from "../../src/core/clean.js";
import { selfAudit, exportAuditInput, SELF_AUDIT_REFUSED } from "../../src/core/self-audit.js";
import { PROTECTION_LIMITS } from "../../src/investigate/protection.js";
import { protectFile, globalProtection } from "./case-protect.mjs";
import { envSource } from "../../src/core/env-names.js";

export const CLEAN_LINEAGE_NAME = "clean-lineage.jsonl";

// Writes the clean copy and appends its lineage beside the original (the evidence copy).
export async function cleanCommand(file, f, now = () => new Date().toISOString()) {
  const bytes = readFileSync(file), r = await shareClean(bytes);
  if (!r.ok) { const e = new Error(`${file}: ${r.reason}. Nothing was written.`); e.notCleaned = true; throw e; }
  const lineage = await cleanLineage(bytes, r, now());
  const out = typeof f.out === "string" ? resolve(f.out) : join(dirname(resolve(file)), cleanName(r.format, lineage.clean.sha256, extname(file).slice(1)));
  if (resolve(out) === resolve(file)) throw new Error("--out must not be the original file: the original stays as your evidence copy");
  writeFileSync(out, r.bytes);
  const log = join(dirname(resolve(file)), CLEAN_LINEAGE_NAME);
  appendFileSync(log, JSON.stringify({ ...lineage, original_file: basename(file), clean_file: basename(out) }) + "\n");
  if (f.json) return JSON.stringify({ out, lineage_file: log, ...lineage, notes: r.notes }, null, 2) + "\n";
  return [`Clean copy written to ${out}.`, r.removed.length ? `Removed: ${r.removed.join("; ")}.` : "The file carried no metadata Share clean knows of.", ...r.notes,
    `Lineage (original sha256 ${lineage.original.sha256.slice(0, 16)}... to clean ${lineage.clean.sha256.slice(0, 16)}...) added to ${log}; keep it with the original, and do not send it.`].join("\n") + "\n";
}

export function protectCommand(sub, env = process.env) {
  const f = protectFile(env);
  if (sub === "on" || sub === "off") {
    if (sub === "on") { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, JSON.stringify({ on: true }) + "\n"); }
    else if (existsSync(f)) unlinkSync(f);
    const lines = [`Source-protection mode is ${sub} for every case on this computer.`];
    if (sub === "on") lines.push("", PROTECTION_LIMITS);
    const v = envSource(env, "PROTECT");
    if (v) lines.push(`${v}=${env[v]} is set and decides over this switch while it is set.`);
    return lines.join("\n") + "\n";
  }
  if (sub === "status") return `Source-protection mode: ${globalProtection(env) ? "on" : "off"} for every case${envSource(env, "PROTECT") ? ` (set by ${envSource(env, "PROTECT")}=${env[envSource(env, "PROTECT")]})` : ""}. A case can also turn it on for itself: cmmns case settings protection on\n`;
  if (sub === "limits") return PROTECTION_LIMITS + "\n";
  throw new Error('cmmns protect takes "on", "off", "status" or "limits"');
}

// Only files: an argument that is not an existing file is refused, so no account can be named.
export function selfAuditCommand(files, f, now = Date.now()) {
  if (!files.length) throw new Error(`cmmns self-audit needs the files of your own data export. ${SELF_AUDIT_REFUSED}`);
  for (const x of files) if (/^@|^https?:\/\//i.test(x) || !existsSync(x)) throw new Error(`"${x}" is not a file. ${SELF_AUDIT_REFUSED}`);
  const got = exportAuditInput(files.map((x) => ({ name: basename(x), text: readFileSync(x, "utf8") })));
  if (!got.ok) throw new Error(got.reason);
  const a = selfAudit({ ...got.input, now });
  if (f.json) return JSON.stringify(a, null, 2) + "\n";
  const L = [`What CMMNS shows about you, from your ${a.site || "platform"} data export. Worked out on this computer; nothing was sent.`, ""];
  for (const s of a.signals) L.push(`${s.title}`, `  Shows: ${s.shows}`, `  Reveals: ${s.reveals}`, `  To reduce it: ${s.reduce}`, "");
  if (a.flags.length) L.push("Signs CMMNS's window would show beside your replies:", ...a.flags.map((x) => `  ${x.id}: ${x.evidence}. ${x.doesNotProve || ""}`), "");
  L.push("Not checked here:", ...a.notChecked.map((x) => `  - ${x}`));
  return L.join("\n") + "\n";
}

export const PROTECT_USAGE = `  cmmns clean <file> [--out file] [--json]   Share clean: a copy with its metadata removed
               (${CLEAN_FORMATS.join(", ")})
  cmmns protect on|off|status|limits        source-protection mode for every case
  cmmns self-audit <your export files...>   what CMMNS shows about your own account
`;
