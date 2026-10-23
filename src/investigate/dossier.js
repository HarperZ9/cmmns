// The newsroom dossier: claims first, each with its evidence inline (sources, capture hashes,
// archive copies, origin count and drift), then the timeline, network, leads, absences and the
// reading. Who accepted each item is stated: a person, or nobody yet (proposed by rules or a model).
import { byId } from "./store.js";
import { traceClaim } from "./trace.js";
import { buildTimeline } from "./timeline.js";
import { buildNetwork } from "./network.js";
import { rankLeads } from "./records.js";

const RUNG_ORDER = ["documented", "contradicted", "inference", "unproven"];
const RUNG_WORDS = { documented: "Documented", inference: "Inference", unproven: "Unproven, investigation open", contradicted: "Contradicted by the record" };

export const reviewState = (row) => (row.status === "proposed" || row.review === "proposed" ? `Proposed by ${row.proposed_by || "a machine step"}, not yet reviewed` : row.accepted_by ? `Accepted by ${row.accepted_by}` : "Entered by a person");

export function sourceLine(s) {
  if (!s) return "(source missing)";
  const arch = s.archive && s.archive.url ? `archived ${s.archive.url}` : `no archive copy${s.archive && s.archive.error ? ` (${s.archive.error})` : s.archive && s.archive.note ? ` (${s.archive.note})` : ""}`;
  const what = [s.title || s.what || s.kind, s.author].filter(Boolean).join(", ");
  return `${s.id}: ${what}. ${s.url || s.file || ""}${s.source_date ? `. Published ${s.source_date}` : ""}. Read ${s.accessed || "unknown"}, ${s.read_mode || "mode not recorded"}. sha256 ${s.capture && s.capture.sha256 ? s.capture.sha256 : "not recorded"}; ${arch}.`;
}

function claimBlock(c, data, sources) {
  const L = [`### ${c.id}. ${c.text}`, "", `- Rung: **${RUNG_WORDS[c.rung] || c.rung}**. ${reviewState(c)}.`];
  if (c.self_sourced) L.push("- Self-sourced: it rests on the subject's own word, so it counts for nothing as corroboration.");
  for (const sp of (c.spans || []).slice(0, 3)) L.push(`- In ${sp.source}: "${String(sp.text).slice(0, 280)}"`);
  for (const id of c.source.split(",")) L.push(`- ${sourceLine(sources.get(id))}`);
  const t = traceClaim(data, c.id);
  if (t.members.length > 1 || t.independentOrigins !== 1) L.push(`- Origins: ${t.independentOrigins} independent (${t.origins.map((o) => o.claims.join("+")).join("; ")})${t.notCounted.length ? `; not counted: ${t.notCounted.map((d) => d.claim).join(", ")}` : ""}.`);
  for (const h of t.hops.filter((h) => h.to === c.id)) L.push(`- Retells ${h.from}: ${h.diff}`);
  L.push("");
  return L.join("\n");
}

function claimsSection(data, sources) {
  const live = data.claims.filter((c) => c.status !== "rejected");
  const reviewed = live.filter((c) => c.status !== "proposed"), proposed = live.filter((c) => c.status === "proposed");
  const sorted = (list) => [...list].sort((a, b) => RUNG_ORDER.indexOf(a.rung) - RUNG_ORDER.indexOf(b.rung) || (a.id < b.id ? -1 : 1));
  const L = ["## Claims", ""];
  if (!live.length) L.push("No claims recorded yet.", "");
  L.push(...sorted(reviewed).map((c) => claimBlock(c, data, sources)));
  if (proposed.length) L.push("## Proposed claims, not yet reviewed by a person", "", "A machine step proposed these. Each quotes the text it came from. Run `daylight case review` to accept or reject them.", "", ...sorted(proposed).map((c) => claimBlock(c, data, sources)));
  return L.join("\n");
}

