// Other coverage on a 100-story test set: how often GDELT returns at least 3 other outlets, and how
// long a lookup takes. Stories are headlines from Google News search feeds across editions and
// topics; each query is built exactly as the extension builds it (src/core/coverage.js). Requests
// are 10 s apart (--gap), above GDELT's one every 5 seconds. Raw headlines stay outside the
// repository (--out).
//
//   node scripts/eval/coverage-eval.mjs --out <dir> [--n 100]
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { coverageUrl, coverageList, coverageGroups } from "../../src/core/coverage.js";
import { hostOf } from "../../src/core/hosts.js";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const N = Number(arg("--n", 100)), OUT = arg("--out", null);
const UA = { "User-Agent": "Radar evaluation (local, manual run)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EDITIONS = [["en-US", "US", "US:en"], ["en-GB", "GB", "GB:en"], ["en-IN", "IN", "IN:en"], ["en-NG", "NG", "NG:en"], ["en-AU", "AU", "AU:en"], ["fr", "FR", "FR:fr"], ["de", "DE", "DE:de"], ["es-419", "MX", "MX:es-419"], ["pt-BR", "BR", "BR:pt-419"], ["ar", "AE", "AE:ar"]];
const TOPICS = ["election", "economy", "health", "climate", "court", "football", "technology", "war", "police", "school"];

async function stories() {
  const out = [];
  for (const q of TOPICS) for (const [hl, gl, ceid] of EDITIONS) {
    const xml = await (await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${hl}&gl=${gl}&ceid=${encodeURIComponent(ceid)}`, { headers: UA })).text();
    const item = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)][0];
    const title = item && (item[1].match(/<title>([\s\S]*?)<\/title>/) || [])[1];
    const src = item && (item[1].match(/<source url="([^"]+)">/) || [])[1];
    if (title) out.push({ edition: gl, topic: q, title: title.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'"), self: src ? hostOf(src) : null });
    await sleep(300);
  }
  return out.slice(0, N);
}

const cache = OUT && `${OUT}/stories.json`;
const set = cache && existsSync(cache) ? JSON.parse(readFileSync(cache, "utf8")) : await stories();
if (cache) { mkdirSync(OUT, { recursive: true }); writeFileSync(cache, JSON.stringify(set, null, 1)); }
const results = [];
for (const s of set) {
  const url = coverageUrl(s.title);
  if (!url) { results.push({ ...s, error: "short-title" }); continue; }
  const t0 = Date.now();
  let r;
  try {
    // As the extension does: one retry after 6 seconds when GDELT says it is busy.
    let text = await (await fetch(url, { headers: UA })).text();
    if (/^Please limit/.test(text)) { await sleep(6000); text = await (await fetch(url, { headers: UA })).text(); }
    const ms = Date.now() - t0;
    try { const list = coverageList(JSON.parse(text), { self: s.self }); r = { ...s, ms, outlets: list.length, groups: coverageGroups(list) }; } catch { r = { ...s, ms, error: text.slice(0, 80) }; }
  } catch (e) { r = { ...s, ms: Date.now() - t0, error: e.message }; }
  results.push(r);
  console.log(results.length, r.edition, r.topic, r.outlets ?? r.error, r.ms);
  await sleep(Number(arg("--gap", 10000)));
}
const ok = results.filter((r) => r.outlets >= 3).length, ms = results.filter((r) => r.ms != null).map((r) => r.ms).sort((a, b) => a - b);
const pct = (x) => ms[Math.min(ms.length - 1, Math.floor(ms.length * x))];
const summary = { stories: results.length, atLeast3: ok, share: Math.round((ok / results.length) * 1000) / 10, errors: results.filter((r) => r.error).length, medianMs: pct(0.5), p90Ms: pct(0.9) };
console.log(JSON.stringify(summary));
if (OUT) { mkdirSync(OUT, { recursive: true }); writeFileSync(`${OUT}/coverage.json`, JSON.stringify({ summary, results }, null, 1)); }
