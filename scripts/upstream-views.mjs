// The user-visible view of each table, for scripts/upstream-guard.mjs: a map from a stable key (a
// domain, an account, a claim's review URL) to the fields CMMNS shows for it. Comparing views,
// not raw bytes, means a reordered download raises nothing and a changed owner always does.

const domainOf = (k) => String(k).split("|")[0];

// src/ext/owners.json: one row per domain (rows without a domain are keyed by their item).
function owners(t) {
  const m = new Map();
  // Owners are sorted: the SPARQL answer order is arbitrary, so "A; B" and "B; A" are the same owners.
  for (const r of t.rows || []) m.set(r.domain || `item:${r.source}`, { owner: String(r.owner || "").split("; ").sort().join("; "), via: r.via || "owner", name: r.name || "" });
  return m;
}

// src/ext/state.json: a domain or account can be listed once per basis.
function state(t) {
  const m = new Map();
  for (const r of t.rows || []) m.set(`${r.domain || "@" + r.x}|${r.basis}`, { state: r.state || "", basis: r.basis || "", name: r.name || "" });
  return m;
}

// src/ext/sites.json: Wikidata facts per domain, and the size of each fact-check record.
function sites(t) {
  const m = new Map(), f = t.factFields || [];
  for (const [d, v] of Object.entries(t.facts || {})) m.set(d, Object.fromEntries(f.map((k, i) => [k, v[i] == null ? "" : String(v[i])])));
  for (const [d, rec] of Object.entries(t.records || {})) m.set(d, { ...(m.get(d) || {}), reviews: String(rec.n) });
  return m;
}

// src/ext/claims.json (with its parts joined) or a pack's claims: keyed by review URL and claim.
function claims(t) {
  const m = new Map(), who = t.checkers || [];
  for (const r of t.rows || []) m.set(`${r[3]}|${r[0]}`, { rating: r[1], checker: who[r[2]] || String(r[2]) });
  return m;
}

// src/ext/ops.json: one entry per indicator and operation, with the operation's state.
function ops(t) {
  const m = new Map(), byId = new Map((t.ops || []).map((o) => [o.id, o]));
  for (const i of t.indicators || []) { const o = byId.get(i.op) || {}; m.set(`${i.d || "@" + i.x}|${i.op}`, { kind: i.kind, state: o.state || "", operator: o.operator || "" }); }
  return m;
}

// confusables.txt: source code point to target sequence.
function confusables(txt) {
  const m = new Map();
  for (const line of String(txt).split(/\r?\n/)) { const x = line.match(/^([0-9A-F]+)\s*;\s*([0-9A-F ]+?)\s*;/); if (x) m.set(x[1], { target: x[2] }); }
  return m;
}

export const VIEWS = { owners, state, sites, claims, ops, confusables };
// Fields whose change on a high-reach site is flagged, per view.
export const LABEL_FIELDS = { owners: ["owner", "via"], state: ["state", "basis"], sites: ["country", "ownerType", "wikidata"], ops: ["state", "operator"], claims: ["rating"], confusables: ["target"] };
export { domainOf };

// Which view a parsed file is, from its shape.
export function detectKind(data) {
  if (typeof data === "string") return "confusables";
  if (data && data.factFields) return "sites";
  if (data && data.indicators) return "ops";
  if (data && Array.isArray(data.rows) && Array.isArray(data.rows[0])) return "claims";
  if (data && Array.isArray(data.rows) && data.rows.some((r) => "basis" in r)) return "state";
  if (data && Array.isArray(data.rows)) return "owners";
  throw new Error("cannot tell which table this is; pass --kind");
}
