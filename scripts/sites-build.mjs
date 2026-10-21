// Builds src/ext/sites.json, the site table src/core/sites.js reads: founding date, country and
// owner type from Wikidata (CC0), and each site's fact-check record from the Data Commons
// ClaimReview feed (CC BY 4.0). Build time only; Radar never calls Wikidata or the feed from the
// browser. Network downloads run only with the author's approval.
//
//   node scripts/sites-build.mjs --in feed.json [--wd-cache wd.json] [--per-site 40]
//
// A review is filed under a site only when the fact-checker listed a page on that site as where the
// claim appeared (src/core/hosts.js). Every site with at least one such review gets a record; the
// record keeps the count of all its reviews and lists the newest `--per-site` of them.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { hostOf } from "../src/core/hosts.js";
import { arg, loadFeed, collect, appearanceStats, trim } from "./feed-rows.mjs";

// News outlet classes on Wikidata, checked by label on 2026-10-21. An item counts when it is an
// instance of one of these or of a direct subclass (Fox News is a "specialty channel", a subclass of
// television channel), so outlets modelled one level down are not missed.
const TYPES = { Q11032: "newspaper", Q1110794: "daily newspaper", Q1616075: "television station", Q17232649: "news website", Q1153191: "online newspaper",
  Q2001305: "television channel", Q1193236: "news media", Q192283: "news agency", Q41298: "magazine", Q14350: "radio station", Q1126006: "public broadcaster", Q15265344: "broadcaster" };
// Owner type as Wikidata states it: the item itself, or its legal form, is a nonprofit organisation
// (Q163740) or a business (Q4830453), or its owner (P127) is. The item's own statement wins over its
// owner's; when one level states both, the type says so.
const query = (type) => `SELECT ?item ?itemLabel ?site ?inc ?countryLabel ?pb ?npS ?npO ?coS ?coO WHERE {
 ?item wdt:P31/wdt:P279? wd:${type}; wdt:P856 ?site.
 OPTIONAL { ?item wdt:P571 ?inc } OPTIONAL { ?item wdt:P17 ?country }
 BIND(EXISTS { ?item wdt:P31/wdt:P279* wd:Q1126006 } AS ?pb)
 BIND(EXISTS { { ?item wdt:P31/wdt:P279* wd:Q163740 } UNION { ?item wdt:P1454/wdt:P279* wd:Q163740 } } AS ?npS)
 BIND(EXISTS { ?item p:P127 ?s1. ?s1 ps:P127 ?o1. FILTER NOT EXISTS { ?s1 pq:P582 ?e1 } { ?o1 wdt:P31/wdt:P279* wd:Q163740 } UNION { ?o1 wdt:P1454/wdt:P279* wd:Q163740 } } AS ?npO)
 BIND(EXISTS { { ?item wdt:P31/wdt:P279* wd:Q4830453 } UNION { ?item wdt:P1454/wdt:P279* wd:Q4830453 } } AS ?coS)
 BIND(EXISTS { ?item p:P127 ?s2. ?s2 ps:P127 ?o2. FILTER NOT EXISTS { ?s2 pq:P582 ?e2 } ?o2 wdt:P31/wdt:P279* wd:Q4830453 } AS ?coO)
 SERVICE wikibase:label { bd:serviceParam wikibase:language "en,fr,es,de,pt,it,ru,zh,ar". } }`;

