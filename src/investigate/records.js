// `case leads` and `case absent`. A lead names the record that would settle an open question, who
// holds it, and how to reach it; leads rank by how decisive that record would be. The absence log
// keeps deleted, edited, sealed, withheld and missing records with their custodians: what is not
// there is data, and it is never filled in by inference.
import { byId } from "./store.js";

export const ACCESS = { public: 1, request: 0.8, unknown: 0.7, legal: 0.5 };
export const ABSENCE = ["deleted", "edited", "sealed", "withheld", "missing"];
const OPEN = new Set(["unproven", "inference"]);

export function checkLead(l, claims) {
  if (!l.question || !String(l.question).trim()) return "a lead needs its question";
  if (!l.record) return "a lead needs --record: the record that would settle it";
  const d = Number(l.decisive);
  if (!Number.isInteger(d) || d < 1 || d > 5) return "--decisive must be 1 to 5 (5: the record alone settles the question)";
  if (!(l.access in ACCESS)) return `--access must be one of ${Object.keys(ACCESS).join(", ")}`;
  for (const c of l.claims || []) if (!claims.has(c)) return `no claim ${c} in this case`;
  return null;
}

// Score: decisiveness, raised by each open claim the record would settle, lowered by how hard the
// record is to reach. Settled and dead leads score 0 and sort last.
export function leadScore(l, claims) {
  if (l.status && l.status !== "open") return 0;
  const open = (l.claims || []).filter((c) => claims.has(c) && OPEN.has(claims.get(c).rung)).length;
  return Number((Number(l.decisive) * (1 + 0.5 * open) * (ACCESS[l.access] ?? ACCESS.unknown)).toFixed(2));
}

export function rankLeads(data) {
  const claims = byId(data.claims);
  return data.leads.filter((l) => l.status !== "rejected" && l.review !== "rejected").map((l) => ({ ...l, score: leadScore(l, claims) })).sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
}

export function leadLines(list) {
  if (!list.length) return "No leads recorded.\n";
  return list.map((l, i) => `${i + 1}. ${l.id} [score ${l.score}${l.status && l.status !== "open" ? ", " + l.status : ""}${l.proposed_by ? ", proposed" : ""}] ${l.question}\n   Record: ${l.record}\n   Held by: ${l.holder || "unknown"}; reach: ${l.access}${l.path ? ` (${l.path})` : ""}${(l.claims || []).length ? `\n   Settles: ${l.claims.join(", ")}` : ""}${l.result ? `\n   Result: ${l.result}` : ""}`).join("\n") + "\n";
}

export function checkAbsence(a, sources) {
  if (!a.what || !String(a.what).trim()) return "an absence needs a description of what is missing";
  if (!ABSENCE.includes(a.status)) return `--status must be one of ${ABSENCE.join(", ")}`;
  if (a.source && !sources.has(a.source)) return `no source ${a.source} in this case`;
  return null;
}

export function absentLines(rows) {
  if (!rows.length) return "No absences recorded.\n";
  const by = (s) => rows.filter((r) => r.status === s && r.state !== "rejected");
  const L = [];
  for (const s of ABSENCE) for (const r of by(s)) L.push(`${r.id} ${s.toUpperCase()}: ${r.what}. Custodian: ${r.custodian || "unknown"}${r.source ? `. Seen in ${r.source}` : ""}${r.note ? `. ${r.note}` : ""}`);
  L.push("", "Absence is recorded as found. A missing record proves nothing about what it would have said.");
  return L.join("\n") + "\n";
}
