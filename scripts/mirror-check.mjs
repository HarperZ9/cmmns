// Compare release mirrors: fetch each mirror's signed head, SHA256SUMS and its signature, check them
// against the project key, then fetch every listed file and compare its hash. A mirror fails when it
// is unreachable, serves an older head than the newest seen, serves a different head under the same
// version, fails a signature, or serves a file whose bytes differ from the signed list. Each failure
// names the mirror and the reason. Exits non-zero on any failure. This is a maintainer's tool: it
// makes network requests, and nothing in the extension calls it.
//   node scripts/mirror-check.mjs <base url>... [--list mirrors.txt] [--key release-key.json] [--heads-only]
// A mirror's base url is the folder that holds HEAD.json, SHA256SUMS and the release files.
// It cannot see a file a mirror adds without listing it: plain HTTP has no directory listing.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { checkHead } from "../src/core/head.js";
import { verifySums, parseSums } from "../src/core/signing.js";
import { PUBLIC_KEY } from "./release-lib.mjs";

const sha = (b) => createHash("sha256").update(b).digest("hex");
const slash = (u) => (u.endsWith("/") ? u : u + "/");

async function get(fetchImpl, url, timeoutMs) {
  const r = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), redirect: "follow" });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url.split("/").pop()}`);
  return Buffer.from(await r.arrayBuffer());
}

// One mirror: { url, reachable, problems: [], head, headSha, sums }.
async function readMirror(url, { key, fetchImpl, headsOnly, timeoutMs }) {
  const m = { url, reachable: false, problems: [], head: null, headSha: null };
  let files;
  try {
    files = Object.fromEntries(await Promise.all(["HEAD.json", "HEAD.sig", "SHA256SUMS", "SHA256SUMS.sig"].map(async (n) => [n, await get(fetchImpl, slash(url) + n, timeoutMs)])));
  } catch (e) { m.problems.push(`unreachable: ${e.cause ? e.cause.code || e.cause.message : e.message}`); return m; }
  m.reachable = true;
  const sums = files["SHA256SUMS"].toString("utf8");
  if (!(await verifySums(key, sums, files["SHA256SUMS.sig"].toString("utf8")))) m.problems.push("the signature over SHA256SUMS does not verify with the project key");
  const h = await checkHead({ head: files["HEAD.json"].toString("utf8"), sig: files["HEAD.sig"].toString("utf8"), trusted: [key], state: null, sums, catalogue: null });
  if (!h.ok) { m.problems.push(h.sentence); return m; }
  m.head = h.head; m.headSha = h.state.headSha256;
  if (headsOnly) return m;
  const listed = parseSums(sums) || {};
  await Promise.all(Object.entries(listed).map(async ([name, want]) => {
    try { if (sha(await get(fetchImpl, slash(url) + encodeURIComponent(name), timeoutMs)) !== want) m.problems.push(`changed file: ${name} differs from the signed list`); }
    catch (e) { m.problems.push(`missing file: ${name} (${e.message})`); }
  }));
  m.problems.sort();
  return m;
}

// { ok, newest, mirrors: [{ url, ok, problems, version }] }.
export async function checkMirrors(urls, { key, fetchImpl = globalThis.fetch, headsOnly = false, timeoutMs = 20000 } = {}) {
  const mirrors = await Promise.all(urls.map((u) => readMirror(u, { key, fetchImpl, headsOnly, timeoutMs })));
  const newest = Math.max(0, ...mirrors.filter((m) => m.head).map((m) => m.head.version));
  const byVersion = new Map();
  for (const m of mirrors.filter((x) => x.head)) {
    if (m.head.version < newest) m.problems.unshift(`older head: version ${m.head.version}, newest seen ${newest}`);
    const first = byVersion.get(m.head.version);
    if (!first) byVersion.set(m.head.version, m);
    else if (first.headSha !== m.headSha) m.problems.unshift(`disagrees with ${first.url}: a different head under version ${m.head.version}`);
  }
  const out = mirrors.map((m) => ({ url: m.url, ok: m.problems.length === 0, problems: m.problems, version: m.head ? m.head.version : null }));
  return { ok: out.length > 0 && out.every((m) => m.ok), newest, mirrors: out };
}

export function report(r) {
  const lines = r.mirrors.flatMap((m) => (m.ok ? [`ok    ${m.url}  head version ${m.version}`] : m.problems.map((p) => `FAIL  ${m.url}  ${p}`)));
  lines.push(r.ok ? `all ${r.mirrors.length} mirrors agree on head version ${r.newest}` : `${r.mirrors.filter((m) => !m.ok).length} of ${r.mirrors.length} mirrors failed`);
  return lines.join("\n") + "\n";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), valued = new Set(["--list", "--key"]);
  const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);
  const urls = args.filter((a, i) => !a.startsWith("--") && !valued.has(args[i - 1]));
  if (opt("--list")) urls.push(...readFileSync(opt("--list"), "utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#")));
  if (!urls.length) { console.error("usage: node scripts/mirror-check.mjs <base url>... [--list mirrors.txt] [--key release-key.json] [--heads-only]"); process.exit(2); }
  const key = JSON.parse(readFileSync(opt("--key") || join(PUBLIC_KEY), "utf8"));
  const r = await checkMirrors(urls, { key, headsOnly: args.includes("--heads-only") });
  process.stdout.write(report(r));
  process.exitCode = r.ok ? 0 : 1;   // not process.exit(): it can abort while fetch sockets close on Windows
}
