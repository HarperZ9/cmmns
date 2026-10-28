// The rule for a definition catalogue entry (catalogue/schema/definition.v1.json, written out for a
// reader; this file is what the tests enforce). One rule set for every entry, whatever its topic or
// jurisdiction. Build-time and test-time only; the extension does not load it.

import { VERDICT_WORDS } from "./definitions.js";

export const ROLES = ["match", "comparison", "context"];
export const KINDS = ["statute", "regulation", "directive", "agency-guides", "platform-policy"];
export const OBSERVABLE = ["page", "public-record", "not-observable"];
export const STRENGTHS = ["direct", "indicative"];
export const HASH_METHODS = ["raw-bytes", "rendered-text"];
export const FORCE = ["in force", "published", "repealed", "not yet in force"];
// Official publishers only. A source on any other host is refused.
export const OFFICIAL_HOSTS = [
  "ecfr.gov", "govinfo.gov", "ftc.gov", "justice.gov", "uscode.house.gov",
  "eur-lex.europa.eu", "publications.europa.eu", "legislation.gov.uk", "help.x.com",
];
const KEYS = ["id", "version", "status", "verification", "role", "title", "jurisdiction", "instrument", "section", "kind", "binding_note", "in_force", "sources", "quotes", "elements", "does_not_prove", "related"];
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DASH = String.fromCharCode(0x2014);
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return null; } };
const str = (v, min = 1) => typeof v === "string" && v.trim().length >= min;

