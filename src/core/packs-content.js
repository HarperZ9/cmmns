// What a signed data pack (src/core/packs.js) may add, and how it joins Daylight Commons' own tables. Three
// parts, each a list: claims (fact-checks: the claim, the rating in the checker's words, the
// checker, the review URL), ops (a domain or account a cited document names as part of an
// operation) and siteNotes (a sourced note about a site). Every row must cite an https source.
// Pack rows are kept apart from Daylight Commons' own: each carries the pack's name, and operations from
// packs never enter the trend counts.

// The same lists as src/core/ops-schema.js (tests/packs-content.test.js keeps them equal); that
// module is build-time only and is not in the bundle.
export const PACK_INDICATOR_KINDS = ["cloned news domain", "operation site", "operation account"];
export const PACK_OPERATOR_TYPES = ["government", "state media", "contractor", "linked to a state", "commercial firm", "origin only"];
export const PACK_LIMITS = { claims: 50000, ops: 5000, siteNotes: 5000 };
const PARTS = Object.keys(PACK_LIMITS);

const str = (v, min, max) => typeof v === "string" && v.trim().length >= min && v.length <= max;
const https = (v) => { try { return new URL(v).protocol === "https:"; } catch { return false; } };
const day = (v) => v == null || /^\d{4}-\d{2}-\d{2}$/.test(v);
const DOMAIN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
const HANDLE = /^\w{1,30}$/;
// Daylight Commons shows no em dash anywhere a user reads (tests/canon.test.js); pack text is cleaned the same way.
const clean = (s) => String(s).replace(/\s*—\s*/g, " - ");

function claimProblems(c) {
  const out = [];
  if (!str(c.claim, 12, 600)) out.push("claim must be 12 to 600 characters");
  if (!str(c.rating, 1, 120)) out.push("rating must be 1 to 120 characters");
  if (!str(c.checker, 1, 120)) out.push("checker must be 1 to 120 characters");
  if (!https(c.url)) out.push("url must be an https address");
  if (!day(c.date)) out.push("date must be YYYY-MM-DD");
  return out;
}

function opProblems(o) {
  const out = [], op = o.operation || {}, s = o.source || {};
  if (!(o.domain ? DOMAIN.test(o.domain) : HANDLE.test(o.x || ""))) out.push("needs a lower-case domain or an account handle");
  if (!PACK_INDICATOR_KINDS.includes(o.kind)) out.push(`kind must be one of: ${PACK_INDICATOR_KINDS.join(", ")}`);
  if (!str(op.id, 3, 80) || !str(op.name, 3, 200) || !str(op.state, 2, 80) || !str(op.operator, 2, 200)) out.push("operation needs id, name, state and operator");
  if (!PACK_OPERATOR_TYPES.includes(op.operatorType)) out.push(`operatorType must be one of: ${PACK_OPERATOR_TYPES.join(", ")}`);
  if (!str(s.title, 3, 300) || !https(s.url) || !day(s.date) || !s.date) out.push("source needs a title, an https url and a date");
  if (s.says != null && !str(s.says, 3, 300)) out.push("source.says must be 3 to 300 characters");
  return out;
}

function noteProblems(n) {
  const out = [];
  if (!DOMAIN.test(n.domain || "")) out.push("domain must be a lower-case domain");
  if (!str(n.note, 3, 400)) out.push("note must be 3 to 400 characters");
  if (!https(n.url)) out.push("url must be an https address for the note's source");
  return out;
}

const CHECK = { claims: claimProblems, ops: opProblems, siteNotes: noteProblems };
// Every problem with a content object, as "part[index]: problem". An empty list means it may load.
export function validatePackContent(content) {
  if (!content || typeof content !== "object") return ["content is missing"];
  const out = [];
  for (const k of Object.keys(content)) {
    if (!PARTS.includes(k)) { out.push(`unknown content part "${k}"`); continue; }
    const list = content[k];
    if (!Array.isArray(list)) { out.push(`${k} must be a list`); continue; }
    if (list.length > PACK_LIMITS[k]) out.push(`${k} has ${list.length} rows, over the limit of ${PACK_LIMITS[k]}`);
    list.slice(0, PACK_LIMITS[k]).forEach((row, i) => { for (const p of CHECK[k](row || {})) out.push(`${k}[${i}]: ${p}`); });
  }
  return out;
}

