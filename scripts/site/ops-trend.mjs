// The transparency page's section on documented influence operations: counts per year and per
// attributed country, straight from data/ops.json through opsTrend (src/core/ops.js), the same
// function the dashboard uses. The caveat sits beside the numbers, never below a fold.
import { esc } from "./page.mjs";
import { opsTrend, OPS_TREND_CAVEAT } from "../../src/core/ops.js";
import { OPERATOR_TYPES } from "../../src/core/ops-schema.js";

const TYPE = { "government": "Government", "state media": "State media", "contractor": "Contractor", "linked to a state": "Linked to a state", "commercial firm": "Firm, no state named", "origin only": "Origin only" };
const tr = (cells) => `<tr>${cells.map((c, i) => `<td${i ? ' class="num"' : ""}>${c}</td>`).join("")}</tr>`;
const table = (head, rows) => `<div class="scroll"><table><thead><tr>${head.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead><tbody>\n${rows.join("\n")}\n</tbody></table></div>`;

export function opsSection(t) {
  const T = opsTrend(t), max = Math.max(1, ...T.byYear.map((y) => y.n));
  const yearRows = T.byYear.map((y) => tr([String(y.year), String(y.n), esc(Object.entries(y.byState).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([s, n]) => `${s} ${n}`).join(", ")),
    `<span class="mono" aria-hidden="true">${"▮".repeat(Math.max(1, Math.round((y.n / max) * 20)))}</span>`]));
  const stateRows = T.byState.map((s) => tr([esc(s.state), String(s.n), String(s.docs), ...OPERATOR_TYPES.map((k) => String(s.byType[k] || 0))]));
  const indicators = t.indicators.length, domains = t.indicators.filter((i) => i.d).length;
  return `
<h2>Documented influence operations</h2>
<p>Radar carries ${T.total} influence operations from ${T.byState.length} attributed countries, first published between ${T.byYear[0].year} and ${T.byYear[T.byYear.length - 1].year}, and ${indicators.toLocaleString("en")} domains and accounts their sources named (${domains.toLocaleString("en")} domains). A link or account that a report named shows "Named in a published report", with who the sources say ran it, in each source's own words.</p>
<p><strong>What the counts mean.</strong> ${esc(OPS_TREND_CAVEAT)}</p>
<p>Every operation meets the same bar, whatever the country: at least one primary source that was read (a platform report, a research lab, a court or government document, or reporting that names its sources), an operator type that a source itself states, and a cited source for every field. A test enforces this on the data.</p>
<h3>By year of first report</h3>
${table(["Year", "Operations", "By attributed country", "Bar"], yearRows)}
<h3>By attributed country</h3>
<p>Operator type follows the source's own words. "Linked to a state" means a source says linked to or associated with a government without saying it ran the operation; "origin only" means the source names a country and no operator.</p>
${table(["Country", "Operations", "Documents cited", ...OPERATOR_TYPES.map((k) => TYPE[k])], stateRows)}`;
}
