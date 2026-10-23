// The definition catalogue (catalogue/, project-docs/DEFINITION-CATALOGUE.md): given a finding's
// signals, build an element table for each published definition. Each element is matched, not
// matched or not observable, with the evidence behind it.
//
// The phrasing is "matches elements A and B of [definition]". Daylight Commons compares visible conduct with a
// published definition; a court, a regulator or the platform decides whether a rule was broken.
// No text built here ever says the conduct was committed, or that anyone is guilty or liable:
// VERDICT_WORDS is checked by tests/definitions.test.js on every table the catalogue can produce.
// Pure: no DOM, no network. The caller passes the catalogue entries and the signal registry.

export const VERDICT_WORDS = /\b(?:committed|commits?|guilty|is (?:a )?fraud|fraudulent|violat\w*|illegal|unlawful|liable|liability|crimes?|criminal|convict\w*|breach\w*|offen[cs]es?)\b/i;
export const DEFINITION_FRAME = "This compares visible conduct with a published definition, element by element. Findings belong to courts, regulators and the platform.";
export const LEGAL_NOTE = "Not legal advice. A media lawyer should review this wording before any public release.";
export const CHALLENGE = "Challenge this entry or this badge at https://github.com/HarperZ9/daylight-commons/issues/new?template=challenge.yml. Every decision is published with its reasons, and corrections are dated.";
export const STATUSES = ["matched", "not-matched", "not-observable"];

// The words Daylight Commons must never produce about conduct, found in a piece of generated text.
export function verdictHits(text) {
  const out = [], re = new RegExp(VERDICT_WORDS.source, "gi");
  for (const m of String(text || "").matchAll(re)) out.push(m[0]);
  return out;
}

const list = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const plural = (xs, one, many) => (xs.length === 1 ? one : many);

// signal id -> family, from the registry (catalogue/signals.json).
function familyOf(registry) {
  return new Map(((registry && registry.signals) || []).map((s) => [s.id, s.family]));
}

// finding: { signals: [{ id, ref, text? }] }. Returns signal id -> list of evidence references.
export function presentSignals(finding) {
  const m = new Map();
  for (const s of (finding && finding.signals) || []) {
    if (!s || !s.id) continue;
    if (!m.has(s.id)) m.set(s.id, []);
    m.get(s.id).push(s.ref || s.id);
  }
  return m;
}

// One element's row. A not-observable element is never matched, whatever signals are present.
export function elementRow(el, present, families) {
  const base = { id: el.id, label: el.label, observable_from: el.observable_from, strength: el.strength, required: el.required !== false, note: el.note || null };
  if (el.observable_from === "not-observable") return { ...base, status: "not-observable", evidence: [], families: 0, needed: 0 };
  const evidence = el.signals.filter((id) => present.has(id)).map((id) => ({ signal: id, refs: present.get(id) }));
  const fams = new Set(evidence.map((e) => families.get(e.signal) || e.signal)).size;
  const needed = el.min_families || 1;
  return { ...base, status: fams >= needed ? "matched" : "not-matched", evidence, families: fams, needed };
}

function citeOf(entry) {
  return `${entry.section} (${entry.title}, ${entry.jurisdiction.name})`;
}