function sourceProblems(s, where) {
  const out = [];
  for (const k of ["url", "retrieved_url"]) {
    if (!str(s[k]) || !/^https:\/\//.test(s[k])) out.push(`${where}: ${k} must be https`);
    else if (!OFFICIAL_HOSTS.includes(host(s[k]))) out.push(`${where}: ${k} is not an official source host`);
  }
  if (!DAY.test(s.retrieved_at || "")) out.push(`${where}: retrieved_at must be YYYY-MM-DD`);
  if (!/^[0-9a-f]{64}$/.test(s.sha256 || "")) out.push(`${where}: sha256 must be 64 hex characters`);
  if (!HASH_METHODS.includes(s.hash_method)) out.push(`${where}: hash_method must be one of ${HASH_METHODS.join(", ")}`);
  if (!["curl", "browser"].includes(s.retrieved_with)) out.push(`${where}: retrieved_with must be curl or browser`);
  if (!str(s.publisher, 3)) out.push(`${where}: no publisher`);
  if (s.text_sha256 != null && !/^[0-9a-f]{64}$/.test(s.text_sha256)) out.push(`${where}: text_sha256 must be 64 hex characters`);
  return out;
}

function elementProblems(el, i, reg, where) {
  const out = [], w = `${where} element ${el && el.id}`;
  if (el.id !== String.fromCharCode(65 + i)) out.push(`${w}: ids must run A, B, C in order`);
  if (!str(el.label, 5)) out.push(`${w}: no label`);
  if (!OBSERVABLE.includes(el.observable_from)) out.push(`${w}: observable_from must be one of ${OBSERVABLE.join(", ")}`);
  if (!STRENGTHS.includes(el.strength)) out.push(`${w}: strength must be direct or indicative`);
  if (typeof el.required !== "boolean") out.push(`${w}: required must be true or false`);
  if (!Array.isArray(el.signals)) return [...out, `${w}: signals must be a list`];
  if (el.observable_from === "not-observable" && el.signals.length) out.push(`${w}: a not-observable element cites no signals`);
  for (const id of el.signals) {
    const s = reg.get(id);
    if (!s) out.push(`${w}: unknown signal ${id}`);
    else if (s.context_only) out.push(`${w}: ${id} is context only and never evidences an element`);
  }
  if (el.min_families != null) {
    const fams = new Set(el.signals.map((id) => (reg.get(id) || {}).family)).size;
    if (!(el.min_families >= 2) || el.min_families > fams) out.push(`${w}: min_families must be 2 or more and no more than the families its signals cover (${fams})`);
  }
  for (const t of [el.label, el.note || ""]) if (VERDICT_WORDS.test(t)) out.push(`${w}: verdict word in CMMNS' own text`);
  return out;
}

// Problems with one entry; an empty list means it passes. ctx: { registry, ids, file }.
export function entryProblems(e, { registry, ids = new Set(), file = null } = {}) {
  const out = [], w = e && e.id ? e.id : "entry";
  if (!e || typeof e !== "object") return ["not an object"];
  for (const k of KEYS) if (!(k in e)) out.push(`${w}: missing ${k}`);
  for (const k of Object.keys(e)) if (!KEYS.includes(k)) out.push(`${w}: unknown field ${k}`);
  if (out.length) return out;
  if (!/^[a-z0-9][a-z0-9-]{2,80}$/.test(e.id)) out.push(`${w}: bad id`);
  if (file && file !== `${e.id}.json`) out.push(`${w}: file name must be ${e.id}.json`);
  if (!/^\d+\.\d+\.\d+$/.test(e.version)) out.push(`${w}: version must be semver`);
  if (!["active", "withdrawn"].includes(e.status)) out.push(`${w}: bad status`);
  if (!ROLES.includes(e.role)) out.push(`${w}: role must be one of ${ROLES.join(", ")}`);
  if (!KINDS.includes(e.kind)) out.push(`${w}: kind must be one of ${KINDS.join(", ")}`);
  if (!e.jurisdiction || !/^(US|EU|UK|UK-EW-NI|platform:[a-z]+)$/.test(e.jurisdiction.code || "") || !str(e.jurisdiction.name)) out.push(`${w}: bad jurisdiction`);
  if (!e.in_force || !FORCE.includes(e.in_force.status) || !(e.in_force.since === null || DAY.test(e.in_force.since))) out.push(`${w}: bad in_force`);
  if (!Array.isArray(e.sources) || !e.sources.length) out.push(`${w}: at least one source`);
  else e.sources.forEach((s, i) => out.push(...sourceProblems(s || {}, `${w} source ${i}`)));
  out.push(...quoteProblems(e, w));
  const reg = new Map(((registry && registry.signals) || []).map((s) => [s.id, s]));
  if (!Array.isArray(e.elements) || !e.elements.length) out.push(`${w}: at least one element`);
  else e.elements.forEach((el, i) => out.push(...elementProblems(el || {}, i, reg, w)));
  if (!str(e.does_not_prove, 40)) out.push(`${w}: does_not_prove is required`);
  for (const r of e.related || []) if (ids.size && !ids.has(r)) out.push(`${w}: related entry ${r} does not exist`);
  for (const t of [e.title, e.binding_note, e.does_not_prove, e.instrument, e.section]) if (String(t).includes(DASH)) out.push(`${w}: em dash in CMMNS' own text`);
  if (VERDICT_WORDS.test(e.does_not_prove) || VERDICT_WORDS.test(e.title)) out.push(`${w}: verdict word in title or does_not_prove`);
  return out;
}

// A verified entry quotes its source; an unverified one quotes nothing, so nothing unchecked ships.
function quoteProblems(e, w) {
  const out = [];
  if (!Array.isArray(e.quotes)) return [`${w}: quotes must be a list`];
  if (e.verification === "verified" && !e.quotes.length) out.push(`${w}: a verified entry quotes its source`);
  if (e.verification === "unverified" && e.quotes.length) out.push(`${w}: an unverified entry must not carry quotes`);
  if (!["verified", "unverified"].includes(e.verification)) out.push(`${w}: verification must be verified or unverified`);
  e.quotes.forEach((q, i) => {
    if (!Number.isInteger(q.source) || !e.sources[q.source]) out.push(`${w} quote ${i}: source index out of range`);
    if (!str(q.locator, 3) || !str(q.text, 20)) out.push(`${w} quote ${i}: needs a locator and the text`);
  });
  return out;
}
