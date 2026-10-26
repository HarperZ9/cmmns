// Scores the argument lens against two people's annotations of the gold passages
// (data/argument/passages.json, marked with docs/annotate/argument.html). Gold is where both agree.
// Reports agreement between the two, then, on the held-out passages, boundary precision and recall per
// language and precision per role. With --write it rewrites src/core/discourse/argument-measured.js,
// the gate the window reads, and saves project-docs/evidence/argument-gold-eval.json.
//   node scripts/eval-argument-gold.mjs --annotations DIR [--split heldout|dev] [--write]
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readArgument } from "../src/core/discourse/argument.js";
import { wilson } from "../src/core/discourse/stats.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROLES = ["premise", "minor premise", "supporting premise", "assumption", "conclusion", "turn"];
const LANGS = ["la", "en", "fr", "es", "pt"];
const ci = (k, n) => (n ? wilson(k, n).map((v) => Math.round(v * 1000) / 1000) : null);

// Character offsets to word positions, so a break counts wherever the space falls.
const wordAt = (text) => { const starts = [...text.matchAll(/\S+/g)].map((m) => m.index); return (off) => { let k = 0; while (k + 1 < starts.length && starts[k + 1] <= off) k++; return k; }; };

// One passage's segments as [{ from, role }] in word positions.
function parts(text, boundaries, roles) {
  const at = wordAt(text), cuts = [0, ...[...new Set(boundaries.map(at))].sort((a, b) => a - b).filter((k) => k > 0)];
  return cuts.map((from, i) => ({ from, role: roles[i] || null }));
}

export function evaluate(passages, annotations, split = "heldout") {
  if (annotations.length < 2) throw new Error("two annotation files are needed");
  const [A, B] = annotations, perLang = {}, perRole = Object.fromEntries(ROLES.map((r) => [r, { hits: 0, right: 0 }]));
  let agreeBoth = 0, agreeAny = 0;
  for (const p of passages.filter((x) => x.split === split)) {
    const a = A.passages[p.id], b = B.passages[p.id];
    if (!a || !b) continue;
    const pa = parts(p.text, a.boundaries, a.roles), pb = parts(p.text, b.boundaries, b.roles);
    const sa = new Set(pa.slice(1).map((x) => x.from)), sb = new Set(pb.slice(1).map((x) => x.from));
    const gold = new Set([...sa].filter((k) => sb.has(k)));
    agreeBoth += gold.size; agreeAny += new Set([...sa, ...sb]).size;
    const lens = readArgument(p.text, p.lang), at = wordAt(p.text);
    const ls = lens.segments.map((s) => ({ from: at(s.start), role: s.role }));
    const lb = new Set(ls.slice(1).map((x) => x.from));
    const L = (perLang[p.lang] ||= { lens: 0, gold: 0, both: 0 });
    L.lens += lb.size; L.gold += gold.size; L.both += [...lb].filter((k) => gold.has(k)).length;
    // roles: a lens segment whose start both annotators drew (or the first segment) and both named alike
    for (const s of ls) {
      const ra = pa.find((x) => x.from === s.from), rb = pb.find((x) => x.from === s.from);
      if (!ra || !rb || !ra.role || ra.role !== rb.role || !perRole[s.role]) continue;
      perRole[s.role].hits++; if (ra.role === s.role) perRole[s.role].right++;
    }
  }
  const langs = Object.fromEntries(LANGS.map((l) => { const x = perLang[l]; return [l, x ? { precision: x.lens ? x.both / x.lens : null, recall: x.gold ? x.both / x.gold : null, lens: x.lens, gold: x.gold, both: x.both, pInterval: ci(x.both, x.lens), rInterval: ci(x.both, x.gold), pass: !!(x.lens && x.gold && x.both / x.lens >= 0.8 && x.both / x.gold >= 0.7) } : null]; }));
  const roles = Object.fromEntries(ROLES.map((r) => { const x = perRole[r]; return [r, x.hits ? { precision: x.right / x.hits, hits: x.hits, interval: ci(x.right, x.hits), pass: x.hits >= 3 && x.right / x.hits >= 0.8 } : null]; }));
  return { split, annotators: [A.annotator, B.annotator], boundaryAgreement: agreeAny ? agreeBoth / agreeAny : null, langs, roles };
}

function gateModule(r) {
  return `// The argument lens's gate, written by scripts/eval-argument-gold.mjs --write from two people's
// annotations of the held-out gold passages (data/argument/passages.json). A role shows by default only
// when its precision is 0.8 or more from at least 3 hits; boundaries per language need precision 0.8
// and recall 0.7. Until annotations exist every entry is null and nothing passes.
export const ARGUMENT_GATE = ${JSON.stringify(Object.fromEntries(Object.entries(r.roles).map(([k, v]) => [k, v && { precision: Math.round(v.precision * 1000) / 1000, hits: v.hits }])))};
export const BOUNDARY_GATE = ${JSON.stringify(Object.fromEntries(Object.entries(r.langs).map(([k, v]) => [k, v && { precision: v.precision, recall: v.recall, pass: v.pass }])))};
export const GATE_SOURCE = ${JSON.stringify(`two annotators (${r.annotators.join(", ")}), ${r.split} passages`)};
`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const dir = arg("--annotations", null);
  if (!dir) { console.error("usage: node scripts/eval-argument-gold.mjs --annotations DIR [--split heldout|dev] [--write]"); process.exit(2); }
  const files = readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(dir, f), "utf8"))).filter((x) => x.format === "daylight.argument-annotation/1");
  const r = evaluate(JSON.parse(readFileSync(join(ROOT, "data/argument/passages.json"), "utf8")).passages, files, arg("--split", "heldout"));
  console.log(JSON.stringify(r, null, 1));
  if (process.argv.includes("--write")) {
    writeFileSync(join(ROOT, "project-docs/evidence/argument-gold-eval.json"), JSON.stringify(r, null, 1) + "\n");
    if (r.split === "heldout") writeFileSync(join(ROOT, "src/core/discourse/argument-measured.js"), gateModule(r));
  }
}
