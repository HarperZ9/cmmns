// Builds src/ext/state.json, the sourced state-links table (src/core/state.js), from two inputs:
//   1. Wikidata: news outlets whose ownership chain (P127, followed through owners of owners)
//      ends at a government, a sovereign state or a state agency. Basis "state-owned".
//   2. data/state-reports.json, a hand-kept list of domains and accounts named in published
//      influence-operation reports (platform threat reports, government filings, sanctions
//      listings). Every row must carry the report's title, URL and date. Basis "named-in-report".
// The same criteria apply to every country; no country is added or left out by hand.
//   node scripts/state-build.mjs        (network download: run only with the author's approval)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Wikidata part. Starting from the outlets in src/ext/owners.json (each row carries its Wikidata
// item), walk who controls each outlet, up to MAX_HOPS steps:
//   - parent organization (P749) is always followed: it means control;
//   - owned by (P127) is followed, except out of a listed public company, where owners are
//     shareholders; there only a stake of 50% or more (qualifier P1107) is followed;
//   - statements with an end date (P582) are skipped.
// An outlet is state-linked when Wikidata classes it as state media (Q2324556) or the walk reaches a
// state body: anything whose class falls under government (Q7188), government agency (Q327333),
// sovereign state (Q3624078), country (Q6256) or state-owned enterprise (Q270791). Sovereign
// wealth funds (Q1061648) do not count: they hold minority stakes in thousands of companies.
// IDs checked against Wikidata on 2026-10-18.
const MAX_HOPS = 3, PUBLIC_COMPANY = "Q891723", STATE_MEDIA = "Q2324556", PUBLIC_BROADCASTER = "Q1126006";
// Investors, not controllers: sovereign wealth funds, pension funds and investment funds hold stakes
// in thousands of companies, and Wikidata often keeps those stakes after a sale.
const INVESTORS = ["Q1061648", "Q182103", "Q4201895"];
// Universities and schools are not editorial controllers even when publicly funded.
const NOT_CONTROLLERS = ["Q2385804"];
// Pass-2 outlets must be media: a state body also owns labs, universities, archives and companies.
// IDs checked against Wikidata on 2026-10-18.
const MEDIA_ROOTS = ["Q11033", "Q1193236", "Q192283", "Q15265344", "Q1616075", "Q14350", "Q11032", "Q41298", "Q17232649", "Q2001305", "Q1254874"];
// Bodies of a region, province or city, not of a national government: Wikidata's "state agency of
// the United States" (an agency of one US state), or anything whose jurisdiction (P1001) is not a
// country, or an administrative area that is not a country (Q56061: a city or province). They
// are kept, labelled as regional.
const REGIONAL_CLASSES = ["Q20857085"];
// A government's own websites (nasa.gov, gov.uk) are not media; they are left out.
const GOV_DOMAIN = /(^|\.)(gov|mil|gouv|gob|govt|gc|go|admin|bund|regjeringen)\.[a-z.]+$|\.(gov|mil)$|(^|\.)gov\.[a-z]{2}$/;
const STATE_ROOTS = ["Q7188", "Q327333", "Q3624078", "Q6256", "Q270791"];
const UA = { "User-Agent": "Radar state-links builder (local, manual run)" };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// Fetched entities are cached on disk (.cache/, git-ignored) so an interrupted or rate-limited run
// resumes where it stopped.
const CACHE = join(root, ".cache/wikidata-entities.json");
let cache = null;
function loadCache() { if (!cache) cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {}; return cache; }
function saveCache() { mkdirSync(dirname(CACHE), { recursive: true }); writeFileSync(CACHE, JSON.stringify(cache)); }

