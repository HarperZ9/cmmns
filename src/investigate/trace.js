// `case trace <claim>`: the origin and drift chain of a claim. Retellings (--retells) link back to
// what they retell; each hop gets a word-level diff and a list of what changed. Independent origins
// are the root plus every claim that corroborates it (--corroborates), counted after collapsing:
//   - claims whose sources share an origin (ten outlets relaying one wire story are one origin),
//   - near-copies of one press line (word 3-shingle similarity at or above the threshold),
//   - self-sourced claims (the subject's own word), which count for nothing.
import { byId } from "./store.js";
import { wordDiff, renderDiff, hopChanges, shingleSimilarity } from "./diff.js";

export const COPY_THRESHOLD = 0.6;

function rootOf(claims, id) {
  const seen = new Set();
  let c = claims.get(id);
  while (c && c.retells && !seen.has(c.id)) { seen.add(c.id); c = claims.get(c.retells); }
  return c;
}

// The claims that share a root with this one, through retellings, in breadth-first order.
function family(data, root) {
  const kids = new Map();
  for (const c of data.claims) for (const p of [c.retells, c.corroborates]) if (p) kids.set(p, [...(kids.get(p) || []), c]);
  const out = [], queue = [{ c: root, depth: 0, via: null }], seen = new Set();
  while (queue.length) {
    const n = queue.shift();
    if (seen.has(n.c.id)) continue;
    seen.add(n.c.id); out.push(n);
    for (const k of kids.get(n.c.id) || []) queue.push({ c: k, depth: n.depth + 1, via: k.retells === n.c.id ? "retells" : "corroborates" });
  }
  return out;
}

const originKey = (sources, c) => c.source.split(",").map((s) => { const r = sources.get(s); return r && r.origin ? `origin:${String(r.origin).toLowerCase()}` : `source:${s}`; });

// Groups the candidate origins, merging shared origins and near-copies. Returns { groups, dropped }.
function collapse(cands, sources, threshold) {
  const groups = [], dropped = [];
  for (const c of cands) {
    if (c.self_sourced) { dropped.push({ claim: c.id, why: "self-sourced: rests on the subject's own word" }); continue; }
    const keys = originKey(sources, c);
    const g = groups.find((x) => x.keys.some((k) => keys.includes(k)) || x.claims.some((o) => shingleSimilarity(o.text, c.text) >= threshold));
    if (g) { g.claims.push(c); g.keys.push(...keys); g.why.push(`${c.id}: ${g.keys.some((k) => keys.includes(k) && k.startsWith("origin:")) ? "same origin as " : "near-copy of "}${g.claims[0].id}`); } else groups.push({ claims: [c], keys: [...keys], why: [] });
  }
  return { groups, dropped };
}

export function traceClaim(data, id, { threshold = COPY_THRESHOLD } = {}) {
  const claims = byId(data.claims), sources = byId(data.sources);
  if (!claims.has(id)) throw new Error(`no claim ${id} in this case`);
  const root = rootOf(claims, id);
  const fam = family(data, root);
  const hops = fam.filter((n) => n.via === "retells").map((n) => {
    const parent = claims.get(n.c.retells), ops = wordDiff(parent.text, n.c.text);
    return { from: parent.id, to: n.c.id, depth: n.depth, diff: renderDiff(ops), changes: hopChanges(ops), similarity: Number(shingleSimilarity(parent.text, n.c.text).toFixed(3)) };
  });
  const cands = fam.filter((n) => n.via !== "retells").map((n) => n.c);
  const { groups, dropped } = collapse(cands, sources, threshold);
  return {
    claim: id, root: root.id, rootText: root.text, rootSource: root.source, members: fam.map((n) => ({ id: n.c.id, depth: n.depth, via: n.via, rung: n.c.rung, source: n.c.source })),
    hops, independentOrigins: groups.length,
    origins: groups.map((g) => ({ claims: g.claims.map((c) => c.id), sources: [...new Set(g.claims.flatMap((c) => c.source.split(",")))], collapsed: g.why })),
    notCounted: dropped,
    doesNotProve: "Counting origins shows how many separate places a claim comes from. It does not show that any of them is right, and two origins can share an unnamed source no one has disclosed.",
  };
}

export function traceLines(t) {
  const L = [`Claim ${t.claim} traces to ${t.root} (source ${t.rootSource}): "${t.rootText}"`, ""];
  if (!t.hops.length) L.push("No retellings are linked to this claim.");
  for (const h of t.hops) {
    const c = h.changes, notes = [];
    if (c.numbers.added.length || c.numbers.removed.length) notes.push(`numbers +${c.numbers.added.join(" ") || "none"} -${c.numbers.removed.join(" ") || "none"}`);
    if (c.names.added.length) notes.push(`names added: ${c.names.added.join(" ")}`);
    if (c.certaintyAdded.length) notes.push(`certainty added: ${c.certaintyAdded.join(" ")}`);
    if (c.hedgesDropped.length) notes.push(`hedges dropped: ${c.hedgesDropped.join(" ")}`);
    if (c.quoteMarksAdded.length) notes.push("quotation marks added");
    L.push(`${h.from} -> ${h.to}: ${h.diff}`, `  ${c.kept} words kept, ${c.added} added, ${c.removed} removed${notes.length ? "; " + notes.join("; ") : ""}`);
  }
  L.push("", `Independent origins: ${t.independentOrigins}`);
  for (const o of t.origins) L.push(`  ${o.claims.join(", ")} (sources ${o.sources.join(", ")})${o.collapsed.length ? ": " + o.collapsed.join("; ") : ""}`);
  for (const d of t.notCounted) L.push(`  not counted: ${d.claim}, ${d.why}`);
  L.push("", `Does not prove: ${t.doesNotProve}`);
  return L.join("\n") + "\n";
}