// What a pack adds, in words, for the import screen.
export function packSummary(content = {}) {
  const n = (k) => (Array.isArray(content[k]) ? content[k].length : 0);
  const parts = [[n("claims"), "fact-checked claim"], [n("ops"), "operation indicator"], [n("siteNotes"), "site note"]].filter(([c]) => c);
  return parts.length ? parts.map(([c, w]) => `${c.toLocaleString("en")} ${w}${c === 1 ? "" : "s"}`).join(", ") : "nothing";
}

// claims.json's packed rows ([claim, rating, checker index, url, date, lang, site]) with the pack
// claims added. packs: [{ name, content }] already verified and enabled.
export function mergePackClaims(table, packs = []) {
  const checkers = [...((table && table.checkers) || [])], rows = [...((table && table.rows) || [])];
  const at = new Map(checkers.map((c, i) => [c, i]));
  for (const p of packs) {
    for (const c of (p.content && p.content.claims) || []) {
      const who = `${clean(c.checker)} (pack: ${clean(p.name)})`;
      if (!at.has(who)) { at.set(who, checkers.length); checkers.push(who); }
      rows.push([clean(c.claim), clean(c.rating), at.get(who), c.url, c.date || null, c.lang || null, null]);
    }
  }
  return { ...(table || {}), checkers, rows };
}

// ops.json ({ docs, ops, indicators }) with pack indicators added. Each pack operation gets its own
// id ("pack:<key id>:<id>") and a `pack` field, so it never merges into one of Daylight Commons' operations.
export function mergePackOps(table, packs = []) {
  const docs = [...((table && table.docs) || [])], ops = [...((table && table.ops) || [])], indicators = [...((table && table.indicators) || [])];
  const byId = new Map();
  for (const p of packs) {
    for (const o of (p.content && p.content.ops) || []) {
      const s = o.source, doc = docs.push({ publisher: s.publisher ? clean(s.publisher) : null, title: clean(s.title), url: s.url, date: s.date, kind: null, terms: null }) - 1;
      const id = `pack:${String(p.keyId || "").slice(0, 8)}:${o.operation.id}`;
      let op = byId.get(id);
      if (!op) {
        op = { id, name: clean(o.operation.name), aliases: [], state: clean(o.operation.state), operator: clean(o.operation.operator), operatorType: o.operation.operatorType, attributions: [], docs: [], first: s.date, pack: clean(p.name) };
        byId.set(id, op); ops.push(op);
      }
      op.attributions.push({ doc, says: clean(s.says || `named ${o.domain || "@" + o.x} as ${o.kind}`) });
      op.docs.push(doc);
      if (s.date < op.first) op.first = s.date;
      indicators.push({ ...(o.domain ? { d: o.domain } : { x: String(o.x).toLowerCase() }), op: id, kind: o.kind, doc });
    }
  }
  return { ...(table || {}), docs, ops, indicators };
}

// Site notes from enabled packs, by domain. A subdomain finds its parent's notes.
let NOTES = new Map();
export function setPackNotes(packs = []) {
  NOTES = new Map();
  for (const p of packs) for (const n of (p.content && p.content.siteNotes) || []) {
    (NOTES.get(n.domain) || NOTES.set(n.domain, []).get(n.domain)).push({ note: clean(n.note), url: n.url, pack: clean(p.name) });
  }
}
export function siteNotesOf(host) {
  const parts = String(host || "").toLowerCase().replace(/^www\./, "").split(".");
  for (let k = 0; k < parts.length - 1; k++) { const got = NOTES.get(parts.slice(k).join(".")); if (got) return got; }
  return [];
}
