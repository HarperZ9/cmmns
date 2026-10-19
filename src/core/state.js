// State links: link domains and accounts tied to a government, from two sourced lists.
//   state-owned       the outlet's ownership chain on Wikidata ends at a government or state body
//   named-in-report   a platform or government report named the domain or account in an influence
//                     operation it took down or attributed (each row cites the report)
// The same rule applies to every country. Radar does not attribute a reply, an account or a
// narrative to a state from what it says or how it behaves: that would be a guess presented as a
// finding. It shows a link or an account that a cited source ties to a state, and nothing more.

let ROWS = [];
const byDomain = new Map(), byHandle = new Map();

// rows: [{ domain?, x?, state, basis: "state-owned" | "named-in-report", name, source: { title, url, date } }]
export function setStateRows(rows) {
  ROWS = Array.isArray(rows) ? rows : [];
  byDomain.clear(); byHandle.clear();
  for (const r of ROWS) {
    if (r.domain) (byDomain.get(r.domain.toLowerCase()) || byDomain.set(r.domain.toLowerCase(), []).get(r.domain.toLowerCase())).push(r);
    if (r.x) (byHandle.get(r.x.toLowerCase()) || byHandle.set(r.x.toLowerCase(), []).get(r.x.toLowerCase())).push(r);
  }
}

// Subdomains match their parent: "de.rt.com" finds "rt.com".
export function stateLinksOfDomain(domain) {
  const parts = String(domain || "").toLowerCase().replace(/^www\./, "").split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    const hit = byDomain.get(parts.slice(i).join("."));
    if (hit) return hit;
  }
  return [];
}

export function stateLinksOfHandle(handle) { return byHandle.get(String(handle || "").toLowerCase()) || []; }

// Thread summary: links and accounts per state and basis, so the panel can say "3 replies link to
// outlets owned by the government of X" without ranking states.
export function stateSummary(items) {
  const out = new Map();
  for (const it of items) {
    const hits = [...(it.domains || []).flatMap(stateLinksOfDomain), ...stateLinksOfHandle(it.author)];
    for (const h of new Set(hits)) {
      const k = h.state + "|" + h.basis;
      const e = out.get(k) || { state: h.state, basis: h.basis, replies: new Set(), names: new Set() };
      e.replies.add(it.id); e.names.add(h.name);
      out.set(k, e);
    }
  }
  return [...out.values()].map((e) => ({ state: e.state, basis: e.basis, replies: e.replies.size, names: [...e.names] })).sort((a, b) => b.replies - a.replies || a.state.localeCompare(b.state));
}

export const STATE_DOES_NOT_PROVE = {
  "state-owned": "State ownership is not proof of disinformation. Public broadcasters with editorial independence are state-owned too, and Wikidata can lag a sale.",
  "named-in-report": "The report named this domain or account in an operation at the time it was published. Domains change hands, and accounts can be reused or impersonated.",
};
