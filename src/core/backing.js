// Documented backing of public media personalities (src/ext/personalities.json, built by
// scripts/personalities-build.mjs): the matcher behind "Backing on record", and the window's rows.
// An account matches when the table lists that exact handle on that platform, or that YouTube
// channel id. Every row is the sources' own words with dates, quotes and what it does not prove.
// The same rows and the same level for everyone: no input here is a person's side, country or name.

let PEOPLE = [];
const BY_HANDLE = new Map(), BY_CHANNEL = new Map();
const key = (platform, handle) => `${String(platform || "").toLowerCase()}:${String(handle || "").replace(/^@/, "").toLowerCase()}`;

// table: { people } as personalities.json has it, or a part of it from the background worker.
export function setBackingTable(table) {
  PEOPLE = (table && table.people) || [];
  BY_HANDLE.clear(); BY_CHANNEL.clear();
  for (const p of PEOPLE) {
    for (const [platform, handle] of p.accounts || []) BY_HANDLE.set(key(platform, handle), p);
    for (const c of p.channels || []) BY_CHANNEL.set(c, p);
  }
}

// Daylight Commons' site ids are the platform names the table uses ("fixture" behaves as X).
const PLATFORM_OF = { fixture: "x" };
export const backingOf = (site, handle) => BY_HANDLE.get(key(PLATFORM_OF[site] || site, handle)) || null;
export const backingOfChannel = (id) => (id && BY_CHANNEL.get(id)) || null;

// The part of a full table a page needs: the people behind these [site, handle] pairs and channel ids.
export function backingLookup(table, { accounts = [], channels = [] } = {}) {
  const want = new Set(accounts.map(([s, h]) => key(PLATFORM_OF[s] || s, h))), ch = new Set(channels);
  return { ...table, people: ((table && table.people) || []).filter((p) => (p.accounts || []).some(([s, h]) => want.has(key(s, h))) || (p.channels || []).some((c) => ch.has(c))) };
}

// Distinct documents behind a person's rows (Wikidata is shown apart and not counted).
export const sourceCount = (p) => new Set((p.rows || []).flatMap((r) => r.sources.map((s) => s.url))).size;
export const backingLabel = (p) => { const n = sourceCount(p); return `Backing on record: ${n} source${n === 1 ? "" : "s"}`; };

export const BACKING_DOES_NOT_PROVE = "A record of who employs, owns, funds or contracted with a person says nothing on its own about whether a given post is true, or that the backer chose its words. Allegations in court records are unproven. Records go out of date; each row gives the date it was read.";
export const CORRECTIONS_PATH = "https://github.com/HarperZ9/daylight-commons/blob/dev/data/owner-corrections.json";

const STATUS_WORDS = { documented: "documented in a primary record", reported: "reported by the press", alleged: "alleged, not proven" };
const quoteLine = (s) => `${s.publisher}${s.date ? ` (${s.date})` : ""}, read ${s.read}: "${s.quote}"`;

// The window's rows for one person, in the sources' own words.
export function backingRows(p) {
  const rows = [["Backing on record", `${p.name}, ${p.role}. ${sourceCount(p)} documents in ${p.rows.length} record${p.rows.length === 1 ? "" : "s"}.`]];
  for (const r of p.rows) {
    rows.push([r.kind[0].toUpperCase() + r.kind.slice(1), `${r.who}${r.via ? ` (as owner or backer of ${r.via})` : ""}${r.period ? `, ${r.period}` : ""}. ${r.summary} Status: ${STATUS_WORDS[r.status]}; confidence ${r.confidence}.`]);
    rows.push(["Sources say", r.sources.slice(0, 3).map(quoteLine).join(" ")]);
    rows.push(["Read it", { links: r.sources.slice(0, 3).map((s) => [String(s.url).replace(/^https?:\/\//, "").slice(0, 48), s.url]) }]);
    if (r.campaign) rows.push(["Documented campaign", `${r.campaign.name}: ${r.campaign.contentType}${r.campaign.dates ? `, ${r.campaign.dates}` : ""}.${(r.campaign.techniques || []).length ? ` Techniques the source supports: ${r.campaign.techniques.join("; ")}.` : ""}`]);
    rows.push(["This does not prove", r.doesNotProve]);
  }
  if (p.wikidata && p.wikidata.employers && p.wikidata.employers.length) rows.push(["Wikidata lists", `Employer (P108): ${p.wikidata.employers.map((e) => e.label + (e.end ? ` (to ${e.end.slice(0, 4)})` : "")).join("; ")}. Fetched ${p.wikidata.fetched}; Wikidata can lag a move.`]);
  rows.push(["Wrong or out of date?", { links: [["Send a sourced correction", CORRECTIONS_PATH]] }]);
  rows.push(["Does not prove", BACKING_DOES_NOT_PROVE]);
  return rows;
}
