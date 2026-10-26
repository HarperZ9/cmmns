// Builds the persona marker's name list (src/ext/discourse/persons.json) from Wikidata query results
// (data/discourse/persons.sparql, run by `node scripts/discourse-data.mjs query`). The rule that keeps
// living private people out: a name is dropped when any other person in Wikidata with that name, as a
// label or an alias, may be alive (born in 1900 or later, or with a birth or death date missing), and
// when two people on the list share it. Short and single-word names are dropped, except a few
// ancient single names.
const tsv = (text) => String(text).replace(/\r/g, "").split("\n").slice(1).filter(Boolean).map((l) => l.split("\t"));
const qid = (iri) => (String(iri).match(/Q\d+/) || [""])[0];
const lit = (s) => { const m = String(s).match(/^"(.*)"(?:@\w+)?$/); return m ? m[1].replace(/\\"/g, '"') : String(s); };
const year = (s) => (s === "" || s == null ? null : Number(s));
const key = (s) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

// A name worth matching: two or more words of two letters or more, six letters in all; or a single
// word of five letters or more for someone who died before 1500 with 150 or more Wikipedia articles.
export function usableName(name, person) {
  // Words are counted as written, split on spaces only, so an apostrophe or a breve inside a name
  // does not turn one word into several.
  const k = key(name), parts = name.trim().split(/\s+/).map(key).filter(Boolean);
  if (/\d/.test(name) || k.replace(/ /g, "").length < 6 && parts.length > 1) return false;
  if (parts.length >= 2) return parts.every((p) => p.length >= 2);
  return parts.length === 1 && parts[0].length >= 5 && person.died != null && person.died < 1500 && person.links >= 150;
}

// rows: { people, aliases, homonyms: [rows from the four same-name queries] } as TSV text.
export function buildPersons({ people, aliases, homonyms }, meta) {
  const byQ = new Map();
  for (const [iri, label, sl, by, dy] of tsv(people)) byQ.set(qid(iri), { qid: qid(iri), name: lit(label), links: Number(sl), born: year(by), died: year(dy), names: new Set([lit(label)]) });
  for (const [iri, alias] of tsv(aliases)) { const p = byQ.get(qid(iri)); if (p) p.names.add(lit(alias)); }
  const risky = new Set();
  for (const text of homonyms) for (const [iri, name, , oby, ody] of tsv(text)) {
    const b = year(oby), d = year(ody);
    if (b == null || d == null || b >= 1900) risky.add(`${qid(iri)}|${key(lit(name))}`);
  }
  // A name two listed people share is ambiguous for both.
  const owners = new Map();
  for (const p of byQ.values()) for (const n of p.names) { const k = key(n); owners.set(k, (owners.get(k) || 0) + 1); }
  const out = [];
  let dropped = 0;
  for (const p of [...byQ.values()].sort((a, b) => b.links - a.links || a.qid.localeCompare(b.qid))) {
    if (p.died == null) continue;
    const keep = [...p.names].filter((n) => usableName(n, p) && !risky.has(`${p.qid}|${key(n)}`) && owners.get(key(n)) === 1);
    dropped += p.names.size - keep.length;
    if (keep.length) out.push([p.qid, p.name, p.born, p.died, [...new Set(keep.map((n) => n.trim()))].sort()]);
  }
  return { format: "daylight.persons/1", source: "Wikidata (CC0 1.0), query in data/discourse/persons.sparql", retrieved: meta.retrieved, minSitelinks: meta.minSitelinks, people: out, droppedNames: dropped };
}
