// Builds Radar's transparency page from the evaluation results: every sign with its measured precision and
// recall, intervals, corpus and licence; the side-balance table; what is not measured; the known
// limits. Inputs: project-docs/evidence/eval-results.json and persuasion-results.json (written by
// scripts/eval.mjs and scripts/eval-persuasion.mjs), families.js, EVALUATION.md and CORPORA.md.
// Writes src/ext/transparency.html (opened from options and the popup) and docs/transparency.html.
//   node scripts/transparency.mjs
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, REPO, esc, inline, page, writePage } from "./site/page.mjs";
import { FAMILIES, measuredLine } from "../src/core/families.js";
import { MEASURED_DOES_NOT_PROVE } from "../src/core/measured.js";
import { TECHNIQUES, PERSUASION_DOES_NOT_PROVE } from "../src/core/persuasion.js";
import { FIGURE_CSS } from "./site/figures.mjs";
import { leadSigns } from "./site/signs.mjs";

const read = (p) => readFileSync(join(ROOT, p), "utf8");
const pct = (x) => `${(x * 100).toFixed(1)}%`;
const rate = (r) => (r && r.n ? `${pct(r.value)} (${r.k.toLocaleString("en")} of ${r.n.toLocaleString("en")}; ${pct(r.ci[0])} to ${pct(r.ci[1])})` : "not measured");
const AREA = (a) => a[0].toUpperCase() + a.slice(1);
const KIND = { detector: "Radar's own rule", platform: "The site's own label", table: "Match against a cited table", technique: "Persuasion technique" };
const row = (cells) => `<tr>${cells.map((c) => (typeof c === "object" ? `<td class="${c.cls}">${c.html}</td>` : `<td>${c}</td>`)).join("")}</tr>`;
const tbl = (head, rows) => `<div class="scroll"><table><thead><tr>${head.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead><tbody>\n${rows.join("\n")}\n</tbody></table></div>`;
const num = (html) => ({ cls: "num", html });
// The lowest and highest corpus figure, or one figure when they agree (one corpus had 20 hits).
const span = (r, none) => (!r ? none : r[0] === r[1] ? pct(r[0]) : `${pct(r[0])} to ${pct(r[1])}`);

// Corpus name, link and licence from the tables in CORPORA.md.
export function corpora(md) {
  const out = [];
  for (const l of md.split(/\r?\n/)) {
    const c = l.split("|").map((x) => x.trim());
    if (c.length < 6 || !/^https:/.test(c[3] || "")) continue;
    out.push({ name: c[1], url: c[3].split(" ")[0], licence: c[4] });
  }
  return out;
}

