// Source-protection mode for a case, and the case's own network settings. One switch, on for every
// case from the command line (`daylight protect on`) or for one case (`daylight case settings
// --protection on`). While it is on, nothing in a case makes a request: no page fetch, no Wayback
// request, no archive lookup, no remote model. Exports are Share clean and carrier-safe, and the
// investigator's own name is replaced in what the case records. This changes only what leaves the
// device; every rule on private accounts still holds inside it.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const ARCHIVE_REVEALS = "Asks the Internet Archive to save this page. The page's server and the Archive will see the request, and the copy is public.";

export const STYLE_WARNING = "Your writing style can identify you. Notes, claims and summaries you write are read as text, and word choice, spelling and punctuation can point to one person. Keep what you share short and plain, and have someone else reword it when it matters.";

export const PROTECTION_LIMITS = [
  "What source-protection mode cannot protect against:",
  "- This device. Anyone who holds or has broken into it can read the case, the captures and this program. Daylight cannot detect spyware.",
  "- The network. No Tor is bundled. Your provider sees which sites your browser visits while you read them. For that, use Tor Browser (torproject.org) and open the pages there; then save them and add the files here.",
  "- The platforms' own logs. Every page you open, search you run and account you look at is recorded by that platform, whatever Daylight does.",
  "- Screenshots and what is visible. Faces, voices, street signs, reflections, screens and a writing style survive any metadata cleaning.",
  "- Being made to unlock the device, or to talk.",
  "For a source who needs to reach a newsroom safely: SecureDrop (securedrop.org) lists the newsrooms that run it.",
  "For help with digital security, free for civil society: the Access Now Digital Security Helpline (accessnow.org/help).",
  "",
  STYLE_WARNING,
  "",
  "This mode has not yet been independently reviewed. project-docs/SECURITY-REVIEW.md lists what a reviewer should check.",
].join("\n");

export class ProtectionBlocked extends Error {
  constructor(what) {
    super(`source-protection mode is on, so Daylight made no request (${what}). Open the page in your browser, save it, and add the saved file: daylight case add page.html`);
    this.name = "ProtectionBlocked";
  }
}

// { archive, protection } from case.json. Both default off; archiving is opt-in (it was on by default up to 3.6).
export const caseSettings = (meta = {}) => ({ archive: meta.archive === true, protection: meta.protection === true });

export function setCaseSettings(dir, patch) {
  const file = join(dir, "case.json"), meta = JSON.parse(readFileSync(file, "utf8"));
  for (const k of ["archive", "protection"]) if (typeof patch[k] === "boolean") meta[k] = patch[k];
  writeFileSync(file, JSON.stringify(meta, null, 2) + "\n");
  return caseSettings(meta);
}

// A fetch that refuses every request and remembers what was asked, so a test or a log can show
// that nothing went out.
export function blockedFetch(log = []) {
  const f = async (url) => { log.push(String(url)); throw new ProtectionBlocked(`request to ${new URL(String(url)).host}`); };
  f.attempts = log;
  return f;
}

// Whether a model provider stays on this device: none, a local command, or an http endpoint on
// localhost.
export function modelIsLocal(config = {}) {
  const p = config.provider || "none";
  if (p !== "http") return true;
  try { return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(config.url).hostname); } catch { return false; }
}

// A git history line ("<sha> <time> <name>: <message>") with the name and time of day removed.
export const anonHistory = (lines) => (lines ? lines.map((l) => l.replace(/^(\S+) (\d{4}-\d{2}-\d{2})\S* [^:]*:/, "$1 $2 investigator:")) : lines);

// "2026-10-25T14:03:11Z" -> "2026-10-25": the day only, as in carrier-safe bundles.
export const dayOnly = (iso) => String(iso || "").slice(0, 10);

// Every time of day in a case's records cut to the day, for a carrier-safe export: access times,
// when a claim was added, when the case was opened. Times of day show when the investigator works.
const ISO_TIME = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}[\d:.]*(Z|[+-]\d{2}:?\d{2})?$/;
export function dayOnlyDeep(v) {
  if (typeof v === "string") return ISO_TIME.test(v) ? v.slice(0, 10) : v;
  if (Array.isArray(v)) return v.map(dayOnlyDeep);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, dayOnlyDeep(x)]));
  return v;
}
