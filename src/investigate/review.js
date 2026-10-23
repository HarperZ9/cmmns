// `case review`: the queue of everything a machine step proposed (claims, leads, record queries,
// transcriptions, summaries), each with the source span it came from. One key accepts or rejects
// an item; the dossier then names who accepted it. Claims keep the review state in "status";
// other rows keep it in "review" or "status" as they were written.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { within } from "./paths.js";
import { updateRow, byId } from "./store.js";

const FIELD = { claims: "status", leads: "review", proposals: "status" };

export function pending(data) {
  const out = [];
  for (const [table, field] of Object.entries(FIELD)) for (const r of data[table]) if (r[field] === "proposed") out.push({ table, field, row: r });
  return out;
}

// The text shown for one queue item: what was proposed, by what, and the span it came from.
export function describe(data, item) {
  const r = item.row, sources = byId(data.sources);
  const head = item.table === "claims" ? `Claim ${r.id} (from ${r.source}, proposed by ${r.proposed_by}): ${r.text}`
    : item.table === "leads" ? `Lead ${r.id}: ${r.question} Record: ${r.record}; held by ${r.holder}${r.check_url ? `; search ${r.check_url}` : ""}`
      : `${r.kind} ${r.id}${r.claim ? ` for ${r.claim}` : ""}${r.source ? ` (${r.source})` : ""}: ${r.text || r.record || r.note || ""}${r.query ? ` [query: ${r.query}]` : ""}`;
  const span = (r.spans || [])[0];
  let ctxLine = "";
  if (span) {
    const s = sources.get(span.source), f = s && s.capture && s.capture.text_file ? within(data.dir, s.capture.text_file) : null;
    const t = f && existsSync(f) ? readFileSync(f, "utf8") : "";
    const a = Math.max(0, span.start - 120), b = Math.min(t.length, span.end + 120);
    ctxLine = t ? `\n  In ${span.source}: ...${t.slice(a, span.start)}>>${t.slice(span.start, span.end)}<<${t.slice(span.end, b)}...` : `\n  Span: "${span.text}"`;
  }
  return head + ctxLine.replace(/\s*\n(?!  )/g, " ");
}

export function decide(dir, item, verdict, by, now) {
  if (!["accepted", "rejected"].includes(verdict)) throw new Error("a review verdict is accepted or rejected");
  return updateRow(dir, item.table, item.row.id, (r) => ({ ...r, [item.field]: verdict, [verdict === "accepted" ? "accepted_by" : "rejected_by"]: by, reviewed_at: now }));
}

// Non-interactive: ids to accept and to reject. Returns the rows changed.
export function decideIds(dir, data, { accept = [], reject = [] }, by, now) {
  const q = pending(data), out = [];
  for (const [ids, v] of [[accept, "accepted"], [reject, "rejected"]]) for (const id of ids) {
    const it = q.find((x) => x.row.id === id);
    if (!it) throw new Error(`${id} is not waiting for review`);
    out.push(decide(dir, it, v, by, now));
  }
  return out;
}
