// `case network`: who amplifies whom. Each edge is one public act (quote, reply, repost, mention or
// link) with the source that records it. Exports as JSON and as a small offline HTML page with an
// inline SVG graph: no script from anywhere else, no network.
import { byId } from "./store.js";

export const EDGE_TYPES = ["quote", "reply", "repost", "mention", "link"];

export function checkEdge(e, sources) {
  if (!e.from || !e.to) return "an edge needs --from and --to";
  if (!EDGE_TYPES.includes(e.type)) return `--type must be one of ${EDGE_TYPES.join(", ")}`;
  if (!e.source || !sources.has(e.source)) return "an edge needs --source <source id> that is in this case";
  return null;
}

export function buildNetwork(data) {
  const edges = data.edges.filter((e) => e.from && e.to && e.status !== "rejected");
  const nodes = new Map();
  for (const e of edges) for (const [n, dir] of [[e.from, "out"], [e.to, "in"]]) {
    const x = nodes.get(n) || { id: n, in: 0, out: 0 };
    x[dir]++; nodes.set(n, x);
  }
  const pairs = new Map();
  for (const e of edges) { const k = `${e.from}\u0000${e.to}\u0000${e.type}`; const p = pairs.get(k) || { from: e.from, to: e.to, type: e.type, n: 0, edges: [], sources: [] }; p.n++; p.edges.push(e.id); if (!p.sources.includes(e.source)) p.sources.push(e.source); pairs.set(k, p); }
  const list = [...nodes.values()].sort((a, b) => b.in + b.out - (a.in + a.out) || (a.id < b.id ? -1 : 1));
  const mutual = [...pairs.values()].filter((p) => [...pairs.values()].some((q) => q.from === p.to && q.to === p.from) && p.from < p.to).map((p) => [p.from, p.to]);
  return { format: "daylight-case-network/1", nodes: list, edges: [...pairs.values()], mutual,
    doesNotProve: "An edge shows one public act recorded in a source. It does not show agreement, private contact or coordination." };
}

export function networkLines(n) {
  const L = [`${n.nodes.length} accounts, ${n.edges.reduce((s, e) => s + e.n, 0)} recorded acts.`, ""];
  for (const e of n.edges) L.push(`${e.from} -> ${e.to}  ${e.type} x${e.n}  [${e.sources.join(", ")}]`);
  if (n.mutual.length) L.push("", "Amplify each other: " + n.mutual.map((m) => m.join(" <-> ")).join("; "));
  L.push("", `Does not prove: ${n.doesNotProve}`);
  return L.join("\n") + "\n";
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c]);
const DASH = { quote: "", reply: "4 3", repost: "1 3", mention: "8 3 1 3", link: "2 2" };

// The graph on a circle: nodes by degree, edges as arrows, each with its type and sources in a title.
export function networkHtml(n, title = "Case network") {
  const W = 720, H = 720, cx = W / 2, cy = H / 2, R = 280;
  const pos = new Map(n.nodes.map((x, i) => { const a = (2 * Math.PI * i) / Math.max(1, n.nodes.length) - Math.PI / 2; return [x.id, { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) }]; }));
  const lines = n.edges.map((e) => {
    const a = pos.get(e.from), b = pos.get(e.to);
    if (!a || !b) return "";
    return `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke-width="${Math.min(6, 1 + Math.log2(e.n))}" stroke-dasharray="${DASH[e.type] || ""}" marker-end="url(#arrow)"><title>${esc(`${e.from} -> ${e.to}: ${e.type} x${e.n} (${e.sources.join(", ")})`)}</title></line>`;
  }).join("\n");
  const dots = n.nodes.map((x) => { const p = pos.get(x.id), r = 4 + Math.min(14, 2 * Math.sqrt(x.in + x.out)); return `<g><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r.toFixed(1)}"><title>${esc(`${x.id}: ${x.in} in, ${x.out} out`)}</title></circle><text x="${p.x.toFixed(1)}" y="${(p.y - r - 4).toFixed(1)}" text-anchor="middle">${esc(x.id)}</text></g>`; }).join("\n");
  const rows = n.edges.map((e) => `<tr><td>${esc(e.from)}</td><td>${esc(e.to)}</td><td>${esc(e.type)}</td><td>${e.n}</td><td>${esc(e.sources.join(", "))}</td></tr>`).join("\n");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>:root{--ink:#1b1b1b;--soft:#5d5d5d;--ground:#fbfaf7;--line:#d9d6cf}@media (prefers-color-scheme:dark){:root{--ink:#ecebe7;--soft:#a5a39d;--ground:#151514;--line:#3a3936}}
body{margin:0;padding:16px;background:var(--ground);color:var(--ink);font:15px/1.5 system-ui,sans-serif}svg{max-width:100%;height:auto}line{stroke:var(--soft)}circle{fill:var(--ink)}text{fill:var(--ink);font-size:11px}
#arrow path{fill:var(--soft)}table{border-collapse:collapse;width:100%;font-size:13px}td,th{border-top:1px solid var(--line);padding:4px 6px;text-align:left}.muted{color:var(--soft)}</style></head>
<body><h1>${esc(title)}</h1><p class="muted">Each line is one recorded public act. Solid: quote. Dashed: reply. Dotted: repost. Hover a line for its sources. This file works offline.</p>
<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}"><defs><marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z"/></marker></defs>
${lines}
${dots}
</svg>
<table><thead><tr><th>From</th><th>To</th><th>Act</th><th>Count</th><th>Sources</th></tr></thead><tbody>
${rows}
</tbody></table><p class="muted">Does not prove: ${esc(n.doesNotProve)}</p></body></html>
`;
}
