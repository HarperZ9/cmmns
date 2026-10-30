// `cmmns likes fetch <manifest>` and `cmmns likes missing` (project-docs/SAVE-ALL-LIKES.md). The page
// finds the likes and writes a manifest (src/ext/likes.js); this fetches every file it lists straight
// from X's media hosts, several at once over reused HTTP/2 connections, into the same folder as the
// extension's saves (Downloads/CMMNS/x/), with the same daylight.sidecar/1 note beside each post.
// A post already saved anywhere under the CMMNS folder is skipped before any request (its id is in a
// file name there), and a file whose bytes are already there (same size, same SHA-256) is not kept twice.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative } from "node:path";
import { parseManifest, parseArchiveLikes, missingLikes, likeMeta, postKey, stageClock } from "../../src/core/likes.js";
import { sidecarMarkdown } from "../../src/core/media-meta.js";
import { saveRoot } from "./media-fetch.mjs";
import { globalProtection } from "./case-protect.mjs";
import { getWithRetry, hashFile, pool, closeAll } from "./likes-net.mjs";

export const LIKES_HELP = `cmmns likes fetch [<manifest folder or file>] [--dir <CMMNS folder>] [--jobs 8] [--watch]
cmmns likes missing [<manifest folder>] --archive <like.js> [--dir <CMMNS folder>]

fetch    Saves every file the manifest lists into <CMMNS folder>/x/, with a note per post.
         Posts already saved under the CMMNS folder are skipped before any request.
         --jobs   files at once (default 8; a host's 429 halves it)
         --watch  keeps reading the manifest as the page adds to it; Ctrl+C to end
missing  Lists the liked posts in X's archive (like.js) that nothing under the CMMNS folder holds.`;

const HASHES = ".cmmns-hashes.json";
const ID_IN_NAME = /_(\d{6,20})\.[a-z0-9]+$/i;

// The index kernel: every post id in a file name under root, and every file's size (hashed only when a
// new file has the same size). Hashes are kept in root/.cmmns-hashes.json between runs.
export function folderIndex(root) {
  const known = new Set(), bySize = new Map(), cachePath = join(root, HASHES);
  let cache = {};
  try { cache = JSON.parse(readFileSync(cachePath, "utf8")); } catch { cache = {}; }
  const walk = (d, depth) => {
    if (depth > 6) return;
    let names = [];
    try { names = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of names) {
      const p = join(d, e.name);
      if (e.isDirectory()) { if (e.name !== "boards") walk(p, depth + 1); continue; }
      if (/\.(part|crdownload)$/.test(e.name) || e.name === HASHES) continue;
      const m = ID_IN_NAME.exec(e.name);
      if (m) known.add(postKey(m[1]));
      const size = statSync(p).size;
      if (!bySize.has(size)) bySize.set(size, []);
      bySize.get(size).push(p);
    }
  };
  if (existsSync(root)) walk(root, 0);
  return { known, bySize, cache, cachePath, root };
}

// Is a file with these bytes already in the folder? Hashes only the files of the same size, once each.
async function sameBytes(index, path, size, sha) {
  for (const other of index.bySize.get(size) || []) {
    if (other === path) continue;
    const rel = relative(index.root, other), st = statSync(other, { throwIfNoEntry: false });
    if (!st) continue;
    const c = index.cache[rel];
    const h = c && c[0] === st.size && c[1] === st.mtimeMs ? c[2] : (await hashFile(other)).digest("hex");
    index.cache[rel] = [st.size, st.mtimeMs, h];
    if (h === sha) return other;
  }
  return null;
}

// One post: its files through the pool, then its sidecar naming the files written. Records each stage.
async function savePost(line, ctx) {
  const t0 = performance.now();
  if (ctx.index.known.has(postKey(line.id))) { ctx.counts.duplicate++; ctx.clock.add("dedupe", performance.now() - t0); return; }
  ctx.clock.add("dedupe", performance.now() - t0);
  ctx.index.known.add(postKey(line.id));
  const written = [], missing = [];
  await Promise.all(line.files.map((f) => ctx.pool.run(async () => {
    const dest = join(ctx.dir, f.name), a = performance.now();
    try {
      const r = await getWithRetry(f.url, dest, ctx.net, () => ctx.pool.slow());
      ctx.clock.add("fetch", performance.now() - a); ctx.bytes += r.bytes;
      const b = performance.now(), dup = await sameBytes(ctx.index, dest, r.bytes, r.sha256);
      ctx.clock.add("hash", performance.now() - b);
      if (dup) { rmSync(dest, { force: true }); ctx.counts.sameBytes++; written.push(relative(ctx.dir, dup).replace(/\\/g, "/")); return; }
      if (!ctx.index.bySize.has(r.bytes)) ctx.index.bySize.set(r.bytes, []);
      ctx.index.bySize.get(r.bytes).push(dest);
      written.push(f.name); ctx.counts.files++;
    } catch (e) { missing.push(`${f.name}: ${e.message}`); ctx.counts.failedFiles++; }
  })));
  // Every file failed: no note, so the post is not known by its id and the next run tries it again.
  if (line.files.length && !written.length) { ctx.index.known.delete(postKey(line.id)); ctx.counts.failed++; return; }
  const c = performance.now(), meta = likeMeta(line, 0, 1);
  if (missing.length) meta.notes = [...(meta.notes || []), { label: "Not saved", text: missing.join("\n") }];
  writeFileSync(join(ctx.dir, line.sidecar), sidecarMarkdown(meta, written));
  ctx.clock.add("sidecar", performance.now() - c);
  ctx.counts.saved++;
}

