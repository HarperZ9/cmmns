// A case's network settings and source-protection mode on the command line: `cmmns case
// settings`, and what every case command runs under when protection is on (for every case with
// `cmmns protect on`, or for one case). See src/investigate/protection.js.
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { envValue } from "../../src/core/env-names.js";
import { caseSettings, setCaseSettings, blockedFetch, PROTECTION_LIMITS, ARCHIVE_REVEALS } from "../../src/investigate/protection.js";

export const protectFile = (env = process.env) => join(envValue(env, "HOME") || homedir(), ".radar", "protection.json");

// The switch for every case: CMMNS_PROTECT (or DAYLIGHT_PROTECT) =1 or 0 wins, then ~/.radar/protection.json.
export function globalProtection(env = process.env) {
  const v = String(envValue(env, "PROTECT") || "").toLowerCase();
  if (["1", "on", "true"].includes(v)) return true;
  if (["0", "off", "false"].includes(v)) return false;
  const f = protectFile(env);
  try { return existsSync(f) && JSON.parse(readFileSync(f, "utf8")).on === true; } catch (e) { throw new Error(`${f} is not readable JSON (${e.message}); delete it or run "cmmns protect off"`); }
}

// What a case command runs with. In protection mode every request is refused by blockedFetch and
// recorded in attempts, so a test can show that nothing went out.
export function protectEnv(env, meta, procEnv) {
  const s = caseSettings(meta), on = globalProtection(procEnv) || s.protection;
  if (!on) return { settings: s, protection: false };
  const attempts = [];
  return { settings: s, protection: true, attempts, fetchFn: blockedFetch(attempts) };
}

const ONOFF = { on: true, off: false };

export function settings(env, { _: args, f }) {
  const patch = {};
  for (let i = 0; i < args.length; i += 2) {
    const k = args[i], v = ONOFF[String(args[i + 1]).toLowerCase()];
    if (!["archive", "protection"].includes(k) || v === undefined) throw new Error(`case settings takes "archive on|off" and "protection on|off", not "${args.slice(i, i + 2).join(" ")}"`);
    patch[k] = v;
  }
  const s = Object.keys(patch).length ? setCaseSettings(env.dir, patch) : caseSettings(env.data().meta);
  if (Object.keys(patch).length) env.commit(`case settings: archive ${s.archive ? "on" : "off"}, protection ${s.protection ? "on" : "off"}`);
  const lines = [
    `Wayback requests: ${s.archive ? "on" : "off"}. ${s.archive ? ARCHIVE_REVEALS : "Pass --archive to case add for one page."}`,
    `Source-protection mode for this case: ${s.protection ? "on" : "off"}${globalProtection(env.env || process.env) ? " (and on for every case: cmmns protect status)" : ""}.`,
  ];
  if (s.archive && (s.protection || globalProtection(env.env || process.env))) lines.push("While protection is on, no Wayback request is made whatever this setting says.");
  if (patch.protection === true) lines.push("", PROTECTION_LIMITS);
  return f.json ? JSON.stringify(s, null, 2) + "\n" : lines.join("\n") + "\n";
}
