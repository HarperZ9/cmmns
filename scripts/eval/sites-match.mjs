// How many news links resolve to a row in CMMNS' site tables. Samples links from Google News
// search feeds (sources named in each item) across 14 editions and 8 topics, and from GDELT's
// article lists, then counts links whose site has an owner row (owners.json), Wikidata facts or
// a state link (sites.json, state.json). Raw links stay outside the repository (--out).
//
//   node scripts/eval/sites-match.mjs --out <dir> [--n 500]      sample, then score
//   node scripts/eval/sites-match.mjs --links <dir>/links.json    score a saved sample again
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { setOwnerRows, ownerOfDomain } from "../../src/core/owners.js";
import { setSiteTable, siteFacts } from "../../src/core/sites.js";
import { setStateRows, stateLinksOfDomain } from "../../src/core/state.js";
import { hostOf, siteKey } from "../../src/core/hosts.js";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const N = Number(arg("--n", 500)), OUT = arg("--out", null);
const load = (f) => JSON.parse(readFileSync(new URL(`../../src/ext/${f}`, import.meta.url), "utf8"));
setOwnerRows(load("owners.json").rows); setSiteTable(load("sites.json")); setStateRows(load("state.json").rows);

const EDITIONS = [["en-US", "US", "US:en"], ["en-GB", "GB", "GB:en"], ["en-IN", "IN", "IN:en"], ["en-NG", "NG", "NG:en"], ["en-AU", "AU", "AU:en"], ["en-CA", "CA", "CA:en"],
  ["en-ZA", "ZA", "ZA:en"], ["en-PH", "PH", "PH:en"], ["fr", "FR", "FR:fr"], ["de", "DE", "DE:de"], ["pt-BR", "BR", "BR:pt-419"], ["es-419", "MX", "MX:es-419"], ["ru", "RU", "RU:ru"], ["ar", "AE", "AE:ar"]];
const TOPICS = ["election", "economy", "health", "climate", "war", "court", "football", "technology"];
const UA = { "User-Agent": "CMMNS evaluation (local, manual run)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function google() {
  const links = [];
  for (const [hl, gl, ceid] of EDITIONS) for (const q of TOPICS) {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${hl}&gl=${gl}&ceid=${encodeURIComponent(ceid)}`;
    try {
      const xml = await (await fetch(url, { headers: UA })).text();
      for (const m of xml.matchAll(/<source url="([^"]+)">/g)) links.push({ from: "google-news", edition: gl, url: m[1] });
    } catch (e) { console.error("feed failed", url, e.message); }
    await sleep(400);
  }
  return links;
}

async function gdelt() {
  const links = [];
  for (const q of ["election vote", "economy inflation", "hospital health", "climate flood", "military attack", "court ruling", "football match", "technology company"]) {
    try {
      const j = await (await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q)}&mode=ArtList&format=json&maxrecords=250&timespan=1w`, { headers: UA })).json();
      for (const a of j.articles || []) links.push({ from: "gdelt", edition: a.sourcecountry, url: a.url });
    } catch (e) { console.error("gdelt failed", q, e.message); }
    await sleep(6000);
  }
  return links;
}

// An even sample: links in a fixed shuffled order, at most N, one link per site per edition.
function sample(links) {
  const seen = new Set(), out = [];
  const order = links.map((l, i) => [((i * 2654435761) >>> 0) % 1000003, l]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  for (const l of order) { const k = siteKey(hostOf(l.url)) + "|" + l.edition; if (!seen.has(k) && siteKey(hostOf(l.url))) { seen.add(k); out.push(l); } if (out.length >= N) break; }
  return out;
}

function score(list) {
  const hit = (f) => list.filter((l) => f(hostOf(l.url))).length;
  const pc = (n) => `${n} of ${list.length} (${Math.round((n / list.length) * 1000) / 10}%)`;
  return { links: list.length, owner: pc(hit((h) => ownerOfDomain(h))), facts: pc(hit((h) => siteFacts(h))), state: pc(hit((h) => stateLinksOfDomain(h).length)), any: pc(hit((h) => ownerOfDomain(h) || siteFacts(h) || stateLinksOfDomain(h).length)) };
}

const reuse = arg("--links", null);
const saved = reuse ? JSON.parse(readFileSync(reuse, "utf8")) : null;
const g = saved ? saved.google : sample(await google()), d = saved ? saved.gdelt : sample(await gdelt());
if (OUT) { mkdirSync(OUT, { recursive: true }); writeFileSync(`${OUT}/links.json`, JSON.stringify({ google: g, gdelt: d }, null, 1)); }
console.log("google-news", JSON.stringify(score(g)));
console.log("gdelt", JSON.stringify(score(d)));
const byEd = {};
for (const l of g) (byEd[l.edition] = byEd[l.edition] || []).push(l);
for (const [ed, list] of Object.entries(byEd)) console.log(ed, JSON.stringify(score(list)));
