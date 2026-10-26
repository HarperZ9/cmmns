// A study board (refdb.board/1) as one HTML page: book spreads, a grid, a timeline, or an evidence
// board of sheets. The page stands alone, needs no script, and prints to A4 pages. House type:
// Accession Stencil for running heads and titles, Hanken Grotesk
// for captions and text, JetBrains Mono for numbers. Ink on paper; the one hot mark is the right-hand
// running head. In the evidence board each claim is a sheet over its sources, opacity from reach.

import { bookPages, timelineRows, evidencePlan, plateCaption } from "./board.js";

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const num = (n) => `( ${n} )`;
// Where a plate's media is, from the page: plates/<file name> unless the caller maps it (blob URLs).
const defaultUrl = (m) => `plates/${encodeURIComponent(String(m.path || m.id).split(/[\\/]/).pop())}`;

const HEADS = { grotesk: "var(--sans)", accession: "\"Accession Stencil\", var(--mono)", mono: "var(--mono)" };
const CSS = (fonts, head) => `${head === "accession" ? `@font-face { font-family: "Accession Stencil"; src: url("${fonts}AccessionStencil.woff2") format("woff2"); font-weight: 300 900; }
` : ""}@font-face { font-family: "Hanken Grotesk"; src: url("${fonts}hanken-grotesk.woff2") format("woff2"); font-weight: 100 900; }
@font-face { font-family: "JetBrains Mono"; src: url("${fonts}jetbrains-mono-regular.woff2") format("woff2"); }
:root { --paper: #ebe5d8; --ink: #16130f; --soft: #4a443b; --rule: #c9bfab; --hot: #8f3a19; --ground: #d8cfbc;
  --sans: "Hanken Grotesk", "Segoe UI", sans-serif; --mono: "JetBrains Mono", Consolas, monospace; --head: ${HEADS[head] || HEADS.grotesk}; }
* { box-sizing: border-box; }
html { background: var(--ground); color: var(--ink); font: 400 15px/1.5 var(--sans); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; padding: 32px 16px 64px; }
a { color: inherit; text-decoration-color: var(--rule); }
.spread { display: flex; justify-content: center; margin: 0 auto 32px; max-width: 1240px; }
.page { position: relative; width: min(50%, 620px); aspect-ratio: 210 / 297; background: var(--paper); padding: 7% 9% 8%; display: flex; flex-direction: column; overflow: hidden; }
.page + .page { border-left: 1px solid var(--rule); }
.head { font: 500 11px/1 var(--head); letter-spacing: .14em; text-transform: uppercase; }
.right .head { text-align: right; color: var(--hot); }
.plate { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 0; }
.plate img, .plate video { max-width: 78%; max-height: 62%; object-fit: contain; display: block; }
.plate .text { max-width: 80%; max-height: 62%; overflow: hidden; font: 400 17px/1.5 var(--sans); white-space: pre-line; }
.n { margin-top: 16px; font: 400 11px/1 var(--mono); letter-spacing: .06em; }
.cap { margin-top: 10px; max-width: 80%; text-align: center; font-size: 11px; line-height: 1.45; color: var(--soft); overflow-wrap: anywhere; }
.cap .own { color: var(--ink); }
.foot { display: flex; justify-content: space-between; font: 400 10px/1.2 var(--mono); letter-spacing: .08em; text-transform: uppercase; }
.cover { justify-content: space-between; }
.cover h1 { font: 600 clamp(28px, 6vw, 64px)/1.02 var(--head); letter-spacing: .02em; text-transform: uppercase; margin: 0; }
.cover .meta { font: 400 11px/1.6 var(--mono); letter-spacing: .08em; text-transform: uppercase; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 24px; max-width: 1240px; margin: 0 auto; }
.card { margin: 0; background: var(--paper); padding: 16px; display: flex; flex-direction: column; }
.card img, .card video { width: 100%; aspect-ratio: 1; object-fit: contain; }
.card .text { font-size: 14px; white-space: pre-line; max-height: 240px; overflow: hidden; }
.card .cap, .row .cap, .layer .cap { text-align: left; max-width: none; }
.card .cap .line { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.sheet { max-width: 960px; margin: 0 auto; background: var(--paper); padding: 48px; }
.sheet h1 { font: 600 32px/1.1 var(--head); text-transform: uppercase; margin: 6px 0 4px; }
.row { display: grid; grid-template-columns: 150px 140px 1fr; gap: 20px; padding: 18px 0; border-top: 1px solid var(--rule); align-items: start; }
.row img, .row video { width: 140px; height: 140px; object-fit: contain; }
.row .text { font-size: 13px; white-space: pre-line; max-height: 140px; overflow: hidden; }
.when { font: 400 11px/1.5 var(--mono); }
.gap { padding: 10px 0; border-top: 1px dashed var(--soft); font: 400 11px/1 var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--soft); }
.hash { font: 400 10px/1.4 var(--mono); color: var(--soft); overflow-wrap: anywhere; }
.rung { font: 400 10px/1 var(--mono); text-transform: uppercase; letter-spacing: .08em; }
.claim { padding: 28px 0; border-top: 1px solid var(--rule); }
.claim > p { margin: 6px 0 14px; font-size: 18px; line-height: 1.35; }
.stack { position: relative; display: grid; gap: 0; }
.layer { position: relative; display: grid; grid-template-columns: 140px 1fr; gap: 16px; padding: 12px; background: var(--paper); border: 1px solid var(--ink); margin-top: -36px; transition: opacity .2s; }
.layer:first-child { margin-top: 0; }
.layer:hover, .layer:focus-within { opacity: 1 !important; z-index: 9 !important; }
.prov { font: 500 12px/1.4 var(--mono); margin-top: 6px; }
.layer img, .layer video { width: 140px; height: 140px; object-fit: contain; }
@page { size: A4; margin: 0; }
@media print {
  html, body { background: none; padding: 0; }
  .spread { display: block; margin: 0; max-width: none; }
  .page { width: 210mm; height: 297mm; aspect-ratio: auto; break-after: page; border: 0 !important; }
  .grid, .sheet { max-width: none; }
  .card, .row, .layer { break-inside: avoid; }
}
@media (prefers-reduced-motion: reduce) { .layer { transition: none; } }
@media (max-width: 720px) { .spread { flex-direction: column; align-items: center; } .page { width: 100%; } .page + .page { border-left: 0; border-top: 1px solid var(--rule); } .row, .layer { grid-template-columns: 1fr; } }`;