async function wikidata() {
  const cache = arg("--wd-cache", null);
  if (cache && existsSync(cache)) return JSON.parse(readFileSync(cache, "utf8"));
  const out = [];
  for (const type of Object.keys(TYPES)) {
    const res = await fetch("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(query(type)), { headers: { "User-Agent": "Radar sites table builder (local, manual run)", Accept: "application/sparql-results+json" } });
    if (!res.ok) throw new Error(`Wikidata ${type} failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
    const b = (await res.json()).results.bindings;
    console.log(`${TYPES[type]}: ${b.length} rows`);
    out.push(...b.map((x) => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, v.value]))));
    await new Promise((r) => setTimeout(r, 1500));
  }
  if (cache) writeFileSync(cache, JSON.stringify(out));
  return out;
}

const T = (v) => v === "true";
function typeOf(rows) {
  const any = (k) => rows.some((r) => T(r[k]));
  if (any("pb")) return "public broadcaster";
  for (const [np, co] of [["npS", "coS"], ["npO", "coO"]]) {
    if (any(np) && any(co)) return "nonprofit and commercial";
    if (any(np)) return "nonprofit";
    if (any(co)) return "commercial";
  }
  return null;
}

// One fact row per host. The item whose website is the host wins; with several items, the first
// item by id (a stable choice). Labels that are bare Q-ids are left out.
function facts(bindings) {
  const byHost = new Map();
  for (const b of bindings) {
    const host = hostOf(b.site);
    if (!host) continue;
    const g = byHost.get(host) || new Map();
    const id = b.item.split("/").pop();
    (g.get(id) || g.set(id, []).get(id)).push(b);
    byHost.set(host, g);
  }
  const out = {};
  for (const [host, g] of [...byHost].sort(([a], [b]) => a.localeCompare(b))) {
    const [id, rows] = [...g].sort(([a], [b]) => Number(a.slice(1)) - Number(b.slice(1)))[0];
    const name = rows[0].itemLabel;
    if (!name || /^Q\d+$/.test(name)) continue;
    const years = rows.map((r) => (r.inc || "").match(/^(-?\d{4})/)).filter(Boolean).map((m) => m[1]).sort();
    const countries = [...new Set(rows.map((r) => r.countryLabel).filter((c) => c && !/^Q\d+$/.test(c)))].sort();
    out[host] = [name, years[0] || null, countries.join("; ") || null, typeOf(rows), id];
  }
  return out;
}

// Records: every review under each site it appeared on, newest first.
function records(rows, perSite) {
  const checkers = [], ci = new Map(), by = new Map();
  for (const r of rows) for (const s of r.sites) (by.get(s) || by.set(s, []).get(s)).push(r);
  const out = {};
  for (const [site, list] of [...by].sort(([a], [b]) => a.localeCompare(b))) {
    list.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || a.url.localeCompare(b.url));
    const dates = list.map((r) => r.date).filter(Boolean).sort();
    const idx = (name) => { if (!ci.has(name)) { ci.set(name, checkers.length); checkers.push(name); } return ci.get(name); };
    out[site] = { n: list.length, m: new Set(list.map((r) => r.checker)).size, since: dates[0] || null, until: dates[dates.length - 1] || null,
      reviews: list.slice(0, perSite).map((r) => [trim(r.claim, 200), r.rating, idx(r.checker), r.url, r.date]) };
  }
  return { checkers, records: out };
}

const perSite = Number(arg("--per-site", 40));
const feed = await loadFeed();
const { rows } = collect(feed);
const stats = appearanceStats(rows);
const F = facts(await wikidata());
const { checkers, records: R } = records(rows, perSite);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const table = {
  built: new Date().toISOString().slice(0, 10), feedModified: feed.dateModified || null,
  sources: {
    facts: { name: "Wikidata", url: "https://www.wikidata.org/", licence: "CC0 1.0" },
    records: { name: "Data Commons fact-check feed", url: "https://datacommons.org/factcheck/download", licence: "CC BY 4.0", licenceUrl: "https://creativecommons.org/licenses/by/4.0/", attribution: "ClaimReview markup published by each fact-checker, collected by Google Fact Check Tools and Data Commons." },
  },
  factFields: ["name", "founded", "country", "ownerType", "wikidata"], reviewFields: ["claim", "rating", "checker", "url", "date"],
  checkers, facts: F, records: R, stats,
};
const json = JSON.stringify(table);
writeFileSync(join(root, "src/ext/sites.json"), json);
const types = {};
for (const f of Object.values(F)) types[f[3] || "not stated"] = (types[f[3] || "not stated"] || 0) + 1;
console.log(`${Object.keys(F).length} sites with Wikidata facts; owner types ${JSON.stringify(types)}`);
console.log(`${Object.keys(R).length} sites with a fact-check record from ${checkers.length} fact-checkers; ${Buffer.byteLength(json)} bytes`);
console.log("appearances:", JSON.stringify(stats));
