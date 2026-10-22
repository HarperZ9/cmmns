// Builds data/ops.json (and the copy the extension loads, src/ext/ops.json) from the hand-kept
// source list in data/ops-sources/*.json: documented influence operations, each field cited to a
// primary source, and the domains and accounts those sources name. Domain rows of
// data/state-reports.json whose operation the joins file maps to an operation are added as
// indicators with their own document. The same rules apply to every country (src/core/ops-schema.js);
// a record that fails them stops the build. No network access.
//   node scripts/ops-build.mjs
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { opProblems } from "../src/core/ops-schema.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const MAX_BYTES = 450_000;
const SRC = join(ROOT, "data/ops-sources");
// Em dashes become a spaced hyphen: Daylight Commons shows no em dash anywhere a user reads (tests/canon.test.js).
const clean = (v) => (typeof v === "string" ? v.replace(/\s*—\s*/g, " - ") : Array.isArray(v) ? v.map(clean) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clean(x)])) : v);

export function loadSources(dir = SRC) {
  const files = readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "joins.json").sort();
  return files.flatMap((f) => JSON.parse(readFileSync(join(dir, f), "utf8")).map((o) => ({ ...o, file: f })));
}

// One table of documents for the whole file, so an indicator or a field points at an index.
function docTable() {
  const list = [], at = new Map();
  const add = (s) => {
    const key = s.url + "|" + s.title;
    if (!at.has(key)) { at.set(key, list.length); list.push({ publisher: s.publisher || null, title: s.title, url: s.url, date: s.date, kind: s.kind || null, terms: s.terms || null }); }
    return at.get(key);
  };
  return { list, add };
}

function compactOp(o, docs) {
  const idx = Object.fromEntries(o.sources.map((s) => [s.id, docs.add(s)]));
  const cite = Object.fromEntries(Object.entries(o.cite || {}).map(([k, ids]) => [k, ids.map((i) => idx[i])]));
  const dates = o.sources.map((s) => s.date).sort();
  return {
    id: o.id, name: o.name, aliases: o.aliases || [], state: o.state, operator: o.operator, operatorType: o.operatorType,
    active: o.active || {}, platforms: o.platforms || [], languages: o.languages || [], targets: o.targets || [],
    narratives: o.narratives, techniques: o.techniques || [],
    attributions: o.attributions.map((a) => ({ doc: idx[a.source], operatorType: a.operatorType, says: a.says, section: a.section || null })),
    cite, docs: o.sources.map((s) => idx[s.id]), first: dates[0],
  };
}

// Publisher, kind and terms for documents that come only from state-reports.json, by host.
const US_PD = "US government work, public domain (17 USC 105)", META = "copyright, facts and short quotes only";
const HOSTS = [
  [/(^|\.)(about\.fb\.com|transparency\.meta\.com)$/, "Meta", "platform", META], [/(^|\.)openai\.com$/, "OpenAI", "platform", META],
  [/(^|\.)justice\.gov$/, "US Department of Justice", "court", US_PD], [/(^|\.)treasury\.gov$/, "US Department of the Treasury", "government", US_PD],
  [/(^|\.)state\.gov$/, "US Department of State", "government", US_PD],
];
function described(src) {
  const host = new URL(src.url).hostname, h = HOSTS.find(([re]) => re.test(host));
  return h ? { ...src, publisher: h[1], kind: h[2], terms: h[3] } : { ...src, publisher: host, kind: null, terms: "not stated" };
}

// state-reports.json domain rows that the joins file assigns to an operation.
function joinedIndicators(joins, rows, docs) {
  const out = [];
  for (const r of rows) {
    if (!r.domain || !r.operation) continue;
    const j = joins.find((x) => x.prefixes.some((p) => r.operation.startsWith(p)));
    if (!j) continue;
    out.push({ d: r.domain.toLowerCase(), op: j.op, kind: /spoof/i.test(r.name || "") ? "cloned news domain" : "operation site", doc: docs.add(described(r.source)) });
  }
  return out;
}

export function build({ ops = loadSources(), links = JSON.parse(readFileSync(join(SRC, "joins.json"), "utf8")), reports = JSON.parse(readFileSync(join(ROOT, "data/state-reports.json"), "utf8")), built = (process.env.RADAR_BUILT || new Date().toISOString().slice(0, 10)) } = {}) {
  const joins = links.joins || [], drop = new Set((links.exclude || []).map((e) => e.domain));
  const problems = ops.flatMap(opProblems);
  const ids = new Set(ops.map((o) => o.id));
  if (ids.size !== ops.length) problems.push("duplicate operation ids");
  for (const j of joins) if (!ids.has(j.op)) problems.push(`joins.json names unknown operation ${j.op}`);
  if (problems.length) throw new Error("data/ops-sources does not meet the evidence rules:\n  " + problems.join("\n  "));
  const docs = docTable();
  const table = ops.map((o) => compactOp(o, docs)).sort((a, b) => a.first.localeCompare(b.first) || a.id.localeCompare(b.id));
  const own = ops.flatMap((o) => (o.indicators || []).map((i) => ({ ...(i.domain ? { d: i.domain.toLowerCase() } : { x: i.x.toLowerCase() }), op: o.id, kind: i.kind, doc: docs.add(o.sources.find((s) => s.id === i.source)) })));
  const seen = new Set(), indicators = [];
  for (const i of [...own, ...joinedIndicators(joins, reports, docs)]) {
    const k = (i.d || "@" + i.x) + "|" + i.op;
    if (!seen.has(k) && !drop.has(i.d)) { seen.add(k); indicators.push(i); }
  }
  indicators.sort((a, b) => (a.d || "@" + a.x).localeCompare(b.d || "@" + b.x) || a.op.localeCompare(b.op));
  return clean({ built, about: "Documented influence operations and the domains and accounts their sources name. Built by scripts/ops-build.mjs from data/ops-sources. Counts what investigators found and published, not total activity.", docs: docs.list, ops: table, indicators });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = JSON.stringify(build()) + "\n";
  if (Buffer.byteLength(out) > MAX_BYTES) throw new Error(`ops.json is ${Buffer.byteLength(out)} bytes, over the ${MAX_BYTES} cap`);
  for (const p of ["data/ops.json", "src/ext/ops.json"]) writeFileSync(join(ROOT, p), out);
  const t = JSON.parse(out);
  console.log(`ops.json: ${t.ops.length} operations, ${t.indicators.length} indicators, ${t.docs.length} documents, ${Buffer.byteLength(out)} bytes`);
}