function restSections(data, extra) {
  const t = buildTimeline(data), n = buildNetwork(data), leads = rankLeads(data);
  const L = ["## Timeline", ""];
  for (const e of t.events) L.push(`- ${e.when.length > 10 ? e.when.slice(0, 16).replace("T", " ") : e.day}: ${e.text} (${e.source || e.id})`);
  if (t.flags.length) L.push("", "Flags:", ...t.flags.map((f) => `- ${f.kind}: ${f.text}`));
  L.push("", "## Network", "", `${n.nodes.length} accounts, ${n.edges.reduce((s, e) => s + e.n, 0)} recorded acts. The graph is in network.html.`, "");
  for (const e of n.edges) L.push(`- ${e.from} to ${e.to}: ${e.type} x${e.n} (${e.sources.join(", ")})`);
  L.push("", "## Open leads, most decisive first", "");
  leads.forEach((l, i) => L.push(`${i + 1}. ${l.question} Record: ${l.record}. Held by ${l.holder || "unknown"}; reach: ${l.access}. Score ${l.score}. ${reviewState(l)}.`));
  if (!leads.length) L.push("None recorded.");
  L.push("", "## Missing, deleted, edited and sealed records", "");
  for (const a of data.absent.filter((x) => x.state !== "rejected")) L.push(`- ${a.status}: ${a.what}. Custodian: ${a.custodian || "unknown"}${a.source ? ` (${a.source})` : ""}.`);
  if (!data.absent.length) L.push("None recorded.");
  if (extra.reading) {
    L.push("", "## Reading lens", "");
    const parts = (r) => [...(r.lens || []).map((f) => `${f.name} ("${f.match}")${f.shownByDefault ? "" : ", below its precision bar"}`), ...r.items.map((i) => `${i.label}${i.spans.length ? ` ("${i.spans[0]}")` : ""}`)];
    const named = extra.reading.rows.filter((x) => x.read && parts(x).length);
    for (const r of named) L.push(`- ${r.source}: ${parts(r).join("; ")}`);
    if (!named.length) L.push("The lens named no technique and no known fact-checked claim in the captured text.");
    else L.push("", "A named technique describes how a text argues. It is a reason to read the span, not a finding about the source.");
  }
  if (extra.summary) L.push("", "## Summary", "", `${extra.summary.text}`, "", `(${reviewState(extra.summary)}.)`);
  return L.join("\n");
}

export function newsroomMarkdown(data, extra = {}) {
  const sources = byId(data.sources);
  const people = data.claims.filter((c) => c.status !== "proposed" && c.status !== "rejected").length, machine = data.claims.filter((c) => c.status === "proposed").length;
  return [`# ${data.meta.name}`, "", `Dossier generated ${extra.at}. ${data.sources.length} sources, ${people} reviewed claims, ${machine} proposed claims.`, "",
    "Rungs: documented (the record shows it), inference (stated as inference, with its evidence), unproven (investigation open), contradicted (the record contradicts it). Accounts not marked as public figures appear as pseudonyms.", "",
    claimsSection(data, sources), restSections(data, extra), "", "## Sources", "", ...data.sources.map((s) => `- ${sourceLine(s)}`), "",
    "Does not prove: this dossier shows what the captured sources say and how the claims were sorted. A capture hash shows the file is unchanged since capture. Neither shows that a source told the truth.", ""].join("\n");
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[c]);

// A plain HTML view of the Markdown: headings, list items and paragraphs, nothing fetched.
export function markdownHtml(md, title) {
  const body = md.split("\n").map((l) => {
    const h = l.match(/^(#{1,3}) (.*)$/);
    if (h) return `<h${h[1].length}>${esc(h[2])}</h${h[1].length}>`;
    if (/^(- |\d+\. )/.test(l)) return `<p class="li">${esc(l).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</p>`;
    return l.trim() ? `<p>${esc(l).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</p>` : "";
  }).join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>:root{--ink:#1b1b1b;--ground:#fbfaf7;--soft:#5d5d5d}@media (prefers-color-scheme:dark){:root{--ink:#ecebe7;--ground:#151514;--soft:#a5a39d}}body{margin:0 auto;max-width:46rem;padding:16px;background:var(--ground);color:var(--ink);font:16px/1.55 system-ui,sans-serif;overflow-wrap:anywhere}.li{margin:.2rem 0 .2rem 1rem}</style></head><body>\n${body}\n</body></html>\n`;
}
