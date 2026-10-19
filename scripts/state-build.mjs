// Builds src/ext/state.json, the sourced state-links table (src/core/state.js), from two inputs:
//   1. Wikidata: news outlets whose ownership chain (P127, followed through owners of owners)
//      ends at a government, a sovereign state or a state agency. Basis "state-owned".
//   2. data/state-reports.json, a hand-kept list of domains and accounts named in published
//      influence-operation reports (platform threat reports, government filings, sanctions
//      listings). Every row must carry the report's title, URL and date. Basis "named-in-report".
// The same criteria apply to every country; no country is added or left out by hand.
//   node scripts/state-build.mjs        (network download: run only with the author's approval)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Outlet types, as in scripts/owners-build.mjs. Q7188 government, Q3624078 sovereign state,
// Q327333 government agency, Q270791 state-owned enterprise. Needs a live check of the result.
const QUERY = `
SELECT DISTINCT ?item ?itemLabel ?site ?xuser ?gov ?govLabel ?countryLabel WHERE {
  VALUES ?type { wd:Q11032 wd:Q1110794 wd:Q1616075 wd:Q1153191 wd:Q2001305 wd:Q1193236 wd:Q192283 wd:Q35127 }
  VALUES ?govType { wd:Q7188 wd:Q3624078 wd:Q327333 wd:Q270791 }
  ?item wdt:P31 ?type; wdt:P856 ?site; wdt:P127+ ?gov.
  ?gov wdt:P31/wdt:P279* ?govType.
  OPTIONAL { ?gov wdt:P17 ?c1 } OPTIONAL { ?gov wdt:P1001 ?c2 }
  BIND(COALESCE(?c2, ?c1, ?gov) AS ?country)
  OPTIONAL { ?item wdt:P2002 ?xuser }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 20000`;

async function wikidataRows() {
  const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(QUERY);
  const res = await fetch(url, { headers: { "User-Agent": "Radar state-links builder (local, manual run)" } });
  if (!res.ok) throw new Error(`Wikidata query failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  const seen = new Map();
  for (const b of (await res.json()).results.bindings) {
    let domain;
    try { domain = new URL(b.site.value).hostname.replace(/^www\./, "").toLowerCase(); } catch { continue; }
    const state = b.countryLabel && b.countryLabel.value;
    if (!state || /^Q\d+$/.test(state) || /^Q\d+$/.test(b.itemLabel.value)) continue;
    const key = domain + "|" + state;
    if (seen.has(key)) continue;
    seen.set(key, {
      domain, ...(b.xuser ? { x: b.xuser.value.toLowerCase() } : {}), state, basis: "state-owned", name: b.itemLabel.value,
      source: { title: `Wikidata: ${b.itemLabel.value}, owned through ${b.govLabel.value}`, url: b.item.value, date: new Date().toISOString().slice(0, 10) },
    });
  }
  return [...seen.values()];
}

function reportRows() {
  const p = join(root, "data/state-reports.json");
  if (!existsSync(p)) return [];
  const rows = JSON.parse(readFileSync(p, "utf8"));
  for (const r of rows) {
    if (!(r.domain || r.x) || !r.state || !r.name || !r.source || !r.source.url || !r.source.title || !r.source.date) {
      throw new Error("data/state-reports.json: every row needs domain or x, state, name and source {title, url, date}: " + JSON.stringify(r));
    }
  }
  return rows.map((r) => ({ ...r, basis: "named-in-report" }));
}

const rows = [...(await wikidataRows()), ...reportRows()].sort((a, b) => (a.domain || a.x).localeCompare(b.domain || b.x));
writeFileSync(join(root, "src/ext/state.json"), JSON.stringify({ built: new Date().toISOString().slice(0, 10), rows }) + "\n");
const per = rows.reduce((m, r) => ((m[r.state] = (m[r.state] || 0) + 1), m), {});
console.log(`state.json: ${rows.length} rows`, Object.entries(per).sort((a, b) => b[1] - a[1]).slice(0, 15));
