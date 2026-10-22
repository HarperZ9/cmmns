// Builds src/ext/personalities.json, the table behind "Backing on record", from the hand-kept records
// in data/personalities-sources/ (people-*.json and outlets.json), the Wikidata snapshot there, the
// quote check (project-docs/evidence/personalities-quotecheck.json) and the corrections in
// data/owner-corrections.json ("personalities"). It reads no network. A record that breaks the rule in
// src/core/personalities-schema.js stops the build. Only rows with at least one quote found on its page
// ship, and only those sources; leads, the balance labels and the research notes never ship.
//   node scripts/personalities-build.mjs [--check]   (--check: report only, write nothing)
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { personProblems, rowProblems, confidenceOf, shippable, statusAllowed, MATCHED } from "../src/core/personalities-schema.js";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "data/personalities-sources");
export const OUT = join(ROOT, "src/ext/personalities.json");
const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const clean = (v) => (typeof v === "string" ? v.replace(/\s*—\s*/g, " - ") : v);

export function loadInputs(dir = SRC) {
  const people = readdirSync(dir).filter((f) => /^people-.*\.json$/.test(f)).sort().flatMap((f) => json(join(dir, f)));
  const corr = json(join(ROOT, "data/owner-corrections.json"));
  return { people, outlets: json(join(dir, "outlets.json")), wikidata: json(join(dir, "wikidata.json")), quotecheck: json(join(ROOT, "project-docs/evidence/personalities-quotecheck.json")), corrections: corr.personalities || [] };
}

// Every problem in the inputs; an empty list means the build may run.
export function inputProblems({ people, outlets }) {
  const out = people.flatMap(personProblems);
  for (const o of outlets) for (const r of o.backing) out.push(...rowProblems(r, `outlet ${o.id}/${r.id}`));
  const ids = new Set(outlets.map((o) => o.id));
  for (const p of people) for (const r of p.backing) if (r.outlet && !ids.has(r.outlet)) out.push(`${p.id}/${r.id}: no outlet record ${r.outlet}`);
  // An outlet's owner is recorded once, on the outlet, so everyone there gets the same rows; a person's
  // own company is the exception.
  for (const p of people) if (p.backing.some((r) => r.outlet && r.current)) for (const r of p.backing) if (r.kind === "outlet owner" && !r.ownCompany) out.push(`${p.id}/${r.id}: an owner row belongs on the outlet record`);
  const seen = new Set();
  for (const p of people) { if (seen.has(p.id)) out.push(`${p.id}: listed twice`); seen.add(p.id); }
  return out;
}

// A correction retracts a row, or amends fields of it; either way the row keeps a note of it.
export function applyCorrection(row, c) {
  if (c.action === "retract") return null;
  return { ...row, ...(c.set || {}), correction: { source: c.source, checked: c.checked, reason: c.reason } };
}

// One shipped row: only the sources whose quotes were found, a status those sources allow, and a
// confidence computed from them.
function shipRow(r, checks, via) {
  if (!shippable(r, checks)) return null;
  const sources = r.sources.map((s, i) => ({ s, c: checks[i] })).filter((x) => MATCHED.has(x.c))
    .map(({ s, c }) => ({ publisher: clean(s.publisher), title: clean(s.title || ""), url: s.url, date: s.date || null, read: s.read, kind: s.kind, quote: clean(s.quote), check: c }));
  const kept = { ...r, sources };
  const allowed = statusAllowed(kept), status = allowed.includes(r.status) ? r.status : allowed[0];
  const out = { kind: r.kind, who: clean(r.who), summary: clean(r.summary), period: r.period || null, status, confidence: confidenceOf(kept, sources.map((s) => s.check)), sources, doesNotProve: clean(r.doesNotProve) };
  if (via) out.via = via;
  if (r.campaign) out.campaign = r.campaign;
  if (r.correction) out.correction = r.correction;
  return out;
}

function accountsOf(p, wd) {
  const acc = new Map(), channels = new Set();
  const add = (pl, h) => { if (h) acc.set(`${pl}:${String(h).replace(/^@/, "").toLowerCase()}`, [pl, String(h).replace(/^@/, "")]); };
  for (const a of p.accounts || []) { if (["x", "youtube", "tiktok", "instagram", "facebook", "bluesky", "threads"].includes(a.platform)) add(a.platform, a.handle); if (a.channelId) channels.add(a.channelId); }
  if (wd) { wd.x.forEach((h) => add("x", h)); wd.youtubeHandle.forEach((h) => add("youtube", h)); wd.tiktok.forEach((h) => add("tiktok", h)); wd.youtubeChannel.forEach((c) => channels.add(c)); }
  return { accounts: [...acc.values()].sort((a, b) => (a.join(":") < b.join(":") ? -1 : 1)), channels: [...channels].sort() };
}

export function buildTable({ people, outlets, wikidata, quotecheck, corrections }, built) {
  const checks = new Map(quotecheck.results.map((r) => [r.key, r.result]));
  const checksOf = (owner, r) => r.sources.map((_, i) => checks.get(`${owner}/${r.id}/${i}`) || "unchecked");
  const byOutlet = new Map(outlets.map((o) => [o.id, o]));
  const corr = new Map(corrections.map((c) => [`${c.person}/${c.row}`, c]));
  const shipped = [], held = [];
  for (const p of people) {
    const rows = [];
    const take = (owner, r, via) => {
      const c = corr.get(`${p.id}/${r.id}`), fixed = c ? applyCorrection(r, c) : r;
      if (!fixed) return;
      const s = shipRow(fixed, checksOf(owner, r), via);
      if (s) rows.push(s); else held.push(`${p.id}/${r.id}`);
    };
    for (const r of p.backing) take(p.id, r, null);
    for (const id of new Set(p.backing.filter((r) => r.outlet && r.current).map((r) => r.outlet))) for (const r of byOutlet.get(id).backing) take(id, r, byOutlet.get(id).name);
    if (!rows.length) continue;
    const wd = p.qid && wikidata.people[p.qid];
    shipped.push({ id: p.id, name: clean(p.name), role: clean(p.role), country: p.country || null, ...accountsOf(p, wd), rows,
      ...(wd && wd.employers.length ? { wikidata: { qid: p.qid, employers: wd.employers.map((e) => ({ label: clean(e.label), start: e.start, end: e.end })), fetched: wikidata.fetched } } : {}) });
  }
  return {
    table: { about: "Documented backing of public media personalities: employers, owners of their outlets, investors, deals, filings, court records, sanctions and government labels, each with its sources' own words, the date read and what it does not prove. Built by scripts/personalities-build.mjs; data/personalities.README.md explains the method.", built, wikidataFetched: wikidata.fetched, quotesChecked: quotecheck.checked, people: shipped },
    held,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const inputs = loadInputs(), problems = inputProblems(inputs);
  if (problems.length) { console.error(`[personalities] ${problems.length} problems:\n  ${problems.slice(0, 60).join("\n  ")}`); process.exit(1); }
  const built = process.env.RADAR_BUILT || new Date().toISOString().slice(0, 10);
  const { table, held } = buildTable(inputs, built);
  const rows = table.people.reduce((n, p) => n + p.rows.length, 0);
  console.log(`${table.people.length} people, ${rows} rows shipped; ${held.length} rows held back (a quote, or the record a row rests on, was not confirmed by the quote check): ${held.join(", ") || "none"}`);
  if (!process.argv.includes("--check")) writeFileSync(OUT, JSON.stringify(table) + "\n");
}