// The one-paragraph summary. It names matched, indicative, unobservable and unevidenced elements,
// and it never says a definition is met: the frame line always follows.
export function summarizeTable(entry, rows) {
  const ids = (st) => rows.filter((r) => r.status === st).map((r) => r.id);
  const matched = ids("matched"), unseen = ids("not-observable");
  const partial = rows.filter((r) => r.status === "not-matched" && r.families > 0);
  const missing = rows.filter((r) => r.status === "not-matched" && !r.families).map((r) => r.id);
  const indicative = rows.filter((r) => r.status === "matched" && r.strength === "indicative").map((r) => r.id);
  const lead = entry.role === "comparison" ? "For comparison: " : entry.role === "context" ? "Context: " : "";
  const parts = [matched.length
    ? `${lead}this conduct matches ${plural(matched, "element", "elements")} ${list(matched)} of ${citeOf(entry)}.`
    : `${lead}zero elements of ${citeOf(entry)} match what this page loaded.`];
  if (indicative.length) parts.push(`${plural(indicative, "Element", "Elements")} ${list(indicative)} ${plural(indicative, "is", "are")} matched on indicative evidence: signals consistent with ${plural(indicative, "it", "them")}.`);
  if (unseen.length) parts.push(`${plural(unseen, "Element", "Elements")} ${list(unseen)} ${plural(unseen, "is", "are")} outside what this page can show.`);
  for (const r of partial) parts.push(`Element ${r.id} has ${r.families} of the ${r.needed} independent signal families it needs, so it stays unmatched.`);
  if (missing.length) parts.push(`${plural(missing, "Element", "Elements")} ${list(missing)} ${plural(missing, "lacks", "lack")} evidence in what this page loaded.`);
  parts.push(DEFINITION_FRAME);
  const s = parts.join(" ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// The element table for one entry. An unverified entry is never matched: it returns null.
export function elementTable(entry, finding, registry) {
  if (!entry || entry.verification !== "verified" || entry.status !== "active") return null;
  const present = presentSignals(finding), families = familyOf(registry);
  const rows = entry.elements.map((el) => elementRow(el, present, families));
  const src = entry.sources[0];
  return {
    entry: entry.id, version: entry.version, catalogue: `${entry.id}@${entry.version}`,
    title: entry.title, jurisdiction: entry.jurisdiction, role: entry.role,
    citation: `${entry.instrument}, ${entry.section}`,
    source: { url: src.url, retrieved_at: src.retrieved_at, sha256: src.sha256 },
    quotes: entry.quotes.map((q) => ({ locator: q.locator, text: q.text, url: entry.sources[q.source].url })),
    rows,
    matched: rows.filter((r) => r.status === "matched").map((r) => r.id),
    notObservable: rows.filter((r) => r.status === "not-observable").map((r) => r.id),
    notMatched: rows.filter((r) => r.status === "not-matched").map((r) => r.id),
    summary: summarizeTable(entry, rows),
    dnp: entry.does_not_prove, legal_note: LEGAL_NOTE, challenge: CHALLENGE,
  };
}

// Every jurisdiction that applies, with why. Daylight Commons shows all of them and never picks the harshest.
// actor and audience are jurisdiction codes ("US", "EU", "UK") or null when not public.
export function applicableJurisdictions({ platform = null, actor = null, audience = null } = {}) {
  const out = [], notes = [];
  const add = (code, why) => { if (code && !out.some((j) => j.code === code)) out.push({ code, why }); else if (code) out.find((j) => j.code === code).why += ` ${why}`; };
  if (platform) add(`platform:${platform}`, "The conduct is on this platform, under its own published rules.");
  if (actor) add(actor, "Where the actor is disclosed to be based.");
  else notes.push("The actor's location is private, so its jurisdiction stays off this table.");
  if (audience) add(audience, "Where the audience is reached, shown as your own.");
  return { jurisdictions: out, notes };
}

// A code covers itself and its parts: "UK" covers "UK-EW-NI" (England and Wales, and Northern Ireland).
const covers = (code, entryCode) => entryCode === code || entryCode.startsWith(`${code}-`);

// Tables for every active, verified entry in the given jurisdictions, in a fixed order (jurisdiction,
// then role, then id). The order never depends on how damning a table looks.
export function elementTables(entries, finding, registry, { jurisdictions = null } = {}) {
  const codes = jurisdictions && jurisdictions.map((j) => (typeof j === "string" ? j : j.code));
  const roleOrder = { match: 0, comparison: 1, context: 2 };
  return (entries || [])
    .filter((e) => !codes || codes.some((c) => covers(c, e.jurisdiction.code)))
    .map((e) => elementTable(e, finding, registry))
    .filter(Boolean)
    .sort((a, b) => a.jurisdiction.code.localeCompare(b.jurisdiction.code) || roleOrder[a.role] - roleOrder[b.role] || a.entry.localeCompare(b.entry));
}

// The campaign lens's output as a finding. Every indicator and context row becomes a signal with a
// reference back to its lens row. online-post is always present; product-promotion when the lens
// was opened on a launch or quotes carry promotion; actor-organisation when the platform discloses
// the launch account as an organisation (actorOf in src/core/campaign.js).
export function signalsFromCampaign(lens, { launch = true, actor = null } = {}) {
  const rows = [...((lens && lens.indicators) || []), ...((lens && lens.context) || [])];
  const signals = rows.map((r) => ({ id: r.id, ref: `campaign:${r.id}`, text: r.text }));
  signals.push({ id: "online-post", ref: "campaign:post" });
  if (launch || rows.some((r) => r.id === "promo-cue" || r.id === "disclosed-paid")) signals.push({ id: "product-promotion", ref: launch ? "campaign:launch" : "campaign:promotion" });
  if (actor) signals.push({ id: "actor-organisation", ref: "campaign:actor" });
  return { signals };
}

// Every piece of text Daylight Commons itself wrote into a table (quotes from the source are left out: they are
// the law's words, not Daylight Commons').
export function generatedText(table) {
  return [table.summary, table.dnp, table.legal_note, table.challenge, ...table.rows.flatMap((r) => [r.label, r.note || ""])].join("\n");
}