// The bullets under one "###" heading of EVALUATION.md.
export function bullets(md, heading) {
  const lines = md.split(/\r?\n/), at = lines.findIndex((l) => l.trim() === heading);
  if (at < 0) throw new Error(`EVALUATION.md has no heading "${heading}"`);
  const out = [];
  for (const l of lines.slice(at + 1)) {
    if (/^#/.test(l)) break;
    if (l.startsWith("- ")) out.push(l.slice(2)); else if (/^ {2,}\S/.test(l) && out.length) out[out.length - 1] += " " + l.trim();
  }
  return out;
}

function languageRows(fams) {
  return FAMILIES.filter((f) => fams[f.id]).map((f) => {
    const d = fams[f.id];
    return row([esc(f.name), num(rate(d.precision)), num(span(d.precisionRange, "under 20 hits in each corpus")), num(rate(d.recall)), d.measured ? "Shown with this figure" : esc(`Not measured: ${String(d.note).replace(/; not measured$/, "")}`)]);
  });
}

function weakRows(fams) {
  const names = { slurSoft: "Context-dependent slur", contempt: "Contempt", motive: "Motive attribution", essentialise: "Essentialising", absolutist: "Absolutist wording", conspiracy: "Conspiracy framing", strong: "Any strong language sign" };
  return Object.keys(names).filter((k) => fams[k]).map((k) => row([esc(names[k]), num(rate(fams[k].precision)), num(span(fams[k].precisionRange, "n/a"))]));
}

function persuasionRows(ptc) {
  return Object.entries(TECHNIQUES).map(([id, t]) => {
    const r = ptc.techniques[id];
    const line = measuredLine(id);
    return row([esc(t.name), num(r ? rate(r.precision) : "no hits"), num(r ? rate(r.recall) : "0"), num(r ? pct(r.chance.value) : "n/a"), esc(line.measured ? "Shown" : "Not shown: " + line.text.replace(/^held back /, "").replace(/:.*$/, "").replace(/[()]/g, ""))]);
  });
}

function everySignRows() {
  return FAMILIES.map((f) => row([esc(f.name), AREA(f.area), KIND[f.kind] || f.kind, esc(measuredLine(f.id).text)]));
}

// Side balance: the strong families on hostile text aimed at each side's usual targets.
function sideRows(sides) {
  const label = { mhs: "Measuring Hate Speech", hatexplain: "HateXplain" };
  return Object.entries(sides).map(([c, s]) => {
    const lo = Math.min(s.right.recall.value, s.left.recall.value), hi = Math.max(s.right.recall.value, s.left.recall.value);
    const overlap = s.right.recall.ci[0] <= s.left.recall.ci[1] && s.left.recall.ci[0] <= s.right.recall.ci[1];
    const closed = overlap && hi <= lo * 1.25;
    return row([label[c] || esc(c), num(rate(s.right.recall)), num(rate(s.left.recall)), num(rate(s.right.precision)), num(rate(s.left.precision)), closed ? "Balanced" : '<span class="hot">Gap remains</span>']);
  });
}

function notMeasured(fams) {
  const synthetic = new Set(["duplicates", "mismatch"]);
  const open = FAMILIES.filter((f) => f.kind === "detector" && !measuredLine(f.id).measured && !synthetic.has(f.id)).map((f) => f.name);
  return [
    `Radar's own rules with no measurement yet: ${open.join(", ")}. The window says "not measured yet" beside each of them.`,
    "Same text as other replies, and speaks as local, labelled elsewhere: tested only on cases written alongside the rules (below). No error rate on real replies exists yet.",
    "Live threads: no thread from X, YouTube, Reddit, Facebook, Instagram or Bluesky has been labelled by hand yet, so no figure here comes from those sites.",
    "French language signs: too few hits in the French corpus to measure. Persuasion cues in French: no corpus Radar may use.",
    fams.vigilante && !fams.vigilante.measured ? "Call for vigilantes: fewer than 20 hits in the test split." : null,
    "Site labels (Community Notes, ads, posting app, X's spam label) and matches against cited tables (outlet owners, state links) are not Radar's judgement. Their evidence is the site or the cited source.",
  ].filter(Boolean);
}

// A dense table kept under a disclosure, as the site's product pages keep counts.
const more = (summary, html) => `<details class="how-we-know"><summary>${esc(summary)}</summary>
${html}
</details>`;
// Measured on the seeded set in tests/confusables.test.js.
export const FOLD_SEEDED = { before: 75, after: 100 };

const ul = (items, fmt = esc) => `<ul>${items.map((x) => `<li>${fmt(x)}</li>`).join("\n")}</ul>`;

export function render() {
  const evalMd = read("project-docs/EVALUATION.md");
  const ptc = JSON.parse(read("project-docs/evidence/persuasion-results.json"));
  const D = JSON.parse(read("project-docs/evidence/eval-results.json")), fams = D.families;
  const sources = corpora(read("project-docs/evidence/CORPORA.md"));
  const B = JSON.parse(read("project-docs/evidence/baseline-results.json"));
  const lead = leadSigns({ D, ptc, B, fold: { ...FOLD_SEEDED, ...B.fold } });
  const limits = [...bullets(evalMd, "### What the numbers do not prove"), ...bullets(evalMd, "### What the persuasion numbers do not prove")];
  const body = `
<p class="lead">Every sign in Radar's window either shows how often it was right when people checked by hand, or says "not measured yet". This page lists every sign, the data each was checked on and its licence, how evenly the signs work whichever side a post targets, and what the numbers do not prove.</p>
<h2>How to read the numbers</h2>
<ul>
<li><strong>Precision</strong> is the share of signs Radar showed that the human annotators of a public research corpus agreed with. It answers "when Radar shows this, how often is it right?"</li>
<li><strong>Recall</strong> is the share of the annotated cases that Radar found. Radar is built for precision: a wrong sign on an honest reply is the harm it avoids most, so recall is low.</li>
<li>Each figure gives the count and a 95% interval (Wilson). A wide interval means few cases were checked.</li>
<li>All figures come from a held-out test split (seed <code>${esc(D.seed)}</code>). Rules were tuned on a separate split, and the test split was read once, after tuning. Measured ${esc(D.generated)}.</li>
</ul>
<h2>One figure per sign</h2>
<p>Each sign leads with what its measurement means when you see it. The figure draws the 95% interval as a band and the measured value as a mark; a dashed line is the bar a sign must clear to show. Counts, data and limits sit under "How we know".</p>
${lead}
<h2>Language signs</h2>
<p>Checked on three public corpora of comments labelled by people, pooled: Measuring Hate Speech (CC BY 4.0), HateXplain (MIT) and Civil Comments (CC0 1.0). The range runs from the lowest to the highest corpus with at least 20 hits. Recall is against Measuring Hate Speech's own survey item for that sign, where one exists.</p>
${more("Every language sign, with counts", tbl(["Sign", "Precision (95% interval)", "Range across corpora", "Recall", "Status"], languageRows(fams)))}
<p class="muted">${esc(MEASURED_DOES_NOT_PROVE)}</p>
<h3>Weaker signs that count only toward a reply being "extreme"</h3>
${more("Weaker signs, with counts", tbl(["Sign", "Share on hostile text (95% interval)", "Range across corpora"], weakRows(fams)))}
<p class="muted">These describe framing, which the corpora do not label. Their figures against hostility labels are context, not error rates.</p>
<h3>The thread report's "extreme"</h3>
<p>Precision against Measuring Hate Speech severity labels: <span class="mono">${rate(D.extreme.precision)}</span>. Recall: <span class="mono">${rate(D.extreme.recall)}</span>. On HateXplain: precision <span class="mono">${rate(D.extreme.byCorpus.hatexplain)}</span>. Most severe replies do not count as extreme, so the report undercounts them.</p>
<h2>Persuasion techniques</h2>
<p>Checked on the Propaganda Techniques Corpus v2 (CC BY 4.0), news articles labelled span by span. A technique shows in the window only when its precision is at least 80% and its 95% interval starts at 70% or above, from at least 20 hits. Published systems reach F1 of about 30 to 44 on these techniques, where a confident label is wrong more often than right. Whataboutism needs the whole exchange, so it never shows on one reply. No technique has cleared the bar.</p>
${more("Every technique, with counts", tbl(["Technique", "Precision (95% interval)", "Recall", "Chance", "Status"], persuasionRows(ptc)))}
<p class="muted">${esc(PERSUASION_DOES_NOT_PROVE)} "Chance" is the share of words inside a labelled span of that technique.</p>
<h2>Cases written for the test</h2>
<p>Same text as other replies: pair precision <span class="mono">${rate(D.duplicates.precision)}</span>, recall <span class="mono">${rate(D.duplicates.recall)}</span>. Speaks as local, labelled elsewhere: precision <span class="mono">${rate(D.mismatch.precision)}</span>, recall <span class="mono">${rate(D.mismatch.recall)}</span>. The same author wrote these cases and the rules, so they show the rules do what they say. They are not error rates on real replies.</p>
<h2>Side balance</h2>
<p>Political side is never an input to Radar. To check that the signs work alike whichever side a post targets, the strong language signs were measured on hostile text aimed at groups each side is often hostile to. "Balanced" means the two recall intervals overlap and the larger is at most 1.25 times the smaller.</p>
${tbl(["Corpus", "Recall, right's usual targets", "Recall, left's usual targets", "Precision, right's usual targets", "Precision, left's usual targets", "Result"], sideRows(D.sides))}
<p class="muted">Precision agrees across sides within the intervals. Where a gap remains, the thread report undercounts extreme replies aimed at the side with lower recall.</p>
<h2>Every sign</h2>
<p>Each of Radar's ${FAMILIES.length} signs, with the line its window shows beside it.</p>
${more("Every sign and its measured line", tbl(["Sign", "Area", "Kind", "What the window says"], everySignRows()))}
<h2>What is not measured</h2>
${ul(notMeasured(fams))}
<h2>Known limits</h2>
${ul(limits, inline)}
<h2>Your own feedback</h2>
<p>Each sign in the window has "This was right" and "This was wrong". Your marks stay in your browser. After 10 marks on one kind of sign, the window shows your own count under the measured figure. It never changes the figures on this page. You can save your marks to a file from the options page and choose whether to share it.</p>
<h2>Data used</h2>
${tbl(["Corpus", "Licence"], sources.map((s) => row([`<a href="${esc(s.url)}">${esc(s.name)}</a>`, esc(s.licence)])))}
<p>No corpus text is in Radar or its repository; only counts, rates and file hashes are. The evaluation scripts in <a href="${REPO}">Radar's repository</a> reproduce every number here from the downloaded corpora.</p>`;
  return page({ title: "How Radar is measured", description: "Every Radar sign with its measured precision, recall and interval, the data behind it, the side-balance check and the known limits.", updated: D.generated, body, css: FIGURE_CSS });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  writePage("transparency.html", render());
  console.log("wrote src/ext/transparency.html and docs/transparency.html");
}
