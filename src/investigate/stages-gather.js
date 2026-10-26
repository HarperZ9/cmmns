// `case run` stages 1 to 5: ingest the seeds, capture every source, archive it, extract claims,
// and look for the primary record behind each claim. Every row a stage item writes carries that
// item's tag, so a crashed item is purged and run again cleanly.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { within, isWithin } from "./paths.js";
import { addSource } from "./add.js";
import { addRow, updateRow, byId } from "./store.js";
import { sha256, xPostId } from "./capture.js";
import { requestSnapshot } from "./wayback.js";
import { transcribe, postFacts, screenshotPost } from "./ingest.js";
import { ruleClaims, modelClaims } from "./extract.js";
import { shingleSimilarity } from "./diff.js";
import { linksIn, primaryKind, leadFor, modelQueries } from "./primary.js";

export const MAX_THREAD_DEPTH = 5, MAX_PRIMARY_LINKS = 3, MAX_LEADS_PER_SOURCE = 3;

export function enqueue(state, url, depth, from) {
  if (!state.queue.some((q) => q.url === url)) state.queue.push({ url, depth, from });
}

function ensureActor(dir, data, handle, tag) {
  if (data.actors.some((a) => String(a.handle).toLowerCase() === handle.toLowerCase())) return;
  addRow(dir, "actors", { handle, name: null, public_figure: false, note: "seen in a screenshot", run_item: tag });
  data.actors.push({ handle });
}

async function ingestScreenshot(ctx, seed, tag) {
  const { source } = await addSource(ctx.dir, seed.path, { tag, now: ctx.now, what: "screenshot supplied by the investigator" });
  const tr = transcribe(seed.path, await ctx.ocr());
  if (!tr) {
    updateRow(ctx.dir, "sources", source.id, (r) => ({ ...r, kind: "screenshot" }));
    addRow(ctx.dir, "proposals", { kind: "transcription", source: source.id, status: "proposed", note: `needs transcription: write ${basename(seed.path)}.txt beside the image, then run again`, run_item: tag });
    return "needs transcription";
  }
  writeFileSync(within(ctx.dir, source.capture.text_file), tr.text);
  const post = screenshotPost(tr.text);
  updateRow(ctx.dir, "sources", source.id, (r) => ({ ...r, kind: "screenshot", author: post.author, source_date: post.date, read_mode: `screenshot supplied by the investigator; text by ${tr.method}`, capture: { ...r.capture, text_sha256: sha256(Buffer.from(tr.text, "utf8")) }, transcription: { method: tr.method, confidence: tr.confidence } }));
  const facts = postFacts(tr.text), data = ctx.data();
  addRow(ctx.dir, "posts", { screenshot: basename(seed.path), sha256: source.capture.sha256, source: source.id, text: tr.text, handles: facts.handles, urls: facts.urls, method: tr.method, confidence: tr.confidence, run_item: tag });
  for (const u of facts.urls) enqueue(ctx.state, u, 0, source.id);
  for (const h of facts.handles) ensureActor(ctx.dir, data, h, tag);
  return `transcribed by ${tr.method}`;
}

function ingestClaim(ctx, seed, tag) {
  const s = addRow(ctx.dir, "sources", { kind: "seed-claim", url: null, file: null, title: "claim given as the seed", what: seed.text, accessed: ctx.now(), read_mode: "typed by the investigator", capture: { file: null, sha256: sha256(Buffer.from(seed.text, "utf8")), text_file: null }, archive: { service: null, note: "nothing to archive" }, run_item: tag });
  addRow(ctx.dir, "claims", { text: seed.text, source: s.id, rung: "unproven", retells: null, corroborates: null, self_sourced: false, date: null, key: null, accepted_by: "the investigator (seed)", added: ctx.now(), run_item: tag });
  return "claim recorded";
}

export const ingest = {
  name: "ingest",
  items: (ctx) => ctx.state.seeds.map((s) => ({ key: s.key, seed: s })),
  async run(ctx, { seed }, tag) {
    if (seed.type === "screenshot") return ingestScreenshot(ctx, seed, tag);
    if (seed.type === "claim") return ingestClaim(ctx, seed, tag);
    if (seed.type === "url") { enqueue(ctx.state, seed.url, 0, "seed"); return "queued"; }
    await addSource(ctx.dir, seed.path, { tag, now: ctx.now });
    return "file captured";
  },
};

const postUrl = (author, id) => `https://x.com/${author ? author.replace(/^@/, "") : "i"}/status/${id}`;

