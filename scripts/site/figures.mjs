// One figure per sign for the transparency page, as on the author's product pages: a plain
// sentence that leads, an interval drawn as a figure, and the counts in a collapsed "How we know".
// Ink on the calm ground only; colour stays for verdicts, so the figure has none.
import { esc } from "./page.mjs";

export const FIGURE_CSS = `.sign { margin: var(--s-6) 0 0; max-width: var(--measure); }
.sign h3 { margin: 0 0 var(--s-1); }
.takeaway { margin: 0 0 var(--s-2); font-size: var(--t-dek); line-height: 1.4; }
.ci-fig { display: block; width: 100%; max-width: 30rem; height: auto; margin: var(--s-2) 0; overflow: visible; }
.ci-fig .axis { stroke: var(--line-strong); stroke-width: 1; }
.ci-fig .tick { stroke: var(--line-strong); stroke-width: 1; }
.ci-fig .bar { stroke: var(--ink); stroke-width: 1; stroke-dasharray: 3 3; }
.ci-fig .band { fill: var(--raised); stroke: var(--ink); stroke-width: 1; }
.ci-fig .point { stroke: var(--ink); stroke-width: 3; }
.ci-fig text { fill: var(--soft); font: 400 14px var(--font-mono); }
details.how-we-know { margin: var(--s-2) 0 0; }
details.how-we-know > summary { font-size: var(--t-meta); }
dl.hwk-list { margin: var(--s-2) 0 0; display: grid; grid-template-columns: minmax(8rem, max-content) 1fr; gap: var(--s-1) var(--s-4); font-size: var(--t-meta); }
dl.hwk-list dt { font-weight: 650; }
dl.hwk-list dd { margin: 0; font-variant-numeric: tabular-nums; }
@media (max-width: 34rem) { dl.hwk-list { grid-template-columns: 1fr; } dl.hwk-list dd { margin-bottom: var(--s-2); } }`;

const W = 400, PAD = 8;
const x = (v, max) => PAD + (Math.min(Math.max(v, 0), max) / max) * (W - 2 * PAD);
const label = (v) => `${Math.round(v * 1000) / 10}%`.replace(".0%", "%");

// An interval figure: the point estimate, its 95% interval as a band, an axis from 0 to max, and
// an optional bar (the ship threshold) drawn dashed.
export function ciFigure({ value, ci, max = 1, bar = null, what }) {
  const lo = x(ci[0], max), hi = x(ci[1], max), p = x(value, max);
  const aria = `${what}: ${label(value)}, 95% interval ${label(ci[0])} to ${label(ci[1])}${bar != null ? `; the bar is ${label(bar)}` : ""}.`;
  return `<svg class="ci-fig" viewBox="0 0 ${W} 44" role="img" aria-label="${esc(aria)}">`
    + `<line class="axis" x1="${PAD}" y1="16" x2="${W - PAD}" y2="16"/>`
    + `<line class="tick" x1="${PAD}" y1="12" x2="${PAD}" y2="20"/><line class="tick" x1="${W - PAD}" y1="12" x2="${W - PAD}" y2="20"/>`
    + (bar != null ? `<line class="bar" x1="${x(bar, max).toFixed(1)}" y1="2" x2="${x(bar, max).toFixed(1)}" y2="30"/>` : "")
    + `<rect class="band" x="${lo.toFixed(1)}" y="10" width="${Math.max(1, hi - lo).toFixed(1)}" height="12"/>`
    + `<line class="point" x1="${p.toFixed(1)}" y1="6" x2="${p.toFixed(1)}" y2="26"/>`
    + `<text x="${PAD}" y="42">0</text><text x="${W - PAD}" y="42" text-anchor="end">${label(max)}</text>`
    + (bar != null ? `<text x="${x(bar, max).toFixed(1)}" y="42" text-anchor="middle">bar ${label(bar)}</text>` : "")
    + `</svg>`;
}

// One sign: its heading, the sentence that leads, the figure, and the counts collapsed.
// details: [[term, html], ...]; html is inserted as given, so callers escape it.
export function signBlock({ title, takeaway, figure, details }) {
  const dl = details.filter(Boolean).map(([t, d]) => `<dt>${esc(t)}</dt><dd>${d}</dd>`).join("");
  return `<section class="sign">
<h3>${esc(title)}</h3>
<p class="takeaway">${esc(takeaway)}</p>
${figure || ""}
<details class="how-we-know"><summary>How we know</summary><dl class="hwk-list">${dl}</dl></details>
</section>`;
}
