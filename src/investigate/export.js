// `case export --profile legal|newsroom|research`. Each export is a new numbered version under
// exports/<profile>/, with a SHA256SUMS file and a signed Daylight Commons evidence bundle whose
// items are the content address (sha256 and size) of every file in the export. The bundle checks
// offline in docs/verify-offline.html or with `radar verify`; `case verify-export` also rehashes
// the files. A new version is written only when the case changed; CHANGES.md lists what changed.
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { within, isWithin } from "./paths.js";
import { sha256 } from "./capture.js";
import { makeRedactor } from "./redact.js";
import { newsroomMarkdown, markdownHtml } from "./dossier.js";
import { custodyRows, custodyMarkdown } from "./custody.js";
import { datasetFiles } from "./dataset.js";
import { buildNetwork, networkHtml } from "./network.js";
import { API_VERSION, EVIDENCE_SCHEMA } from "../core/api.js";
import { BUNDLE_KIND, BUNDLE_VERSION, BUNDLE_DOES_NOT_PROVE, CARRIER_SAFE, CARRIER_SAFE_NOTE } from "../core/bundle-verify.js";
import { carrierTool } from "../core/evidence-bundle.js";
import { cleanExportFiles } from "./export-clean.js";
import { dayOnly, dayOnlyDeep } from "./protection.js";

export const PROFILES = ["newsroom", "legal", "research"];
export const BUNDLE_FILE = "case.evidence-bundle.json";
const TABLE_KEYS = ["sources", "claims", "events", "edges", "leads", "absent", "actors", "proposals"];

// A hash of everything an export is built from, so an unchanged case is not exported again.
export const caseStateHash = (data, profile, extra = {}) => sha256(Buffer.from(JSON.stringify([profile, data.meta.name, ...TABLE_KEYS.map((k) => data[k]), extra.reading ? extra.reading.rows : null, extra.summary || null, ...(extra.clean || extra.carrier || extra.protection ? [!!extra.clean, !!extra.carrier, !!extra.protection] : [])])));

function redactNetwork(n, r) {
  const id = (x) => r.text(x);
  return { ...n, nodes: n.nodes.map((x) => ({ ...x, id: id(x.id) })), edges: n.edges.map((e) => ({ ...e, from: id(e.from), to: id(e.to) })), mutual: n.mutual.map((m) => m.map(id)) };
}

// { name: string | Buffer } for one profile, before the sums and the bundle.
export function profileFiles(data, profile, ctx) {
  if (!PROFILES.includes(profile)) throw new Error(`--profile must be one of ${PROFILES.join(", ")}`);
  const r = makeRedactor(data.actors, data.meta.salt, { forceAll: !!ctx.protection }), files = {};
  const md = r.text(newsroomMarkdown(data, ctx));
  if (profile === "newsroom") {
    const net = redactNetwork(buildNetwork(data), r);
    Object.assign(files, { "DOSSIER.md": md, "DOSSIER.html": markdownHtml(md, data.meta.name), "network.json": JSON.stringify(net, null, 2) + "\n", "network.html": networkHtml(net, `${data.meta.name}: network`) });
  } else if (profile === "legal") {
    const pubs = new Set(r.publicFigures), isPublic = (h) => pubs.has(String(h).toLowerCase().replace(/^@/, ""));
    const rows = custodyRows(data, isPublic);
    files["CUSTODY.md"] = r.text(custodyMarkdown(data, rows, ctx));
    files["custody.json"] = JSON.stringify(r.deep(rows), null, 2) + "\n";
    files["DOSSIER.md"] = md;
    for (const row of rows) if (row.included) files[row.included] = readFileSync(join(data.dir, "captures", row.included.split("/").pop()));
  } else {
    Object.assign(files, datasetFiles(data, ctx, r), { "DOSSIER.md": md });
  }
  return { files, redacted: r.redacted() };
}

export function sumsText(files) {
  return Object.keys(files).sort().map((n) => `${sha256(Buffer.isBuffer(files[n]) ? files[n] : Buffer.from(files[n], "utf8"))}  ${n}`).join("\n") + "\n";
}

// The unsigned evidence bundle: one "case-file" item per file, carrying its content address.
export function exportBundle(data, profile, files, ctx) {
  const names = Object.keys(files).sort();
  const evidence = names.map((n, i) => {
    const b = Buffer.isBuffer(files[n]) ? files[n] : Buffer.from(files[n], "utf8");
    return { id: `e${i + 1}`, kind: "case-file", scope: "file", level: "info", label: n, shows: `sha256 ${sha256(b)}, ${b.length} bytes`, source: `daylight case export, profile ${profile}, case "${data.meta.name}"`, context: "A matching hash shows this file is the one exported. It does not show that its content is true.", posts: [n], spans: [], data: { path: n, sha256: sha256(b), bytes: b.length } };
  });
  const out = {
    kind: BUNDLE_KIND, version: BUNDLE_VERSION, schema: EVIDENCE_SCHEMA, api: API_VERSION, tool: ctx.tool, savedAt: ctx.at, dataLock: null,
    input: { kind: "text", site: null, page: null, source: "export", accounts: null }, posts: names.map((id) => ({ id })), textIncluded: false, evidence,
    limits: [`Case export, profile ${profile}. Rehash each file and compare with its item to check it.`, BUNDLE_DOES_NOT_PROVE],
  };
  // Carrier-safe: the day only, the tool's major version only, signed with a one-time key.
  return ctx.carrier ? { ...out, profile: CARRIER_SAFE, tool: carrierTool(ctx.tool), savedAt: dayOnly(ctx.at), limits: [...out.limits, CARRIER_SAFE_NOTE] } : out;
}