function media(p, url) {
  const m = (p.media || [])[0], c = plateCaption(p);
  if (!m || m.kind === "text") {
    const words = (p.source && (p.source.text || p.source.title)) || (p.parts ? p.parts.join("\n") : "") || p.caption || "";
    return `<div class="text">${esc(words)}</div>`;
  }
  const u = esc(url(m, p));
  if (m.kind === "motion" && !/\.gif(?:$|[?#])/i.test(m.path || "")) return `<video src="${u}" muted loop playsinline autoplay aria-label="${esc(c.line)}"></video>`;
  if (m.kind === "audio") return `<audio src="${u}" controls></audio>`;
  return `<img src="${u}" alt="${esc((p.source && p.source.alt) || c.line)}" loading="lazy">`;
}

function caption(p) {
  const c = plateCaption(p), s = p.source || {};
  const textPlate = !(p.media || []).length;
  const line = !textPlate && c.line ? `<br><span class="line">${esc(c.line)}</span>` : "";
  const note = s.note ? `<br><span class="own">${esc(s.note)}</span>` : "";
  const link = s.post ? `<br><a href="${esc(s.post)}">${esc(s.post.replace(/^https?:\/\//, ""))}</a>` : "";
  return `<div class="cap">${esc(c.meta)}${line}${note}${link}</div>`;
}

function book(board, url) {
  const cover = `<section class="page left cover"><div class="head">${esc(board.lane)}</div><h1>${esc(board.running_head.left)}</h1>
<div class="meta">${board.plates.length} plates${board.created ? "<br>" + esc(board.created.slice(0, 10)) : ""}${board.keyword_line.length ? "<br>" + esc(board.keyword_line.join(", ")) : ""}</div></section>`;
  const page = (pg) => `<section class="page ${pg.side}"><div class="head">${esc(pg.head)}</div>
<div class="plate">${media(pg.plate, url)}<div class="n">${num(pg.plate.n)}</div>${caption(pg.plate)}</div>
<div class="foot"><span>${pg.side === "left" ? esc(pg.keywords.join(", ")) : ""}</span><span>${pg.side === "right" ? `P. ${String(Math.ceil((pg.folio + 1) / 2)).padStart(2, "0")}` : ""}</span></div></section>`;
  const all = [cover, ...bookPages(board).map(page)], out = [`<div class="spread">${all[0]}</div>`];
  for (let i = 1; i < all.length; i += 2) out.push(`<div class="spread">${all[i]}${all[i + 1] || ""}</div>`);
  return out.join("\n");
}

const grid = (board, url) => `<div class="grid">${board.plates.map((p) => `<figure class="card">${media(p, url)}<figcaption><div class="n">${num(p.n)}</div>${caption(p)}</figcaption></figure>`).join("\n")}</div>`;

const header = (board) => `<div class="head">${esc(board.lane)}</div><h1>${esc(board.running_head.left)}</h1>
<div class="hash">${board.plates.length} plates${board.created ? ", " + esc(board.created.slice(0, 10)) : ""}${board.keyword_line.length ? ", " + esc(board.keyword_line.join(", ")) : ""}</div>`;

const stamp = (t) => t.replace("T", " ").slice(0, 16) + " UTC";
const when = (s) => (s && s.posted ? stamp(s.posted) : s && s.saved ? "saved " + stamp(s.saved) : "undated");
function timeline(board, url) {
  const rows = timelineRows(board.plates).map((r) => (r.gap ? `<div class="gap">${r.gap.days} days</div>`
    : `<div class="row"><div class="when">${esc(when(r.plate.source))}<br>${num(r.plate.n)}</div>${media(r.plate, url)}${caption(r.plate)}</div>`));
  return `<main class="sheet">${header(board)}${rows.join("\n")}</main>`;
}

// Each claim a sheet over its sources; the most-seen source on top, every layer as opaque as its
// reach. Each layer's provenance line is as opaque as the source is corroborated by other origins,
// and says so in words. Pointing at a layer lifts it to full opacity.
function evidence(board, url, caseData) {
  const plan = evidencePlan(board.plates, caseData);
  const sheets = plan.sheets.map((s) => `<section class="claim"><div class="rung">${esc(s.claim.rung)} ${esc(s.claim.id)}</div><p>${esc(s.claim.text)}</p>
<div class="stack">${s.layers.map((l, i) => `<div class="layer" tabindex="0" style="opacity:${l.opacity};z-index:${s.layers.length - i};margin-left:${i * 28}px">${media(l.plate, url)}<div><div class="n">${num(l.plate.n)} ${esc(l.source)}</div>${caption(l.plate)}
<div class="prov" style="opacity:${l.provenance_opacity}">${l.corroborated_by ? `Corroborated by ${l.corroborated_by} other ${l.corroborated_by === 1 ? "origin" : "origins"} among this claim's sources.` : "No other origin among this claim's sources."}</div>
<div class="hash">${l.plate.source && l.plate.source.reach != null ? esc(Number(l.plate.source.reach).toLocaleString("en-US")) + " views shown. " : ""}${l.plate.source && l.plate.source.sha256 ? "SHA-256 " + esc(l.plate.source.sha256) : ""}</div></div></div>`).join("")}</div></section>`);
  const rest = board.plates.filter((p) => plan.unmatched.includes(p.n)).map((p) => `<div class="row"><div class="when">${num(p.n)}</div>${media(p, url)}${caption(p)}</div>`);
  return `<main class="sheet">${header(board)}${sheets.join("\n")}${rest.join("\n")}</main>`;
}

// The page. opts: { fonts: "fonts/", url: (media, plate) => address, caseData, layout, head }.
// head: the face for running heads and titles (grotesk, accession or mono), else the board's own.
export function boardHtml(board, { fonts = "fonts/", url = defaultUrl, caseData = null, layout = board.layout || "book", head = board.head || "grotesk" } = {}) {
  const body = layout === "grid" ? grid(board, url) : layout === "timeline" ? timeline(board, url) : layout === "evidence" ? evidence(board, url, caseData) : book(board, url);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Daylight Commons study board (${esc(board.format)})">
<title>${esc(board.running_head.left)}</title>
<style>${CSS(fonts, head)}</style>
</head>
<body>
${body}
</body>
</html>
`;
}
