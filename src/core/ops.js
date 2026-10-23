// Documented influence operations (ops.json, built by scripts/ops-build.mjs): the matcher behind
// "Named in a published report", and the counts behind the trend view. A link or an account
// matches when a cited source named that exact domain (or a parent of it) or account as an
// operation's asset. The sign is about the indicator, never about the person who posted or shared
// it: people share operation sites without knowing, and often to warn others.

let TABLE = { docs: [], ops: [], indicators: [] };
const OPS = new Map(), BY_DOMAIN = new Map(), BY_HANDLE = new Map();
const push = (m, k, v) => (m.get(k) || m.set(k, []).get(k)).push(v);

// table: { docs, ops, indicators } as ops.json has it, or a part of it from the background worker.
export function setOpsTable(table) {
  TABLE = { docs: (table && table.docs) || [], ops: (table && table.ops) || [], indicators: (table && table.indicators) || [] };
  OPS.clear(); BY_DOMAIN.clear(); BY_HANDLE.clear();
  for (const o of TABLE.ops) OPS.set(o.id, o);
  for (const i of TABLE.indicators) {
    if (!OPS.has(i.op)) continue;
    if (i.d) push(BY_DOMAIN, i.d, i);
    if (i.x) push(BY_HANDLE, i.x, i);
  }
}

const hit = (i) => ({ op: OPS.get(i.op), indicator: i, doc: TABLE.docs[i.doc] || null });
// Subdomains match their parent: "de.rrn.world" finds "rrn.world".
export function opsOfDomain(domain) {
  const parts = String(domain || "").toLowerCase().replace(/^www\./, "").split(".");
  for (let k = 0; k < parts.length - 1; k++) {
    const got = BY_DOMAIN.get(parts.slice(k).join("."));
    if (got) return got.map(hit);
  }
  return [];
}
export const opsOfHandle = (h) => (BY_HANDLE.get(String(h || "").replace(/^@/, "").toLowerCase()) || []).map(hit);

// The part of a full table that a page needs for these domains and handles (the worker answers
// with this, so pages never load the whole table).
export function opsLookup(table, { domains = [], handles = [] } = {}) {
  const want = domains.map((d) => String(d).toLowerCase().replace(/^www\./, "")), hs = new Set(handles.map((h) => String(h).toLowerCase()));
  const indicators = table.indicators.filter((i) => (i.x && hs.has(i.x)) || (i.d && want.some((d) => d === i.d || d.endsWith("." + i.d))));
  const ids = new Set(indicators.map((i) => i.op));
  return { docs: table.docs, ops: table.ops.filter((o) => ids.has(o.id)), indicators };
}

// The domains and accounts a profile names: its website, and domains and @handles in its bio.
const HOST = /(?<![\w@.-])((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24})(?![\w.-]*\w)/gi, AT = /(?:^|[^\w@])@(\w{1,15})(?!\w)/g;
export function profileLinks(reading) {
  const r = reading || {}, domains = new Set(), handles = new Set();
  try { if (r.website) domains.add(new URL(/^https?:/i.test(r.website) ? r.website : "https://" + r.website).hostname.replace(/^www\./, "").toLowerCase()); } catch { /* not an address */ }
  for (const m of String(r.bio || "").matchAll(HOST)) if (/[a-z]/i.test(m[1].split(".").pop())) domains.add(m[1].toLowerCase().replace(/^www\./, ""));
  for (const m of String(r.bio || "").matchAll(AT)) handles.add(m[1].toLowerCase());
  return { domains: [...domains], handles: [...handles] };
}

const TYPE_WORDS = {
  "government": "a government body", "state media": "state media", "contractor": "a firm or group working for a government",
  "linked to a state": "people or a group the source links to a government", "commercial firm": "a firm, no government named", "origin only": "no operator named",
};
export const OPS_DOES_NOT_PROVE = "The report named this domain or account as part of an operation when it was published. People share these links unknowingly or to warn others. Domains expire and are bought again, and accounts are reused.";

// The window's rows for one hit, in the sources' own words. Every attribution is listed with its
// document, so disagreements between sources stay visible.
export function opRows(h) {
  const o = h.op, doc = h.doc || {};
  const said = o.attributions.map((a) => { const d = TABLE.docs[a.doc] || {}; return `${d.publisher || d.title}${d.date ? ` (${d.date})` : ""}: "${a.says}"`; });
  return [
    ["Operation", `${o.name}${o.aliases && o.aliases.length ? ` (also: ${o.aliases.slice(0, 3).join(", ")})` : ""}`],
    ["Attributed to", `${o.state}: ${o.operator}. Operator type: ${TYPE_WORDS[o.operatorType] || o.operatorType}.`],
    ["Sources say", said.slice(0, 4).join(" ")],
    ["Named as", `${h.indicator.kind} in ${doc.title || "the report"}${doc.date ? `, ${doc.date}` : ""}`],
    ["Read it", { links: [[String(doc.url || "").replace(/^https?:\/\//, "").slice(0, 48), doc.url]] }],
    ["Read it as", OPS_DOES_NOT_PROVE],
  ];
}

// Counts for the trend view. Year is the year an operation was first published by any cited source.
// It counts what investigators found and published, not how much activity there was.
export const OPS_TREND_CAVEAT = "These are operations that investigators found and published, counted by the year of the first report. The counts follow where people looked: platforms look harder in some places and languages than others, and some governments publish takedowns while others keep them quiet.";
export function opsTrend(table = TABLE) {
  const years = new Map(), states = new Map();
  // Operations from data packs (src/core/packs-content.js) are shown on matches but never counted here.
  const own = table.ops.filter((o) => !o.pack);
  for (const o of own) {
    const y = Number(String(o.first).slice(0, 4));
    const ye = years.get(y) || years.set(y, { year: y, n: 0, byState: {} }).get(y);
    ye.n++; ye.byState[o.state] = (ye.byState[o.state] || 0) + 1;
    const se = states.get(o.state) || states.set(o.state, { state: o.state, n: 0, byType: {}, docs: new Set() }).get(o.state);
    se.n++; se.byType[o.operatorType] = (se.byType[o.operatorType] || 0) + 1;
    for (const d of o.docs) se.docs.add(d);
  }
  return {
    total: own.length,
    byYear: [...years.values()].sort((a, b) => a.year - b.year),
    byState: [...states.values()].map((s) => ({ ...s, docs: s.docs.size })).sort((a, b) => b.n - a.n || a.state.localeCompare(b.state)),
  };
}
