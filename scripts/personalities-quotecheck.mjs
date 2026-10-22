// Checks that every quote in the personality records appears on the page it cites. Build-time
// only: the extension never runs it, and CI does not need the network for it. For each source it
// fetches the page (GET, no cookies, no referrer, no personal data; a plain browser user agent with a
// Radar token), turns HTML or PDF into text, and looks for each part of the quote between "...". A
// page that refuses is tried once through the Internet Archive's raw capture.
//   node scripts/personalities-quotecheck.mjs [files...] [--out <file>]
// With no files it reads data/personalities-sources/people-*.json and outlets.json. The result goes
// to project-docs/evidence/personalities-quotecheck.json; scripts/personalities-build.mjs copies
// each source's result into the shipped table.
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 RadarQuoteCheck/1.0";
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', ndash: "-", mdash: "-", hellip: "..." };
const SINGLE = /[‘’‛′`´]/g, DOUBLE = /[“”„″«»]/g;
const DASH = /[‐-―−]/g, SPACE = /[   ​]/g;

// Lower-cased text with quotes, dashes and spaces made uniform.
export function norm(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m)
    .replace(SINGLE, "'").replace(DOUBLE, '"').replace(DASH, "-").replace(/…/g, "...").replace(SPACE, " ")
    .replace(/\s+/g, " ").trim().toLowerCase();
}
const loose = (s) => norm(s).replace(/[^\p{L}\p{N}]+/gu, "");
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Visible text plus alt, title, aria-label and meta content attributes, where some pages keep their own words.
export function htmlText(html) {
  const attrs = [...String(html).matchAll(/\s(?:alt|title|content|aria-label)="([^"]{12,})"/gi)].map((m) => m[1]).join(" ");
  // Pages built by script frameworks keep their words in JSON strings inside script tags.
  const json = [...String(html).matchAll(/"((?:[^"\\]|\\.){40,})"/g)].map((m) => m[1].replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\"/g, '"')).join(" ");
  return attrs + " " + json + " " + String(html).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(?:br|p|div|li|h\d|tr|td|th)\b[^>]*>/gi, " ").replace(/<[^>]+>/g, " ");
}

// "exact", "loose" (only punctuation or spacing differs), or null. Parts between "..." are checked one
// by one; parts under three words are skipped as unhelpful. A quote of one to three words with no "..."
// (a name in a portfolio list or a table cell) must match as whole words.
export function findQuote(quote, text) {
  const q = norm(quote), t = norm(text), lt = loose(text);
  const parts = q.replace(/^\.\.\.|\.\.\.$/g, "").split("...").map((p) => p.trim().replace(/^[\s"'(]+|[\s"')]+$/g, "")).filter((p) => p.split(" ").length >= 3);
  const whole = q.replace(/[."']/g, "").trim();
  if (!parts.length && whole && whole.split(" ").length <= 3 && !q.includes("...")) {
    return new RegExp("(^|[^\\p{L}\\p{N}])" + escapeRe(whole) + "([^\\p{L}\\p{N}]|$)", "u").test(t) ? "exact" : null;
  }
  if (!parts.length) return null;
  if (parts.every((p) => t.includes(p))) return "exact";
  if (parts.every((p) => lt.includes(loose(p)))) return "loose";
  return null;
}

function pdfText(buf) {
  const dir = mkdtempSync(join(tmpdir(), "radar-qc-")), file = join(dir, "a.pdf");
  try {
    writeFileSync(file, buf);
    const run = (extra) => execFileSync("pdftotext", ["-q", ...extra, file, "-"], { maxBuffer: 256 << 20 }).toString("utf8");
    return run([]) + "\n" + run(["-layout"]);
  } catch (e) { console.error(`[quotecheck] pdftotext failed: ${e.message.split("\n")[0]}`); return ""; } finally { rmSync(dir, { recursive: true, force: true }); }
}

async function grab(url) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 120000);
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,application/pdf,*/*" }, redirect: "follow", credentials: "omit", referrerPolicy: "no-referrer", signal: ctl.signal });
    const type = r.headers.get("content-type") || "", buf = Buffer.from(await r.arrayBuffer());
    // 202 is what bot walls answer with a challenge page; it is not the document.
    if (!r.ok || r.status === 202) return { status: r.status, text: "" };
    if (/pdf/i.test(type) || buf.subarray(0, 5).toString() === "%PDF-") return { status: r.status, text: pdfText(buf) };
    return { status: r.status, text: htmlText(buf.toString("utf8")) };
  } catch (e) { return { status: e.name === "AbortError" ? "timeout" : "error", text: "" }; } finally { clearTimeout(timer); }
}

// One source: { url, result, via, status }. result: exact | loose | not-found | unreadable.
export async function checkSource(s, cache = new Map()) {
  const get = (u) => (cache.has(u) ? cache.get(u) : cache.set(u, grab(u)).get(u));
  const direct = await get(s.url);
  let hit = direct.text ? findQuote(s.quote, direct.text) : null;
  if (hit) return { url: s.url, result: hit, via: "direct", status: direct.status };
  if (/web\.archive\.org/.test(s.url)) return { url: s.url, result: direct.text ? "not-found" : "unreadable", via: "direct", status: direct.status };
  const arch = await get(`https://web.archive.org/web/2026id_/${s.url}`);
  hit = arch.text ? findQuote(s.quote, arch.text) : null;
  if (hit) return { url: s.url, result: hit, via: "archive", status: arch.status };
  return { url: s.url, result: direct.text || arch.text ? "not-found" : "unreadable", via: direct.text ? "direct" : arch.text ? "archive" : "none", status: direct.status };
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

// Every { key, s } a records file holds: person rows (people-*.json) and outlet rows (outlets.json).
export function sourceJobs(records) {
  const jobs = [];
  for (const r of records) for (const b of r.backing || []) b.sources.forEach((s, k) => jobs.push({ key: `${r.id}/${b.id}/${k}`, s }));
  return jobs;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), oi = args.indexOf("--out");
  const out = oi >= 0 ? args.splice(oi, 2)[1] : join(ROOT, "project-docs/evidence/personalities-quotecheck.json");
  const dir = join(ROOT, "data/personalities-sources");
  const files = args.length ? args : readdirSync(dir).filter((f) => /^(people-.*|outlets)\.json$/.test(f)).map((f) => join(dir, f));
  const jobs = files.flatMap((f) => sourceJobs(JSON.parse(readFileSync(f, "utf8"))));
  const cache = new Map();
  const res = await pool(jobs, 5, async (j) => ({ key: j.key, ...(await checkSource(j.s, cache)) }));
  const tally = res.reduce((a, r) => ((a[r.result] = (a[r.result] || 0) + 1), a), {});
  writeFileSync(out, JSON.stringify({ checked: new Date().toISOString().slice(0, 10), tally, results: res }, null, 1) + "\n");
  console.log(`${res.length} quotes: ${Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(", ")} -> ${out}`);
}
