// `case run` stages 6 to 12: link retellings and count origins, build the timeline and network,
// rank leads, log absences, run the Reading lens, and export the dossier in every profile. These
// stages are deterministic; only the optional summary in the export stage uses a model.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { addRow, byId, writeJsonl, TABLES } from "./store.js";
import { sha256 } from "./capture.js";
import { contentWords, overlapSimilarity } from "./diff.js";
import { buildTimeline } from "./timeline.js";
import { buildNetwork, networkHtml } from "./network.js";
import { rankLeads } from "./records.js";
import { readCase } from "./read.js";
import { writeExport, PROFILES, caseStateHash } from "./export.js";
import { newsroomMarkdown } from "./dossier.js";
import { PROMPTS } from "./models.js";

export const RETELL_THRESHOLD = 0.6, RETELL_MIN_WORDS = 5;
const hashOf = (x) => sha256(Buffer.from(JSON.stringify(x))).slice(0, 16);
const derived = (dir, name, body) => { mkdirSync(join(dir, "derived"), { recursive: true }); writeFileSync(join(dir, "derived", name), body); };

// Links each machine-proposed claim to the closest earlier claim from another source when most of
// the shorter claim's content words appear in the other (word order aside). Earlier means an
// earlier source date; undated sources come last. A person's own links are never changed.
export function autoLink(data, threshold = RETELL_THRESHOLD) {
  const sources = byId(data.sources);
  // A primary record is an origin, so it sorts before any retelling of it.
  const when = (c) => { const s = sources.get(c.source.split(",")[0]) || {}; return /^primary record/.test(s.tier || "") ? "0000" : s.source_date || "9999"; };
  const live = data.claims.filter((c) => c.status !== "rejected" && contentWords(c.text).size >= RETELL_MIN_WORDS);
  const order = [...live].sort((a, b) => (when(a) < when(b) ? -1 : when(a) > when(b) ? 1 : a.id < b.id ? -1 : 1));
  const links = new Map();
  order.forEach((c, i) => {
    if (c.retells && c.retells_by !== "rules") return;
    if (c.status !== "proposed" && !c.retells_by) return;
    let best = null;
    for (const p of order.slice(0, i)) {
      if (p.source === c.source) continue;
      const s = overlapSimilarity(p.text, c.text);
      if (s >= threshold && (!best || s > best.s)) best = { id: p.id, s };
    }
    links.set(c.id, best);
  });
  return data.claims.map((c) => (links.has(c.id) ? (links.get(c.id) ? { ...c, retells: links.get(c.id).id, retells_by: "rules", retells_similarity: Number(links.get(c.id).s.toFixed(3)) } : (() => { const { retells_by, retells_similarity, ...rest } = c; return { ...rest, retells: retells_by === "rules" ? null : c.retells }; })()) : c));
}

const once = (name, keyFn, work) => ({ name, items: (ctx) => [{ key: keyFn(ctx.data()) }], run: (ctx) => work(ctx) });

export const trace = once("trace", (d) => hashOf(d.claims.map((c) => [c.id, c.text, c.status, c.source])), (ctx) => {
  const data = ctx.data(), out = autoLink(data);
  writeJsonl(join(ctx.dir, TABLES.claims[0]), out);
  return `${out.filter((c) => c.retells_by === "rules").length} retellings linked`;
});

export const timeline = once("timeline", (d) => hashOf([d.events, d.sources.map((s) => s.source_date), d.claims.map((c) => [c.id, c.date, c.status])]), (ctx) => {
  const t = buildTimeline(ctx.data());
  derived(ctx.dir, "timeline.json", JSON.stringify(t, null, 2) + "\n");
  return `${t.events.length} events, ${t.flags.length} flags`;
});

const authorOf = (s) => s.author || null;
export const network = {
  name: "network",
  items: (ctx) => ctx.data().sources.filter((s) => authorOf(s) && s.capture && s.capture.text_file).map((s) => ({ key: s.id, id: s.id })),
  run(ctx, { id }, tag) {
    const data = ctx.data(), s = byId(data.sources).get(id), f = join(ctx.dir, s.capture.text_file);
    const text = existsSync(f) ? readFileSync(f, "utf8") : "";
    const handles = [...new Set((text.match(/(?<![\w@])@[A-Za-z0-9_]{1,15}\b/g) || []))].filter((h) => h.toLowerCase() !== s.author.toLowerCase());
    for (const h of handles) addRow(ctx.dir, "edges", { from: s.author, to: h, type: "mention", source: id, run_item: tag });
    const n = buildNetwork(ctx.data());
    derived(ctx.dir, "network.json", JSON.stringify(n, null, 2) + "\n");
    derived(ctx.dir, "network.html", networkHtml(n, `${data.meta.name}: network`));
    return `${handles.length} mentions`;
  },
};

export const leads = once("leads", (d) => hashOf([d.leads, d.claims.map((c) => [c.id, c.rung])]), (ctx) => {
  const list = rankLeads(ctx.data());
  derived(ctx.dir, "leads.json", JSON.stringify(list, null, 2) + "\n");
  return `${list.length} leads ranked`;
});

const absenceOf = (reason) => (/login|sign-in|credentials|password/i.test(reason) ? "withheld" : "missing");
export const absences = {
  name: "absences",
  // A failure in a replay means the replay holds no recording, which says nothing about the record.
  items: (ctx) => Object.keys(ctx.state.failed).filter((u) => !/^replay:/.test(ctx.state.failed[u])).sort().map((url) => ({ key: url, url })),
  run(ctx, { url }, tag) {
    let host = url;
    try { host = new URL(url).hostname; } catch { /* keep the address */ }
    const reason = ctx.state.failed[url];
    addRow(ctx.dir, "absent", { what: `capture of ${url}`, status: absenceOf(reason), custodian: host, source: null, noted: ctx.now(), note: reason, run_item: tag });
    return absenceOf(reason);
  },
};

export const reading = once("read", (d) => hashOf(d.sources.map((s) => [s.id, s.capture && s.capture.text_sha256])), (ctx) => {
  if (!ctx.analyze) return "skipped: no analyser";
  const r = readCase(ctx.data(), ctx.analyze);
  derived(ctx.dir, "reading.json", JSON.stringify(r, null, 2) + "\n");
  return `${r.rows.filter((x) => x.read).length} sources read`;
});

async function summaryFor(ctx, data, extra) {
  const have = data.proposals.filter((p) => p.kind === "summary" && p.status !== "rejected").pop();
  if (have || !ctx.model) return have || null;
  const text = (await ctx.model.complete(PROMPTS.summary(newsroomMarkdown(data, { ...extra, at: ctx.now() }).slice(0, 20000)))).trim();
  return text ? addRow(ctx.dir, "proposals", { kind: "summary", text, status: "proposed", proposed_by: ctx.model.name }) : null;
}

export const exportStage = {
  name: "export",
  items: (ctx) => { const d = ctx.data(); return PROFILES.map((p) => ({ key: `${p}:${caseStateHash(d, p)}`, profile: p })); },
  async run(ctx, { profile }) {
    const data = ctx.data(), f = join(ctx.dir, "derived", "reading.json");
    const extra = { reading: existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null };
    extra.summary = await summaryFor(ctx, data, extra);
    const r = await writeExport(ctx.data(), profile, { ...extra, at: ctx.now(), tool: ctx.tool, sign: ctx.sign, history: ctx.history ? ctx.history() : null });
    return r.written ? `wrote ${r.version}` : `unchanged (${r.version})`;
  },
};
