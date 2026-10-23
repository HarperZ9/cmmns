// Builds the public catalogue page, docs/catalogue.html, from catalogue/definitions/ and
// catalogue/CHANGELOG.md. Every entry appears with its jurisdiction, version, sources, retrieval
// dates and elements; the source hashes and quoted text sit in a details element, out of the
// reading path, as the site canon asks. Each entry has an anchor (#<id>) that badges can link to.
//   node scripts/catalogue-page.mjs
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, REPO, esc, sitePage } from "./site/page.mjs";
import { DEFINITION_FRAME, LEGAL_NOTE } from "../src/core/definitions.js";

export const OUT = join(ROOT, "docs", "catalogue.html");
const DIR = join(ROOT, "catalogue", "definitions");
const CHALLENGE_URL = `${REPO}/issues/new?template=challenge.yml`;
const GROUPS = [["US", "United States"], ["EU", "European Union"], ["UK", "United Kingdom"], ["platform:", "Platform policies"]];
const OBSERVABLE = { page: "On the page", "public-record": "In a public record", "not-observable": "Not observable" };
const ROLE = {
  match: "Aimed at the conduct",
  comparison: "Broader definition, shown for comparison",
  context: "A duty of someone else, such as a platform",
};

export function loadEntries(dir = DIR) {
  return readdirSync(dir).filter((f) => f.endsWith(".json")).sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
}

export function groupOf(entry) {
  const code = entry.jurisdiction.code;
  const g = GROUPS.find(([p]) => code === p || code.startsWith(p.endsWith(":") ? p : p + "-"));
  return g ? g[1] : entry.jurisdiction.name;
}

// Groups in a fixed order (any unknown jurisdiction after them), entries by id within a group.
export function grouped(entries) {
  const order = GROUPS.map(([, n]) => n);
  const map = new Map();
  for (const e of entries) { const g = groupOf(e); if (!map.has(g)) map.set(g, []); map.get(g).push(e); }
  const rank = (g) => (order.includes(g) ? order.indexOf(g) : order.length);
  return [...map.entries()].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([name, list]) => [name, list.sort((a, b) => a.id.localeCompare(b.id))]);
}

