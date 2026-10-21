// Builds a sourced ownership table from Wikidata and writes src/core/owners.data.js.
// Rows: news outlets, broadcasters, news websites and the big platforms, each with an official
// website (P856) and a CURRENT owner (P127 with no end date, not deprecated). Every row links back
// to its Wikidata item. Radar itself never calls Wikidata from the browser.
//   node scripts/owners-build.mjs [--save-raw raw.json]   (network download: run only with the author's approval)
//   node scripts/owners-build.mjs --in raw.json           (offline, from a saved raw snapshot)
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { applyCorrections, loadCorrections, correctionStatus, statusLines } from "./owner-corrections.mjs";

const TYPES = [
  "Q11032",    // newspaper
  "Q1110794",  // daily newspaper
  "Q1616075",  // television station
  "Q17232649", // news agency... (and similar news organisations)
  "Q1153191",  // online newspaper
  "Q2001305",  // television channel
  "Q1193236",  // news media
  "Q192283",   // news agency
  "Q35127",    // website
  "Q3220391",  // social networking service
  "Q15416",    // television program (news shows carry their network's owner)
  "Q41298",    // magazine
  "Q14350",    // radio station
  "Q1126006",  // public broadcaster
  "Q15265344", // broadcaster
];
// Owner first (P127). Where Wikidata states no current owner, the parent organisation (P749), then
// the publisher (P123), each labelled as what it is: a publisher is not an owner.
const VIA = [["P127", "owner"], ["P749", "parent"], ["P123", "publisher"]];
const query = (type) => `
SELECT ?item ?itemLabel ?site ?owner ?ownerLabel ?xuser ?via WHERE {
  VALUES ?type { wd:${type} }
  VALUES (?p ?ps ?via) { ${VIA.map(([pid, v]) => `(p:${pid} ps:${pid} "${v}")`).join(" ")} }
  ?item wdt:P31/wdt:P279? ?type; wdt:P856 ?site; ?p ?st.
  ?st ?ps ?owner; wikibase:rank ?rank.
  FILTER(?rank != wikibase:DeprecatedRank)
  FILTER NOT EXISTS { ?st pq:P582 ?end }
  FILTER NOT EXISTS { ?owner wdt:P570 ?died }        # people who have died are not current owners
  FILTER NOT EXISTS { ?owner wdt:P576 ?dissolved }   # nor are dissolved companies
  FILTER(?owner != ?item)
  OPTIONAL { ?item wdt:P2002 ?xuser }               # X username, for account cards
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,fr,de,es". }
} LIMIT 200000`;

// One query per class, so no single query runs into the service's time limit. --in reads a raw
// snapshot saved by an earlier run (no network); --save-raw keeps this run's raw answers, so the
// lockfile (data/LOCK.json) can pin them and scripts/upstream-guard.mjs can diff the next fetch.
const argOf = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const raw = argOf("--in") ? JSON.parse(readFileSync(argOf("--in"), "utf8")) : [];
for (const type of argOf("--in") ? [] : TYPES) {
  const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(query(type));
  const res = await fetch(url, { headers: { "User-Agent": "Radar ownership table builder (local, manual run)" } });
  if (!res.ok) { console.error("Wikidata query failed:", type, res.status, (await res.text()).slice(0, 500)); process.exit(1); }
  raw.push(...(await res.json()).results.bindings);
  await new Promise((r) => setTimeout(r, 1500));
}

if (argOf("--save-raw")) writeFileSync(argOf("--save-raw"), JSON.stringify(raw));

// One row per domain. The item whose website is exactly the domain wins; owners of that item are
// joined. Labels that are bare Q-ids (no English label) are dropped.
const byDomain = new Map();
for (const b of raw) {
  let host;
  try { host = new URL(b.site.value).hostname.replace(/^www\./, "").toLowerCase(); } catch { continue; }
  const owner = b.ownerLabel.value, via = b.via.value, rank = VIA.findIndex(([, v]) => v === via);
  if (/^Q\d+$/.test(owner) || /^Q\d+$/.test(b.itemLabel.value)) continue;
  const row = byDomain.get(host) || { name: b.itemLabel.value, domain: host, item: b.item.value, owners: new Map(), rank, x: b.xuser ? b.xuser.value.toLowerCase() : null };
  if (row.item !== b.item.value) continue;   // keep the first item seen for the domain
  if (rank < row.rank) { row.owners = new Map(); row.rank = rank; }   // an owner statement beats a parent or publisher
  if (rank === row.rank) row.owners.set(owner, b.owner.value);
  byDomain.set(host, row);
}
const upstreamRows = [...byDomain.values()].map((r) => ({
  name: r.name, domain: r.domain, owner: [...r.owners.keys()].sort().join("; "), source: r.item, ...(r.rank ? { via: VIA[r.rank][1] } : {}), ...(r.x ? { x: r.x } : {}),
})).sort((a, b) => a.domain.localeCompare(b.domain));
// Hand-kept, sourced corrections win over Wikidata (data/owner-corrections.json); the report says
// which ones Wikidata now agrees with, so they can be retired.
const corrections = loadCorrections(), { rows } = applyCorrections(upstreamRows, corrections);
for (const l of statusLines(correctionStatus(rows, corrections))) console.log(l);

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = `// (size reference) Generated by scripts/owners-build.mjs from Wikidata on ${(process.env.RADAR_BUILT || new Date().toISOString().slice(0, 10))}. Do not edit by hand.\n// ${rows.length} outlets; each row's source is its Wikidata item (current owners only, P127 without an end date).\nexport const OWNER_ROWS = ${JSON.stringify(rows)};\n`;
// The full table is loaded only when a page shows a link (src/ext/owners-lookup.js), so it ships
// as JSON next to the extension instead of inside every content script.
writeFileSync(join(root, "src/ext/owners.json"), JSON.stringify({ built: (process.env.RADAR_BUILT || new Date().toISOString().slice(0, 10)), rows }));
console.log(`${raw.length} statements -> ${rows.length} domains, ${out.length} bytes`);