export const capture = {
  name: "capture",
  items: (ctx) => ctx.state.queue.map((q) => ({ key: q.url, ...q })),
  async run(ctx, q, tag) {
    if (ctx.data().sources.some((s) => s.url === q.url)) return "already captured";
    let r;
    try { r = await addSource(ctx.dir, q.url, { tag, now: ctx.now, fetchFn: ctx.fetchFn, archive: false, protection: !!ctx.opts.protection, tier: q.tier }); } catch (e) { ctx.state.failed[q.url] = e.message; return `failed: ${e.message}`; }
    const p = r.source.post;
    if (p && !p.deleted && xPostId(q.url) && q.depth < MAX_THREAD_DEPTH) {
      if (p.in_reply_to) enqueue(ctx.state, postUrl(p.in_reply_to.author, p.in_reply_to.id), q.depth + 1, r.source.id);
      if (p.quoted) enqueue(ctx.state, postUrl(p.quoted.author, p.quoted.id), q.depth + 1, r.source.id);
    }
    return `captured as ${r.source.id}`;
  },
};

export const archive = {
  name: "archive",
  items: (ctx) => (ctx.opts.archive !== true || ctx.opts.protection ? [] : ctx.data().sources.filter((s) => s.url && !(s.archive && (s.archive.url || s.archive.attempts))).map((s) => ({ key: s.id, id: s.id, url: s.url }))),
  async run(ctx, s) {
    const a = await requestSnapshot(s.url, { fetchFn: ctx.fetchFn, sleep: ctx.sleep, now: ctx.now });
    updateRow(ctx.dir, "sources", s.id, (r) => ({ ...r, archive: { service: "Wayback Machine", ...a } }));
    return a.url ? `archived ${a.url}` : `no snapshot: ${a.error}`;
  },
};

const yearOf = (s, meta) => Number(String(s.source_date || meta.created || "").slice(0, 4)) || new Date().getUTCFullYear();

export const claims = {
  name: "claims",
  items: (ctx) => ctx.data().sources.filter((s) => s.capture && s.capture.text_file && isWithin(ctx.dir, s.capture.text_file) && existsSync(within(ctx.dir, s.capture.text_file))).map((s) => ({ key: s.id, id: s.id })),
  async run(ctx, { id }, tag) {
    const data = ctx.data(), s = byId(data.sources).get(id), raw = readFileSync(within(ctx.dir, s.capture.text_file), "utf8");
    const text = s.kind === "screenshot" ? screenshotPost(raw).body : raw;
    const year = yearOf(s, data.meta);
    const got = ctx.model ? (await modelClaims(ctx.model, id, text, { year })).claims : ruleClaims(id, text, { year, max: s.kind === "web" ? 12 : 6 });
    const mine = [];
    for (const c of got) {
      if (mine.some((m) => shingleSimilarity(m, c.text) >= 0.9)) continue;
      mine.push(c.text);
      addRow(ctx.dir, "claims", { text: c.text, source: id, rung: "unproven", status: "proposed", proposed_by: ctx.model ? ctx.model.name : "rules", spans: c.spans, date: c.date, retells: null, corroborates: null, self_sourced: false, key: null, added: ctx.now(), run_item: tag });
    }
    return `${mine.length} claims proposed`;
  },
};

async function followPrimary(ctx, src, tag) {
  const f = src.capture && src.capture.file ? within(ctx.dir, src.capture.file) : null;
  if (!f || !existsSync(f)) return [];
  const links = linksIn(readFileSync(f)).filter((u) => u !== src.url && primaryKind(u)).slice(0, MAX_PRIMARY_LINKS), out = [];
  for (const u of links) {
    const have = ctx.data().sources.find((s) => s.url === u);
    if (have) { out.push(have.id); continue; }
    if (ctx.opts.followPrimary === false || ctx.opts.protection) continue;
    try { out.push((await addSource(ctx.dir, u, { tag, now: ctx.now, fetchFn: ctx.fetchFn, archive: false, tier: `primary record candidate (${primaryKind(u).kind})` })).source.id); } catch (e) { ctx.state.failed[u] = e.message; }
  }
  return out;
}

export const primary = {
  name: "primary",
  items: (ctx) => ctx.data().claims.filter((c) => c.status !== "rejected").map((c) => ({ key: c.id, id: c.id })),
  async run(ctx, { id }, tag) {
    const data = ctx.data(), c = byId(data.claims).get(id), src = byId(data.sources).get(c.source.split(",")[0]);
    const found = src ? await followPrimary(ctx, src, tag) : [];
    if (found.length) { updateRow(ctx.dir, "claims", id, (r) => ({ ...r, primary: found })); return `primary candidates ${found.join(", ")}`; }
    if (data.leads.filter((l) => l.proposed_by === "rules" && (l.claims || []).some((x) => (byId(data.claims).get(x) || {}).source === c.source)).length >= MAX_LEADS_PER_SOURCE) return "lead cap for this source reached";
    addRow(ctx.dir, "leads", { ...leadFor(c), proposed_by: "rules", review: "proposed", run_item: tag });
    if (ctx.model) for (const q of await modelQueries(ctx.model, c)) addRow(ctx.dir, "proposals", { kind: "record-query", claim: id, ...q, status: "proposed", proposed_by: ctx.model.name, run_item: tag });
    return "lead proposed";
  },
};