// The catalogue's date: the newest version heading in catalogue/CHANGELOG.md.
export function updated(md = readFileSync(join(ROOT, "catalogue", "CHANGELOG.md"), "utf8")) {
  const dates = [...md.matchAll(/^## .*\((\d{4}-\d{2}-\d{2})\)/gm)].map((m) => m[1]).sort();
  if (!dates.length) throw new Error("catalogue/CHANGELOG.md needs a dated version heading");
  return dates[dates.length - 1];
}

function elementsTable(entry) {
  const rows = entry.elements.map((el) => `<tr><td>${esc(el.id)}</td><td>${esc(el.label)}${el.note ? `<br><span class="dc-note">${esc(el.note)}</span>` : ""}</td><td>${esc(OBSERVABLE[el.observable_from] || el.observable_from)}</td><td>${el.required ? "Required" : "Supporting"}</td></tr>`).join("\n");
  return `<div class="scroll"><table class="data data--wide"><caption>Elements of ${esc(entry.id)}@${esc(entry.version)}</caption><thead><tr><th scope="col">Element</th><th scope="col">What it requires</th><th scope="col">Where it can be seen</th><th scope="col">Weight</th></tr></thead><tbody>
${rows}
</tbody></table></div>`;
}

function sourcesList(entry) {
  return `<ul class="dc-sources">${entry.sources.map((s) => `<li><a href="${esc(s.url)}">${esc(s.publisher)}</a>, retrieved ${esc(s.retrieved_at)}</li>`).join("\n")}</ul>`;
}

// The verification record: hashes and the quoted text, for a reader who wants to check them.
function record(entry) {
  const hashes = entry.sources.map((s, i) => `<li>Source ${i + 1}: <a href="${esc(s.retrieved_url || s.url)}">retrieved copy</a>, SHA-256 (${esc(s.hash_method)}) <code>${esc(s.sha256)}</code>${s.text_sha256 ? `, text SHA-256 <code>${esc(s.text_sha256)}</code>` : ""}</li>`).join("\n");
  const quotes = entry.quotes.map((q) => `<blockquote><p>${esc(q.text)}</p><footer>${esc(q.locator)}, source ${q.source + 1}</footer></blockquote>`).join("\n");
  return `<details><summary>Quoted text and source hashes</summary>
<ul class="dc-hashes">${hashes}</ul>
${quotes}
</details>`;
}

export function entryHtml(entry) {
  const where = entry.jurisdiction.name;
  const since = entry.in_force && entry.in_force.since ? `, in force since ${esc(entry.in_force.since)}` : "";
  return `<article class="dc-entry" id="${esc(entry.id)}">
<h3>${esc(entry.title)}</h3>
<p class="dc-meta"><code>${esc(entry.id)}@${esc(entry.version)}</code> · ${esc(entry.instrument)}, ${esc(entry.section)} · ${esc(where)}${since}</p>
<p>${esc(ROLE[entry.role] || entry.role)}. ${esc(entry.binding_note)}</p>
${elementsTable(entry)}
${sourcesList(entry)}
<p class="dc-limit"><strong>What a match does not prove.</strong> ${esc(entry.does_not_prove)}</p>
${record(entry)}
<p class="dc-challenge"><a href="${CHALLENGE_URL}">Challenge this entry</a> · <a href="${REPO}/blob/main/catalogue/definitions/${esc(entry.id)}.json">Entry file</a> · <a href="#contents">Back to the list</a></p>
</article>`;
}

function contents(groups) {
  return `<nav id="contents" aria-label="Catalogue entries"><ul class="dc-toc">${groups.map(([name, list]) => `<li>${esc(name)}: ${list.map((e) => `<a href="#${esc(e.id)}">${esc(e.title)}</a>`).join(", ")}</li>`).join("\n")}</ul></nav>`;
}

function intro(entries) {
  return `<p>Daylight Commons compares what a page shows with published definitions from law and platform policy, element by element. This page lists every definition in the catalogue: ${entries.length} entries, each quoted from its official source, with the date it was retrieved and a hash of what was retrieved. A badge names the entry and version it used, so it can always be read against the text below.</p>
<p>${esc(DEFINITION_FRAME)} ${esc(LEGAL_NOTE)}</p>
<p>Anyone can challenge an entry or a badge through the <a href="${CHALLENGE_URL}">challenge form</a>. Changes are listed in the <a href="${REPO}/blob/main/catalogue/CHANGELOG.md">catalogue changelog</a>, and the whole catalogue is CC BY 4.0 in <a href="${REPO}/tree/main/catalogue">the repository</a>.</p>`;
}

const CSS = `.dc-entry{margin:0 0 2.2rem}
.dc-entry h3{scroll-margin-top:5rem}
.dc-meta,.dc-note,.dc-challenge{color:var(--ink-muted);font-size:.9rem}
.dc-sources,.dc-hashes{padding-left:1.1rem}
.dc-hashes code{overflow-wrap:anywhere;font-size:.875rem}
.dc-entry details{margin:.6rem 0;max-width:var(--measure)}
.dc-entry blockquote{margin:.6rem 0 .6rem .8rem;padding-left:.8rem;border-left:1px solid var(--rule)}
.dc-entry blockquote footer{color:var(--ink-muted);font-size:.875rem}
.dc-toc{padding-left:1.1rem}
.dc-toc li{margin:.3rem 0}
caption{text-align:left;color:var(--ink-muted);font-size:.875rem;padding:.3rem 0}`;

export function render(entries = loadEntries(), date = updated()) {
  const groups = grouped(entries);
  const body = [intro(entries), contents(groups), ...groups.map(([name, list]) => `<h2>${esc(name)}</h2>\n${list.map(entryHtml).join("\n")}`)].join("\n");
  return sitePage({
    file: "catalogue.html",
    title: "Definition catalogue",
    role: "Every published definition Daylight Commons compares a page with: its source, version, retrieval date and elements.",
    description: "The open catalogue of legal and platform definitions behind Daylight Commons' badges, each with its official source, version and elements.",
    updated: date, body, css: CSS,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeFileSync(OUT, render());
  console.log("wrote docs/catalogue.html");
}