// A manifest file, or the folder of manifest-NNNN.jsonl parts the page writes.
export function readManifest(path) {
  if (!statSync(path).isDirectory()) return parseManifest(readFileSync(path, "utf8"));
  return readdirSync(path).filter((n) => /^manifest(-\d+)?\.jsonl$/.test(n)).sort().flatMap((n) => parseManifest(readFileSync(join(path, n), "utf8")));
}

const flagOf = (argv, k, d = null) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d; };
// The one argument that is not a flag or a flag's value (argv[0] is "fetch" or "missing").
const positional = (argv) => argv.find((a, i) => i > 0 && !a.startsWith("--") && !/^--(dir|jobs|archive)$/.test(argv[i - 1] || ""));
const rootOf = (argv) => flagOf(argv, "dir") || join(homedir(), "Downloads", saveRoot());

// Runs `cmmns likes fetch`. Resolves to { counts, line }.
// tls: extra connection options (a test server's certificate).
export async function fetchLikes(argv, { env = process.env, log = (s) => process.stderr.write(s), tls = null } = {}) {
  const manifest = positional(argv) || join(rootOf(argv), "library", "x-likes");
  if (!existsSync(manifest)) throw new Error(`No manifest at ${manifest}. Run Save all likes on X first; it writes the manifest there.\n\n${LIKES_HELP}`);
  if (globalProtection(env)) throw new Error("Source-protection mode is on (cmmns protect status), so nothing is downloaded: the requests would tell X's media hosts.");
  const root = rootOf(argv), dir = join(root, "x"), jobs = Math.max(1, Math.min(32, Number(flagOf(argv, "jobs", 8)) || 8));
  mkdirSync(dir, { recursive: true });
  const t0 = performance.now(), index = folderIndex(root);
  const ctx = { dir, index, net: tls ? { tls } : {}, pool: pool(jobs), clock: stageClock(), bytes: 0, counts: { posts: 0, saved: 0, duplicate: 0, failed: 0, files: 0, sameBytes: 0, failedFiles: 0 } };
  ctx.clock.add("index", performance.now() - t0, Math.max(1, index.known.size));
  const done = new Set(), watch = argv.includes("--watch");
  let idle = 0;
  try {
    for (;;) {
      const lines = readManifest(manifest).filter((l) => !done.has(l.id));
      for (const l of lines) done.add(l.id);
      ctx.counts.posts += lines.length;
      await Promise.all(lines.map((l) => savePost(l, ctx)));
      log(`\r${ctx.counts.saved} saved, ${ctx.counts.duplicate} already saved, ${ctx.counts.failed} failed, ${(ctx.bytes / 1048576).toFixed(1)} MB   `);
      if (!watch) break;
      idle = lines.length ? 0 : idle + 1;
      if (idle > 300) break;   // ten minutes with nothing new
      await new Promise((r) => setTimeout(r, 2000));
    }
  } finally { closeAll(); try { writeFileSync(index.cachePath, JSON.stringify(index.cache)); } catch (e) { log(`\nthe hash cache was not written: ${e.message}\n`); } }
  const secs = (performance.now() - t0) / 1000;
  return { counts: ctx.counts, seconds: secs, bytes: ctx.bytes, stages: ctx.clock.rows(),
    line: `\nSaved ${ctx.counts.saved} posts (${ctx.counts.files} files, ${(ctx.bytes / 1048576).toFixed(1)} MB) into ${dir} in ${secs.toFixed(1)} s: ${(ctx.counts.saved / (secs / 60)).toFixed(0)} likes a minute, ${(ctx.bytes / 1048576 / secs).toFixed(1)} MB/s.\n`
      + `${ctx.counts.duplicate} were already saved, ${ctx.counts.sameBytes} files had the same bytes as one already saved, ${ctx.counts.failed} posts failed.\n\n${ctx.clock.table()}\n` };
}

// `cmmns likes missing`: the archive's likes that nothing under the CMMNS folder holds.
export function missingCommand(argv) {
  const archive = flagOf(argv, "archive");
  if (!archive || !existsSync(archive)) throw new Error(`Give X's like.js from your data archive with --archive.\n\n${LIKES_HELP}`);
  const list = parseArchiveLikes(readFileSync(archive, "utf8")), index = folderIndex(rootOf(argv));
  const manifest = positional(argv) || join(rootOf(argv), "library", "x-likes");
  const seen = new Set(manifest && existsSync(manifest) ? readManifest(manifest).map((l) => l.id) : []);
  const miss = missingLikes(list, index.known);
  const unseen = miss.filter((id) => !seen.has(id));
  return { list, miss, unseen, line: `${list.length} likes in the archive, ${list.length - miss.length} saved, ${miss.length} not saved yet`
    + `${manifest ? ` (${miss.length - unseen.length} of them found by the page and waiting to be fetched, ${unseen.length} the page has not reached)` : ""}.\n`
    + unseen.slice(0, 50).map((id) => `https://x.com/i/status/${id}`).join("\n") + (unseen.length > 50 ? `\n... and ${unseen.length - 50} more (--json for all)` : "") + "\n" };
}

export async function likesCommand(argv) {
  if (argv[0] === "fetch") return (await fetchLikes(argv)).line;
  if (argv[0] === "missing") { const r = missingCommand(argv); return argv.includes("--json") ? JSON.stringify({ missing: r.miss, unseen: r.unseen }, null, 2) + "\n" : r.line; }
  return LIKES_HELP + "\n";
}