async function entities(ids) {
  const C = loadCache(), out = {};
  const todo = ids.filter((q) => { if (C[q]) { out[q] = C[q]; return false; } return true; });
  for (let i = 0; i < todo.length; i += 50) {
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims|labels&languages=en&ids=${todo.slice(i, i + 50).join("|")}`;
    for (let attempt = 1; ; attempt++) {
      const res = await fetch(url, { headers: UA });
      if (res.ok) {
        for (const [q, e] of Object.entries((await res.json()).entities || {})) { C[q] = { id: e.id, labels: e.labels, claims: e.claims }; out[q] = C[q]; }
        break;
      }
      if (attempt >= 8) { saveCache(); throw new Error(`wbgetentities failed: ${res.status}`); }
      const wait = Number(res.headers.get("retry-after")) * 1000 || 5000 * attempt;
      console.error(`  ${res.status}; waiting ${Math.round(wait / 1000)} s`);
      await pause(wait);
    }
    if ((i / 50) % 10 === 9) { saveCache(); console.log(`  ${i + 50} of ${todo.length}`); }
    await pause(1200);
  }
  saveCache();
  return out;
}

const current = (e, p) => ((e && e.claims && e.claims[p]) || []).filter((c) => c.rank !== "deprecated" && !(c.qualifiers && c.qualifiers.P582));
const ids = (e, p) => current(e, p).map((c) => c.mainsnak.datavalue && c.mainsnak.datavalue.value.id).filter(Boolean);
const label = (e) => (e && e.labels && e.labels.en ? e.labels.en.value : null);
function controllers(e) {
  // With several owners listed (shareholders), only a recorded majority stake means control.
  const all = current(e, "P127");
  const listed = ids(e, "P31").includes(PUBLIC_COMPANY) || all.length > 1;
  const owners = all.filter((c) => {
    if (!listed) return true;
    const share = c.qualifiers && c.qualifiers.P1107 && c.qualifiers.P1107[0].datavalue;
    return share && Number(share.value.amount) >= 0.5;
  }).map((c) => c.mainsnak.datavalue && c.mainsnak.datavalue.value.id).filter(Boolean);
  return [...new Set([...ids(e, "P749"), ...owners])];
}

// Which of these classes fall under each root (one SPARQL per batch of classes).
async function classRoots(classes) {
  const roots = new Map();
  for (let i = 0; i < classes.length; i += 150) {
    const q = `SELECT ?c ?root WHERE { VALUES ?c { ${classes.slice(i, i + 150).map((c) => "wd:" + c).join(" ")} } VALUES ?root { ${[...STATE_ROOTS, STATE_MEDIA, PUBLIC_BROADCASTER, ...INVESTORS, ...NOT_CONTROLLERS, ...REGIONAL_CLASSES, "Q56061", ...MEDIA_ROOTS].map((c) => "wd:" + c).join(" ")} } ?c wdt:P279* ?root . }`;
    const res = await fetch("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(q), { headers: UA });
    if (!res.ok) throw new Error(`class query failed: ${res.status}`);
    for (const b of (await res.json()).results.bindings) {
      const c = b.c.value.split("/").pop();
      (roots.get(c) || roots.set(c, new Set()).get(c)).add(b.root.value.split("/").pop());
    }
    await pause(300);
  }
  return roots;
}

// Outlets beyond the ownership table: Wikidata items classed as state media or public broadcasters,
// and items whose parent or owner is a state body the first pass found (TASS, Kan and the like are
// missing from owners.json because it keeps only outlets with a recorded current owner).
async function sparql(q) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(q), { headers: UA });
    if (res.ok) return (await res.json()).results.bindings;
    console.error(`  sparql ${res.status}; retrying`);
    await pause(5000 * attempt);
  }
  throw new Error("sparql failed");
}
const asOutlet = (b) => {
  try {
    return { domain: new URL(b.site.value).hostname.replace(/^www\./, "").toLowerCase(), name: b.itemLabel.value, source: b.item.value, ...(b.xuser ? { x: b.xuser.value.toLowerCase() } : {}) };
  } catch { return null; }
};
const OUTLET_SELECT = "SELECT DISTINCT ?item ?itemLabel ?site ?xuser WHERE {";
const OUTLET_TAIL = `?item wdt:P856 ?site. OPTIONAL { ?item wdt:P2002 ?xuser } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 20000`;
async function extraOutlets(bodies) {
  const out = [];
  for (const cls of [STATE_MEDIA, PUBLIC_BROADCASTER]) out.push(...(await sparql(`${OUTLET_SELECT} ?item wdt:P31/wdt:P279* wd:${cls}. ${OUTLET_TAIL}`)).map(asOutlet));
  for (let i = 0; i < bodies.length; i += 80) {
    out.push(...(await sparql(`${OUTLET_SELECT} VALUES ?gov { ${bodies.slice(i, i + 80).map((q) => "wd:" + q).join(" ")} } ?item wdt:P127|wdt:P749 ?gov. ${OUTLET_TAIL}`)).map(asOutlet));
    await pause(500);
  }
  return out.filter((o) => o && !/^Q\d+$/.test(o.name));
}

// Shared state of the Wikidata walk: fetched entities and the roots each class falls under.
const E = {}, roots = new Map();
const qid = (r) => r.source.split("/").pop();
const under = (e, r) => ids(e, "P31").some((c) => roots.get(c) && roots.get(c).has(r));
const isStateBody = (e) => ![...INVESTORS, ...NOT_CONTROLLERS].some((r) => under(e, r)) && STATE_ROOTS.some((r) => under(e, r));
const isCountry = (e) => !!e && (under(e, "Q3624078") || under(e, "Q6256"));
const isRegional = (e) => REGIONAL_CLASSES.some((r) => under(e, r)) || (under(e, "Q56061") && !isCountry(e)) || (ids(e, "P1001").length > 0 && !isCountry(E[ids(e, "P1001")[0]]));
// The country, not a region: P17 first ("State of California" gives United States).
const countryOf = (e) => (isCountry(e) ? label(e) : label(E[ids(e, "P17")[0]]) || label(E[ids(e, "P1001")[0]]));

// Fetch outlets, their controllers up to MAX_HOPS, the classes they use, and country labels.
async function prepare(list) {
  const fresh0 = [...new Set(list.map(qid))].filter((q) => !E[q]);
  Object.assign(E, await entities(fresh0));
  let frontier = new Set(fresh0.flatMap((q) => controllers(E[q])));
  for (let hop = 1; hop <= MAX_HOPS && frontier.size; hop++) {
    const fresh = [...frontier].filter((q) => !E[q]);
    Object.assign(E, await entities(fresh));
    console.log(`  hop ${hop}: ${fresh.length} controllers`);
    frontier = new Set(fresh.flatMap((q) => controllers(E[q])));
  }
  const classes = [...new Set(Object.values(E).flatMap((e) => ids(e, "P31")))].filter((c) => !roots.has(c));
  for (const [c, set] of await classRoots(classes)) roots.set(c, set);
  for (const c of classes) if (!roots.has(c)) roots.set(c, new Set());
  const missing = [...new Set(Object.values(E).flatMap((e) => [...ids(e, "P17"), ...ids(e, "P1001")]))].filter((q) => !E[q]);
  Object.assign(E, await entities(missing));
}

// Why one outlet is state-linked, or null: its own class, else the nearest state body or public
// broadcaster among its controllers (breadth-first). Bodies found are added to `bodies`.
function linkOf(e, bodies) {
  if (under(e, STATE_MEDIA)) return { via: "classed as state media on Wikidata", state: label(E[ids(e, "P17")[0]]) };
  if (under(e, PUBLIC_BROADCASTER)) return { via: "classed as a public broadcaster on Wikidata", state: label(E[ids(e, "P17")[0]]), basis: "public-broadcaster" };
  let level = controllers(e);
  const seen = new Set([e.id]);
  for (let hop = 1; hop <= MAX_HOPS && level.length; hop++) {
    const next = [];
    for (const q of level) {
      if (seen.has(q)) continue;
      seen.add(q);
      const o = E[q];
      if (o && isStateBody(o)) { bodies.add(q); return { via: `controlled through ${label(o)}`, state: countryOf(o), ...(isRegional(o) ? { level: "regional" } : {}) }; }
      if (o && under(o, PUBLIC_BROADCASTER)) { bodies.add(q); return { via: `part of ${label(o)}, a public broadcaster`, state: label(E[ids(o, "P17")[0]]), basis: "public-broadcaster" }; }
      if (o) next.push(...controllers(o));
    }
    level = next;
  }
  return null;
}

function evaluate(list, out, bodies) {
  for (const r of list) {
    const e = E[qid(r)];
    if (!e || GOV_DOMAIN.test(r.domain)) continue;
    const hit = linkOf(e, bodies);
    if (!hit || !hit.state || /^Q\d+$/.test(hit.state)) continue;
    const key = r.domain + "|" + canon(hit.state);
    if (out.has(key)) continue;
    out.set(key, {
      domain: r.domain, ...(r.x ? { x: r.x } : {}), state: canon(hit.state), basis: hit.basis || "state-owned", ...(hit.level ? { level: hit.level } : {}), name: r.name,
      source: { title: `Wikidata: ${r.name}, ${hit.via}`, url: r.source.replace(/^http:/, "https:"), date: new Date().toISOString().slice(0, 10) },
    });
  }
}

async function wikidataRows() {
  const out = new Map(), bodies = new Set();
  const outlets = JSON.parse(readFileSync(join(root, "src/ext/owners.json"), "utf8")).rows.filter((r) => r.source);
  console.log(`pass 1: ${outlets.length} outlets from owners.json`);
  await prepare(outlets);
  evaluate(outlets, out, bodies);
  const known = new Set(outlets.map(qid));
  // Sorted by item id so a domain several items share always cites the same item.
  const extra = (await extraOutlets([...bodies])).filter((o) => !known.has(qid(o))).sort((a, b) => Number(qid(a).slice(1)) - Number(qid(b).slice(1)));
  console.log(`pass 2: ${extra.length} more outlets (state media, public broadcasters, children of ${bodies.size} state bodies)`);
  await prepare(extra);
  const media = extra.filter((o) => { const e = E[qid(o)]; return e && MEDIA_ROOTS.some((r) => under(e, r)); });
  console.log(`pass 2: ${media.length} of them are media`);
  evaluate(media, out, bodies);
  return [...out.values()];
}

// One spelling per country, so the panel never splits a country in two.
const CANON = { "People's Republic of China": "China", "Turkiye": "Türkiye", "Turkey": "Türkiye", "Russian Federation": "Russia", "United States of America": "United States", "Kingdom of the Netherlands": "Netherlands" };
const canon = (c) => CANON[c] || c;

function reportRows() {
  const p = join(root, "data/state-reports.json");
  if (!existsSync(p)) return [];
  const rows = JSON.parse(readFileSync(p, "utf8"));
  for (const r of rows) {
    if (!(r.domain || r.x) || !r.state || !r.name || !["government", "commercial firm", "individuals or group"].includes(r.actor) || !r.source || !r.source.url || !r.source.title || !r.source.date) {
      throw new Error("data/state-reports.json: every row needs domain or x, state, name, actor and source {title, url, date}: " + JSON.stringify(r));
    }
  }
  return rows.map((r) => ({ ...r, state: canon(r.state), basis: "named-in-report" }));
}

// Official designations (data/state-designations.json): a government or the EU classifying a named
// outlet as state-controlled. Domains come from the document when it gives one, otherwise from the
// exact-name Wikidata match in data/state-designations.domains.json (scripts/designations-match.mjs),
// cited separately as domainSource.
function designationRows() {
  const p = join(root, "data/state-designations.json"), q = join(root, "data/state-designations.domains.json");
  if (!existsSync(p)) return [];
  const rows = JSON.parse(readFileSync(p, "utf8")), matched = existsSync(q) ? JSON.parse(readFileSync(q, "utf8")) : {};
  const out = [];
  for (const r of rows) {
    if (!r.outlet || !r.state || !r.designation || !r.source || !r.source.url || !r.source.title || !r.source.date) throw new Error("bad designation row: " + JSON.stringify(r));
    const doms = r.domain ? [{ domain: r.domain.toLowerCase(), item: null }] : matched[r.outlet] || [];
    for (const d of doms) {
      out.push({ domain: d.domain, state: canon(r.state), basis: "designated", name: r.outlet, designation: r.designation, source: r.source,
        ...(d.item ? { domainSource: { title: `Wikidata: ${d.label}`, url: d.item.replace(/^http:/, "https:") } } : {}) });
    }
  }
  return out;
}

const rows = [...(await wikidataRows()), ...reportRows(), ...designationRows()].sort((a, b) => (a.domain || a.x).localeCompare(b.domain || b.x));
writeFileSync(join(root, "src/ext/state.json"), JSON.stringify({ built: new Date().toISOString().slice(0, 10), rows }) + "\n");
const per = rows.reduce((m, r) => ((m[r.state] = (m[r.state] || 0) + 1), m), {});
console.log(`state.json: ${rows.length} rows`, Object.entries(per).sort((a, b) => b[1] - a[1]).slice(0, 15));
