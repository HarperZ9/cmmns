// Study boards: saved items gathered into numbered plates that keep each item's source, author, time
// and link (project-docs/STUDY-BOARDS.md). One format with the reference library's `refdb board`:
// refdb.board/1 ({ format, kind, key, running_head: { left, right }, lane, keyword_line, plates: [{ n,
// unit, item_ids, media: [{ id, kind, path }], caption, medium, concepts }], also_in, sources }), so
// Daylight, the command line and the site render the same boards. Daylight's plates add `source`, the
// sidecar's facts. 3.6.0 moodboards become boards of kind "moodboard". Pure: no files, no network.

import { corroboration } from "./claim-checks.js";

export const BOARD_FORMAT = "refdb.board/1";
export const LAYOUTS = ["book", "grid", "timeline", "evidence"];
// The face for running heads and titles: one choice among the shipped faces, never a fixed house look.
export const HEAD_FACES = ["grotesk", "accession", "mono"];
export const LANES = ["design", "research", "journalism", "sound", "writing", "film", "science", "history"];

// A sidecar's front matter and the parts of its body a plate needs (daylight.sidecar/1).
export function parseSidecar(md) {
  const s = String(md || "").replace(/\r\n?/g, "\n");
  if (!s.startsWith("---\n")) return null;
  const end = s.indexOf("\n---\n", 4);
  if (end < 0) return null;
  const front = {};
  for (const line of s.slice(4, end).split("\n")) {
    const i = line.indexOf(": ");
    if (i <= 0) continue;
    try { front[line.slice(0, i)] = JSON.parse(line.slice(i + 2)); } catch { front[line.slice(0, i)] = line.slice(i + 2); }
  }
  if (!String(front.format || "").startsWith("daylight.sidecar/")) return null;
  const body = s.slice(end + 5).split("\n");
  const quote = [];
  for (let i = body.findIndex((l) => l.startsWith(">")); i >= 0 && i < body.length && body[i].startsWith(">"); i++) quote.push(body[i].replace(/^> ?/, ""));
  const line = (p) => (body.find((l) => l.startsWith(p)) || "").slice(p.length) || null;
  const title = ((body.find((l) => /^\*\*.+\*\*$/.test(l)) || "").replace(/^\*\*|\*\*$/g, "")) || null;
  return { front, text: quote.length ? quote.join("\n") : null, alt: line("Alt text: "), title, note: line("What draws me to this: ") };
}

// refdb media kinds: still, motion, audio, text.
const KINDS = { jpg: "still", jpeg: "still", png: "still", webp: "still", avif: "still", svg: "still", gif: "motion", mp4: "motion", webm: "motion", mov: "motion", m4a: "audio", mp3: "audio", ogg: "audio", opus: "audio", wav: "audio" };
export const mediaKind = (file) => (file ? KINDS[String(file).split(".").pop().toLowerCase()] || "file" : "text");
const MEDIUM = { still: "visual", motion: "visual", audio: "sound", text: "text", file: "visual" };

// A plate's facts from its sidecar.
function sourceOf(sc, file, sha256, k, count, note) {
  const f = sc.front;
  return { site: f.site || null, handle: f.handle || null, author: f.author || null, posted: f.posted || null, saved: f.saved || null,
    post: f.post || f.page || null, media: f.media || null, title: sc.title || null, text: sc.text || null, alt: sc.alt || null,
    item: count > 1 ? `${k + 1} of ${count}` : null, study: !!f.study, note: note || sc.note || f.note || null, sha256: sha256 || null,
    reach: f.engagement && f.engagement.views != null ? f.engagement.views : null };
}

