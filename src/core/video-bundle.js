// A whole video save, as one bundle: the media file when the user chose it, the transcript in two
// forms, the chapters and metadata as one record ("<stem>.video.json", cmmns.video/1), the comment
// tree with replies and like counts ("<stem>.thread.json", src/core/capture-thread.js), and the
// bundle's SOURCE.txt and SHA256SUMS. The same bundle comes from the extension (from what the watch
// page loaded) and from `cmmns media fetch --full` (from yt-dlp). Pure: no DOM and no request.
// The media file is a local research copy: CMMNS never uploads, shares or publishes it.

import { clockOf } from "./video-transcript.js";

export const VIDEO_FORMAT = "cmmns.video/1";
export const MEDIA_COPY_NOTE = "The media file is a local research copy kept on this computer. CMMNS does not upload, share or publish it.";

const txt = (v) => (!v ? null : typeof v === "string" ? v : v.simpleText || v.content || (Array.isArray(v.runs) ? v.runs.map((r) => r.text).join("") : null));
const num = (v) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

function walk(json, visit, limit = 400000) {
  const stack = [json];
  for (let n = 0; stack.length && n < limit; n++) {
    const v = stack.pop();
    if (!v || typeof v !== "object") continue;
    visit(v);
    for (const k in v) if (v[k] && typeof v[k] === "object") stack.push(v[k]);
  }
}

// Chapters from the page's own data: macro markers (the description's chapter list) or the player's
// chapter bar. [{ start, title }] in seconds, by start, each once.
export function dataChapters(json) {
  const out = [];
  walk(json, (v) => {
    const m = v.macroMarkersListItemRenderer;
    if (m) {
      const s = num((((m.onTap || {}).watchEndpoint) || {}).startTimeSeconds);
      const title = txt(m.title);
      if (s != null && title) out.push({ start: s, title });
    }
    const c = v.chapterRenderer;
    if (c && c.timeRangeStartMillis != null && txt(c.title)) out.push({ start: Number(c.timeRangeStartMillis) / 1000, title: txt(c.title) });
  });
  const seen = new Set();
  return out.sort((a, b) => a.start - b.start).filter((c) => { const k = `${c.start} ${c.title}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

// YouTube writes a reply's id as "<parent id>.<reply id>".
const parentOf = (id) => (/^[\w-]+\.[\w-]+$/.test(String(id || "")) ? String(id).split(".")[0] : null);

// Comments from the page's own data (commentEntityPayload, and the older commentRenderer), as the
// flat records src/core/capture-thread.js turns into a tree. Each keeps its likes and reply count
// as the page showed them, and its parent, so a reply stays under the comment it answers.
export function pageComments(json, videoId = null) {
  const out = [];
  const link = (id) => (videoId ? `https://www.youtube.com/watch?v=${videoId}&lc=${id}` : null);
  walk(json, (v) => {
    const e = v.commentEntityPayload;
    if (e && e.properties && e.properties.commentId) {
      const p = e.properties, a = e.author || {}, t = e.toolbar || {}, pub = String(p.publishedTime || "");
      out.push({ id: p.commentId, parent: parentOf(p.commentId), author: a.displayName || null, text: txt(p.content), score: t.likeCountNotliked || t.likeCountA11y || null,
        timeShown: pub.replace(/\s*\(edited\)/, "") || null, edited: /\(edited\)/.test(pub), replies: t.replyCount || null, permalink: link(p.commentId) });
    }
    const c = v.commentRenderer;
    if (c && c.commentId) {
      const pub = String(txt(c.publishedTimeText) || "");
      out.push({ id: c.commentId, parent: parentOf(c.commentId), author: txt(c.authorText), text: txt(c.contentText), score: txt(c.voteCount),
        timeShown: pub.replace(/\s*\(edited\)/, "") || null, edited: /\(edited\)/.test(pub), replies: c.replyCount ?? null, permalink: link(c.commentId) });
    }
  });
  return out;
}

// Comments from yt-dlp's info (--write-comments), in the same flat shape. "root" is yt-dlp's word
// for a top comment.
export function ytDlpComments(info) {
  const vid = info && info.id;
  return ((info && info.comments) || []).map((c) => ({ id: c.id, parent: c.parent && c.parent !== "root" ? c.parent : null, author: c.author || null, text: c.text || "",
    score: c.like_count ?? null, postedAt: c.timestamp ?? null, timeShown: c._time_text || null, edited: c.is_edited === true,
    permalink: vid && c.id ? `https://www.youtube.com/watch?v=${vid}&lc=${c.id}` : null, flair: [c.is_pinned ? "pinned" : null, c.author_is_uploader ? "channel owner" : null].filter(Boolean).join(", ") || null }));
}

// The record a reader indexes: what the video is, who posted it, its chapters and captions, and
// which files the bundle holds. m: { id, url, title, channel, channelUrl, handle, published,
// duration, views, likes, comments, description, chapters, captions: { lang, kind, from },
// segments, media, source, tool, savedAt, info (src/core/ytdata.js ytVideoInfo) }.
export function videoRecord(m = {}) {
  return {
    format: VIDEO_FORMAT, site: m.site || "youtube", id: m.id || null, url: m.url || null, title: m.title || null,
    channel: m.channel || null, channelUrl: m.channelUrl || null, handle: m.handle || null, published: m.published || null,
    duration: num(m.duration), views: num(m.views), likes: num(m.likes), commentsCounted: num(m.comments),
    description: m.description || null, tags: (m.tags || []).slice(0, 100),
    chapters: (m.chapters || []).map((c) => ({ start: num(c.start) ?? 0, at: clockOf(c.start), title: String(c.title || "") })),
    captions: m.captions ? { lang: m.captions.lang || null, kind: m.captions.kind || null, from: m.captions.from || null, segments: num(m.segments) } : null,
    page: m.info || null, media: m.media ? { file: m.media, note: MEDIA_COPY_NOTE } : null,
    source: m.source || null, tool: m.tool || "CMMNS", savedAt: m.savedAt || new Date().toISOString(),
  };
}

// The chapters as lines for the sidecar note ("00:01:35 Silica").
export const chapterLines = (chapters) => (chapters || []).map((c) => `${clockOf(c.start)} ${c.title}`);

// SOURCE.txt: where the bundle came from, how it was read, and what it holds.
export function sourceText({ url, title = null, channel = null, savedAt = new Date().toISOString(), how, files = [], media = null } = {}) {
  const lines = [`Source: ${url}${title || channel ? ` (${[channel, title].filter(Boolean).join(", ")})` : ""}`, `Saved: ${savedAt}`, `How: ${how}`,
    `Media file: ${media ? `${media}. ${MEDIA_COPY_NOTE}` : "not saved (the user's choice for this save, or none was available)"}`, "Files:", ...files.map((f) => `- ${f}`)];
  return lines.join("\n") + "\n";
}

// SHA256SUMS in the sha256sum form ("<hex> *<name>"), in the order given. entries: [{ name, sha256 }].
export const sha256Sums = (entries) => entries.filter((e) => e && e.name && /^[0-9a-f]{64}$/.test(e.sha256 || "")).map((e) => `${e.sha256} *${e.name}`).join("\n") + "\n";
