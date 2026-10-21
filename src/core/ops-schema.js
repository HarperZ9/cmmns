// The evidence threshold for an influence operation in data/ops-sources/ (built into ops.json by
// scripts/ops-build.mjs). One rule set for every operation. Nothing here reads which country an
// operation is attributed to: tests/ops.symmetry.test.js checks that relabelling the country never
// changes the result, and that this file names no country.

export const OPERATOR_TYPES = ["government", "state media", "contractor", "linked to a state", "commercial firm", "origin only"];
// What kind of document the source is. "court" covers indictments, complaints, affidavits and
// sanctions texts; "government" covers other official reports and statements.
export const SOURCE_KINDS = ["court", "government", "platform", "researcher", "press"];
export const INDICATOR_KINDS = ["cloned news domain", "operation site", "operation account"];
export const TECHNIQUES = [
  "cloned news sites", "fake news outlets", "fake personas", "hijacked or bought accounts", "spam amplification",
  "comment brigading", "AI-generated text", "AI-generated images or video", "deepfake audio or video", "hack and leak",
  "paid placement in real media", "paid influencers", "forged documents", "typosquatted domains", "content laundering",
  "search and chatbot seeding", "impersonating real outlets or officials", "harassment of critics", "fake fact-checks",
  "intimidation", "machine translation", "ads", "front organisations", "state media amplification",
];
// Fields that must name the sources they come from when they are filled in.
export const CITED = ["active", "platforms", "languages", "targets", "narratives", "techniques"];
export const MAX_QUOTE_WORDS = 25;

const DATE = /^(19|20)\d\d(-[01]\d(-[0-3]\d)?)?$/;
const DOMAIN = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(xn--[a-z0-9-]+|[a-z]{2,24})$/;
const HANDLE = /^[A-Za-z0-9_]{1,15}$/;
const ID = /^[a-z0-9][a-z0-9-]{2,80}$/;
const words = (s) => String(s).trim().split(/\s+/).filter(Boolean).length;
const filled = (v) => (Array.isArray(v) ? v.length > 0 : v && typeof v === "object" ? Object.keys(v).length > 0 : !!v);
// A source counts as read when its record does not say it was not fetched.
export const sourceRead = (s) => !!s && typeof s.checked === "string" && !/^not fetched/i.test(s.checked);

function sourceProblems(s) {
  const out = [];
  if (!s || !/^[A-Za-z0-9_-]{1,40}$/.test(s.id || "")) out.push("source without an id");
  for (const k of ["publisher", "title", "terms", "checked"]) if (!s || typeof s[k] !== "string" || !s[k].trim()) out.push(`source ${s && s.id}: no ${k}`);
  if (!s || !/^https:\/\/[^\s]+$/.test(s.url || "")) out.push(`source ${s && s.id}: url must be https`);
  if (!s || !DATE.test(s.date || "")) out.push(`source ${s && s.id}: date must be YYYY, YYYY-MM or YYYY-MM-DD`);
  if (!s || !SOURCE_KINDS.includes(s.kind)) out.push(`source ${s && s.id}: kind must be one of ${SOURCE_KINDS.join(", ")}`);
  return out;
}

function attributionProblems(op, ids) {
  const out = [], list = op.attributions || [];
  if (!list.length) out.push("no attribution");
  for (const a of list) {
    if (!ids.has(a.source)) out.push(`attribution cites unknown source ${a.source}`);
    if (!OPERATOR_TYPES.includes(a.operatorType)) out.push(`attribution operatorType "${a.operatorType}"`);
    if (typeof a.says !== "string" || !a.says.trim()) out.push("attribution without the source's words");
    else if (words(a.says) > MAX_QUOTE_WORDS) out.push(`attribution quote over ${MAX_QUOTE_WORDS} words`);
  }
  // The operation's operator type is one a source used, never a stronger or weaker one of our own.
  if (!list.some((a) => a.operatorType === op.operatorType)) out.push("operatorType is not one any attribution states");
  // At least one attribution comes from a source that was read.
  const read = new Set((op.sources || []).filter(sourceRead).map((s) => s.id));
  if (list.length && !list.some((a) => read.has(a.source))) out.push("no attribution from a source that was read");
  return out;
}

function fieldProblems(op, ids) {
  const out = [];
  for (const f of CITED) {
    if (!filled(op[f])) continue;
    const c = (op.cite || {})[f];
    if (!Array.isArray(c) || !c.length) out.push(`${f} has no cited source`);
    else for (const id of c) if (!ids.has(id)) out.push(`${f} cites unknown source ${id}`);
  }
  for (const t of op.techniques || []) if (!TECHNIQUES.includes(t)) out.push(`technique "${t}" is not in the list`);
  for (const l of op.languages || []) if (!/^[a-z]{2,3}$/.test(l)) out.push(`language code "${l}"`);
  const a = op.active || {};
  for (const k of ["from", "to"]) if (a[k] != null && !(Number.isInteger(a[k]) && a[k] >= 1990 && a[k] <= 2100)) out.push(`active.${k} must be a year`);
  if (a.from && a.to && a.from > a.to) out.push("active.from after active.to");
  return out;
}

function indicatorProblems(op, ids) {
  const out = [];
  for (const i of op.indicators || []) {
    const has = (i.domain ? 1 : 0) + (i.x ? 1 : 0);
    if (has !== 1) out.push("an indicator needs exactly one of domain or x");
    if (i.domain && !DOMAIN.test(i.domain)) out.push(`indicator domain "${i.domain}"`);
    if (i.x && !HANDLE.test(i.x)) out.push(`indicator handle "${i.x}"`);
    if (!INDICATOR_KINDS.includes(i.kind)) out.push(`indicator kind "${i.kind}"`);
    if (!ids.has(i.source)) out.push(`indicator cites unknown source ${i.source}`);
  }
  return out;
}

// Every problem with one operation record, as sentences. An empty list means it meets the bar.
export function opProblems(op) {
  if (!op || typeof op !== "object") return ["not an object"];
  const out = [];
  if (!ID.test(op.id || "")) out.push("id must be kebab-case");
  for (const k of ["name", "state", "operator", "narratives"]) if (typeof op[k] !== "string" || !op[k].trim()) out.push(`no ${k}`);
  if (!OPERATOR_TYPES.includes(op.operatorType)) out.push(`operatorType "${op.operatorType}"`);
  const sources = Array.isArray(op.sources) ? op.sources : [];
  if (!sources.length) out.push("no sources");
  for (const s of sources) out.push(...sourceProblems(s));
  const ids = new Set(sources.map((s) => s && s.id));
  if (ids.size !== sources.length) out.push("duplicate source ids");
  out.push(...attributionProblems(op, ids), ...fieldProblems(op, ids), ...indicatorProblems(op, ids));
  return out.map((p) => `${op.id || "?"}: ${p}`);
}