// entries: [{ sidecar: parseSidecar(), sidecarName, files: [names], sha256: { name: hex }, note }]
function platesOf(entry) {
  const files = entry.files && entry.files.length ? entry.files : [null];
  return files.map((file, k) => {
    const kind = mediaKind(file), source = sourceOf(entry.sidecar, file, (entry.sha256 || {})[file], k, files.length, entry.note);
    return { unit: entry.sidecarName || null, item_ids: file ? [file] : [], media: file ? [{ id: file, kind, path: file }] : [],
      caption: captionLine(source), medium: MEDIUM[kind], concepts: [], source };
  });
}

const words = (v) => [...new Set((Array.isArray(v) ? v : String(v || "").split(",")).map((w) => String(w).trim()).filter(Boolean))].slice(0, 8);

// The board. opts: { title, lane, keywords, layout, kind, key, created }.
export function boardFrom(entries, { title = "Study board", lane = "research", keywords = [], layout = "book", head = "grotesk", kind = "saves", key = null, created = new Date().toISOString() } = {}) {
  const plates = entries.filter((e) => e && e.sidecar).flatMap(platesOf).map((p, i) => ({ n: i + 1, ...p }));
  const t = String(title).slice(0, 120), l = String(lane || "research").slice(0, 60);
  return { format: BOARD_FORMAT, kind, key: key || t, running_head: { left: t, right: l.toUpperCase() }, lane: l, keyword_line: words(keywords),
    plates, also_in: { documents: 0, units: 0 }, sources: { daylight: { from: "saves" } }, layout: LAYOUTS.includes(layout) ? layout : "book", head: HEAD_FACES.includes(head) ? head : "grotesk", created };
}

// A 3.6.0 moodboard (src/ext/media-store.js: the board and its records) as a board.
export function boardFromMoodboard(mb, records, { layout = "grid", created = new Date().toISOString() } = {}) {
  const plates = records.map((r, i) => {
    const kind = r.kind === "gif" || r.kind === "video" ? "motion" : r.kind === "audio" ? "audio" : "still";
    const source = { site: (() => { try { return new URL(r.source.page || r.source.url).hostname.replace(/^www\./, ""); } catch { return null; } })(),
      handle: null, author: null, posted: null, saved: r.source.savedAt || null, post: r.source.page || r.source.url || null, media: r.source.url || null,
      title: r.source.pageTitle || null, text: null, alt: r.source.alt || null, item: null, study: false, note: r.note || null, sha256: r.sha256 || null, reach: null };
    return { n: i + 1, unit: r.id, item_ids: [r.id], media: [{ id: r.id, kind, path: r.sha256 }], caption: captionLine(source), medium: MEDIUM[kind], concepts: r.tags || [], source };
  });
  return { format: BOARD_FORMAT, kind: "moodboard", key: mb.id, running_head: { left: mb.name, right: "MOODBOARD" }, lane: "moodboard",
    keyword_line: words([...new Set(records.flatMap((r) => r.tags || []))]), plates, also_in: { documents: 0, units: 0 }, sources: { daylight: { from: "moodboard", id: mb.id } }, layout, created };
}

const SITE_NAMES = { x: "X", reddit: "Reddit", youtube: "YouTube", bluesky: "Bluesky" };
function captionLine(s) {
  const first = String(s.title || s.text || s.alt || "").split("\n").find((l) => l.trim()) || "";
  return first.length > 140 ? first.slice(0, 139).replace(/\s+\S*$/, "") + " …" : first;
}

