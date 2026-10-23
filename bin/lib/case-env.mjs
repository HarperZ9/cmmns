// What `daylight case` needs from the machine: the clock, the network (or a replay of saved
// responses), git, the signing key and the analyser. Kept apart from the commands so tests and
// replays swap them without touching the case logic.
//   DAYLIGHT_CASE_NOW=<ISO time>      fixes the clock (reproducible runs and tests)
//   DAYLIGHT_CASE_REPLAY=<map.json>   serves every request from saved files; nothing is fetched.
//     Keys are URLs, "x:<post id>" for an X post's record, and "wayback:*" for any save request.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve, isAbsolute } from "node:path";
import { spawnSync } from "node:child_process";
import { signBundle } from "../../src/core/evidence-bundle.js";
import { analyzeText } from "../../src/core/api.js";
import { loadTables, radarVersion } from "./data.mjs";
import { loadOrMakeKey, DEFAULT_KEY } from "./keys.mjs";

export function clock(env = process.env) {
  const fixed = env.DAYLIGHT_CASE_NOW;
  return fixed ? () => new Date(fixed).toISOString() : () => new Date().toISOString();
}

// A fetch that answers from a map { url: { file, status, type, finalUrl } } of saved responses.
// A URL with no recording fails, so a replay can never reach the network.
export function replayFetch(mapFile) {
  const map = JSON.parse(readFileSync(mapFile, "utf8")), base = dirname(resolve(mapFile));
  return async (url) => {
    const xid = (url.match(/^https:\/\/cdn\.syndication\.twimg\.com\/tweet-result\?id=(\d+)/) || [])[1];
    const rec = map[url] || (xid && map[`x:${xid}`]) || (url.startsWith("https://web.archive.org/save/") ? map["wayback:*"] : null);
    if (!rec) throw new Error(`replay: no recording for ${url}`);
    const body = rec.file ? readFileSync(isAbsolute(rec.file) ? rec.file : join(base, rec.file)) : Buffer.from(rec.body || "", "utf8");
    const headers = new Map(Object.entries({ "content-type": rec.type || "text/html; charset=utf-8", ...(rec.headers || {}) }).map(([k, v]) => [k.toLowerCase(), String(v).replace("{url}", url.replace("https://web.archive.org/save/", ""))]));
    return { ok: (rec.status || 200) < 400, status: rec.status || 200, url: (rec.finalUrl || url).replace("{url}", url.replace("https://web.archive.org/save/", "")), headers: { get: (k) => headers.get(k.toLowerCase()) ?? null },
      arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.length), json: async () => JSON.parse(body.toString("utf8")), text: async () => body.toString("utf8") };
  };
}

export function network(env = process.env) {
  if (env.DAYLIGHT_CASE_REPLAY) return { fetchFn: replayFetch(env.DAYLIGHT_CASE_REPLAY), sleep: async () => {}, replay: true };
  return { fetchFn: globalThis.fetch, sleep: (ms) => new Promise((r) => setTimeout(r, ms)), replay: false };
}

const git = (dir, ...args) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });
export const hasGit = (dir) => existsSync(join(dir, ".git"));

// Git identity: the user's own when set; a neutral local one otherwise, so a commit never fails.
function idArgs(dir) {
  const name = git(dir, "config", "user.name").stdout.trim(), mail = git(dir, "config", "user.email").stdout.trim();
  return name && mail ? [] : ["-c", "user.name=Daylight case", "-c", "user.email=case@localhost"];
}

export function gitInit(dir) {
  const r = git(dir, "init", "-q");
  if (r.status !== 0) return false;
  git(dir, "add", "-A");
  git(dir, ...idArgs(dir), "commit", "-q", "-m", "case init");
  return true;
}

export function gitCommit(dir, message) {
  if (!hasGit(dir)) return false;
  git(dir, "add", "-A");
  if (!git(dir, "status", "--porcelain").stdout.trim()) return false;
  const r = git(dir, ...idArgs(dir), "commit", "-q", "-m", message);
  return r.status === 0;
}

export function gitHistory(dir) {
  if (!hasGit(dir)) return null;
  const r = git(dir, "log", "--reverse", "--format=%H %aI %an: %s");
  return r.status === 0 ? r.stdout.trim().split("\n").filter(Boolean) : null;
}

export const gitUser = (dir) => (hasGit(dir) ? git(dir, "config", "user.name").stdout.trim() : "") || "the investigator";

export async function signer(keyPath) {
  const key = await loadOrMakeKey(keyPath || DEFAULT_KEY);
  return { made: key.made, sign: (b) => signBundle(b, key.keyPair) };
}

let loaded = false;
export function analyzer() {
  if (!loaded) { loadTables({ claims: true }); loaded = true; }
  return (text, opts) => analyzeText(text, opts);
}

export const toolName = () => `Daylight Commons ${radarVersion()} (daylight case)`;