const versions = (base) => (existsSync(base) ? readdirSync(base).filter((n) => /^v\d{3}$/.test(n)).sort() : []);

function changes(prev, cur) {
  if (!prev) return "First export of this case.\n";
  const L = [];
  for (const k of ["claims", "sources", "leads", "absent", "edges", "events"]) {
    const a = new Map(prev[k].map((r) => [r.id, r])), b = new Map(cur[k].map((r) => [r.id, r]));
    for (const [id, r] of b) if (!a.has(id)) L.push(`- ${k}: added ${id}${r.text ? ` "${r.text}"` : ""}`);
    for (const id of a.keys()) if (!b.has(id)) L.push(`- ${k}: removed ${id}`);
    for (const [id, r] of b) if (a.has(id) && JSON.stringify(a.get(id)) !== JSON.stringify(r)) L.push(`- ${k}: ${id} changed${r.rung && a.get(id).rung !== r.rung ? ` (rung ${a.get(id).rung} -> ${r.rung})` : ""}${r.status && a.get(id).status !== r.status ? ` (${a.get(id).status || "entered"} -> ${r.status})` : ""}`);
  }
  return (L.length ? L.join("\n") : "No record changed; the export was rebuilt.") + "\n";
}

const snapshot = (data) => Object.fromEntries(["claims", "sources", "leads", "absent", "edges", "events"].map((k) => [k, data[k].map((r) => ({ id: r.id, text: r.text || r.question || r.what || r.url || null, rung: r.rung || null, status: r.status || null, source: r.source || null }))]));

// Writes a new version when the case changed. ctx.sign(bundle) -> signed bundle.
export async function writeExport(dataIn, profile, ctxIn) {
  // Carrier-safe: the records keep the day of each time only (dir stays the real folder).
  const data = ctxIn.carrier ? { ...dayOnlyDeep({ ...dataIn, dir: null }), dir: dataIn.dir } : dataIn;
  const ctx = ctxIn.carrier ? { ...ctxIn, at: dayOnly(ctxIn.at), tool: carrierTool(ctxIn.tool) } : ctxIn;
  const base = join(data.dir, "exports", profile), vs = versions(base);
  const state = caseStateHash(data, profile, ctx);
  const last = vs.length ? join(base, vs[vs.length - 1]) : null;
  const lastMeta = last && existsSync(join(last, "export.json")) ? JSON.parse(readFileSync(join(last, "export.json"), "utf8")) : null;
  if (lastMeta && lastMeta.state === state && !ctx.force) return { written: false, dir: last, version: vs[vs.length - 1] };
  const { files, redacted } = profileFiles(data, profile, ctx);
  const cleaned = ctx.clean ? await cleanExportFiles(data, files, ctx) : null;
  // The snapshot names accounts the same way the files do: up to 3.6 it carried claim text with
  // private handles unredacted into export.json and CHANGES.md.
  const snap = makeRedactor(data.actors, data.meta.salt, { forceAll: !!ctx.protection }).deep(snapshot(data));
  files["CHANGES.md"] = `# Changes since the previous export\n\n${changes(lastMeta && lastMeta.snapshot, snap)}`;
  files["export.json"] = JSON.stringify({ format: "daylight-case-export/1", profile, at: ctx.at, tool: ctx.tool, state, previous: lastMeta ? vs[vs.length - 1] : null, redacted_accounts: redacted, ...(cleaned ? { share_clean: { cleaned: cleaned.cleaned, kept_as_text: cleaned.text, withheld: cleaned.withheld } } : {}), ...(ctx.carrier ? { profile_note: CARRIER_SAFE_NOTE } : {}), snapshot: snap }, null, 2) + "\n";
  files.SHA256SUMS = sumsText(files);
  const bundle = await ctx.sign(exportBundle(data, profile, files, ctx));
  const version = `v${String(vs.length + 1).padStart(3, "0")}`, out = join(base, version);
  for (const [n, body] of Object.entries(files)) { mkdirSync(join(out, n, ".."), { recursive: true }); writeFileSync(join(out, n), body); }
  writeFileSync(join(out, BUNDLE_FILE), JSON.stringify(bundle, null, 2) + "\n");
  writeFileSync(join(base, "LATEST"), version + "\n");
  return { written: true, dir: out, version, files: [...Object.keys(files), BUNDLE_FILE].sort(), redacted, cleaned: cleaned ? cleaned.cleaned.length : 0, withheld: cleaned ? cleaned.withheld.length : 0 };
}

// Rehashes every file an export's bundle names. Signature checking is done by the caller with
// verifyBundle, so this stays synchronous and pure file work.
export function checkExportFiles(dir) {
  const bundle = JSON.parse(readFileSync(join(dir, BUNDLE_FILE), "utf8"));
  return bundle.evidence.map((e) => {
    if (!isWithin(dir, e.data.path)) return { file: e.data.path, ok: false, text: "points outside the export folder; not read" };
    const f = within(dir, e.data.path, "the export folder");
    const got = existsSync(f) ? sha256(readFileSync(f)) : null;
    return { file: e.data.path, ok: got === e.data.sha256, text: got === null ? "missing" : got === e.data.sha256 ? "matches" : "DOES NOT MATCH" };
  });
}