// The caption: from the plate's source when it has one (Daylight), else the spec's own caption (refdb).
export function plateCaption(p) {
  const s = p.source;
  if (!s) return { meta: [p.medium, (p.concepts || []).slice(0, 4).join(", ")].filter(Boolean).join(", "), line: p.caption || "" };
  const who = [s.author, s.handle ? (/^u\//.test(s.handle) ? s.handle : "@" + s.handle) : null].filter((x, i, a) => x && a.indexOf(x) === i).join(" ");
  return { meta: [who, SITE_NAMES[s.site] || s.site, s.posted ? s.posted.slice(0, 10) : null, s.item].filter(Boolean).join(", "), line: p.caption || captionLine(s) };
}

// Book pages: one plate per page; left pages carry the running head's left, right pages its right.
export function bookPages(board) {
  return board.plates.map((plate, i) => ({ side: i % 2 ? "right" : "left", head: i % 2 ? board.running_head.right : board.running_head.left, plate, folio: i + 1, keywords: board.keyword_line }));
}

// A plate's time on the timeline: when it was posted, else when it was saved (moodboard items).
const posted = (p) => Date.parse((p.source && (p.source.posted || p.source.saved)) || "");

// Timeline: plates in posted order (undated last), with breaks where the gap is at least three times
// the median gap and at least a day. [{ plate } | { gap: { from, to, days } }]
export function timelineRows(plates) {
  const dated = plates.filter((p) => Number.isFinite(posted(p))).sort((a, b) => posted(a) - posted(b));
  const gaps = dated.slice(1).map((p, i) => posted(p) - posted(dated[i]));
  const median = gaps.length ? [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)] : 0;
  const rows = [];
  dated.forEach((p, i) => {
    if (i && gaps[i - 1] >= Math.max(3 * median, 86400000)) rows.push({ gap: { from: dated[i - 1].source.posted, to: p.source.posted, days: Math.round(gaps[i - 1] / 8640000) / 10 } });
    rows.push({ plate: p });
  });
  for (const p of plates.filter((x) => !dated.includes(x))) rows.push({ plate: p, undated: true });
  return rows;
}

// The sheet model shared with the analysis view and the site: a claim laid over its sources, each
// layer's opacity from its reach (views as the page showed them), on a log scale, so a widely seen
// claim covers a little-seen correction as it does in the feed. Unknown reach reads as faint.
export function sheetOpacity(reach, max) {
  if (!(reach > 0) || !(max > 0)) return 0.25;
  return Math.round((0.25 + 0.75 * Math.log1p(reach) / Math.log1p(max)) * 100) / 100;
}

const norm = (u) => String(u || "").replace(/^https?:\/\/(www\.|mobile\.)?/, "").replace(/twitter\.com/, "x.com").replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();

// Evidence: plates matched to a case's sources by address; each claim a sheet over its source plates.
// caseData: loadCase() ({ sources, claims }). { sheets: [{ claim, layers: [{ plate, source, opacity }] }], unmatched }.
export function evidencePlan(plates, caseData) {
  const sources = (caseData && caseData.sources) || [], claims = (caseData && caseData.claims) || [];
  const plateOf = new Map();
  for (const p of plates) { const s = sources.find((x) => x.url && norm(x.url) === norm(p.source && (p.source.post || p.source.media))); if (s) plateOf.set(s.id, p); }
  const max = Math.max(0, ...plates.map((p) => Number((p.source && p.source.reach) || 0)));
  const sheets = claims.map((c) => {
    const layers = String(c.source || "").split(/[,\s]+/).filter(Boolean).map((id) => ({ id, plate: plateOf.get(id) || null }))
      .filter((l) => l.plate).map((l) => ({ source: l.id, plate: l.plate, opacity: sheetOpacity(Number(l.plate.source.reach || 0), max) }))
      .sort((a, b) => b.opacity - a.opacity);
    // Provenance: how far each source is corroborated by the claim's other sources from other origins.
    const cor = corroboration(layers.map((l) => ({ id: l.source, url: l.plate.source.post || l.plate.source.media, handle: l.plate.source.handle })));
    layers.forEach((l, i) => { l.corroborated_by = cor[i].corroborated_by; l.provenance_opacity = cor[i].opacity; });
    return { claim: { id: c.id, text: c.text, rung: c.rung }, layers };
  }).filter((s) => s.layers.length);
  const used = new Set(sheets.flatMap((s) => s.layers.map((l) => l.plate.n)));
  return { sheets, unmatched: plates.filter((p) => !used.has(p.n)).map((p) => p.n) };
}
