// Save all likes (project-docs/SAVE-ALL-LIKES.md): the kernels both halves of the pipeline share.
// Discovery runs in the page (src/ext/likes.js) and reads only the responses X already sent it, or the
// like.js file of X's own data archive. Fetching runs in the page or, faster, in the command line
// (`cmmns likes fetch`, bin/lib/likes.mjs), which reads the manifest the page writes. Every stage is a
// small pure function with one input and one output, in this order: parse, pick, dedupe, name, then
// (outside this module, because they do I/O) fetch, hash, sidecar. STAGES names them for the timing
// table both halves print, so the slowest stage is visible.
import { tweetsIn } from "./xdata.js";
import { postMeta, metaName } from "./media-meta.js";

export const LIKES_FORMAT = "cmmns.likes/1";
export const LIKES_SOURCE = "x-likes";
export const STAGES = Object.freeze(["parse", "pick", "dedupe", "name", "fetch", "hash", "sidecar"]);

// Is this X's likes list? By address (x.com/i/history/likes since October 2026, x.com/<user>/likes
// before), else by the page's structure: the History title with a selected Likes tab, so a future move
// of the address does not break it. Returns { site, kind, user } or null.
export function likesRoute(href, page = {}) {
  let u;
  try { u = new URL(href); } catch { return null; }
  if (!/^(x|twitter|mobile\.x|mobile\.twitter)\.com$/.test(u.hostname.replace(/^www\./, ""))) return null;
  const parts = u.pathname.split("/").filter(Boolean);
  if (parts[0] === "i" && parts[1] === "history" && parts[2] === "likes" && parts.length === 3) return { site: "x", kind: "likes", user: null };
  if (parts.length === 2 && parts[1] === "likes" && /^[A-Za-z0-9_]{1,15}$/.test(parts[0]) && parts[0] !== "i") return { site: "x", kind: "likes", user: parts[0] };
  const tab = String(page.selectedTab || "").trim().toLowerCase();
  if (/^history\b/i.test(String(page.title || "")) && tab === "likes") return { site: "x", kind: "likes", user: null };
  return null;
}

// parse: X's JSON -> posts. Only posts with an id; X's own fields, as tweetsIn reads them.
export function parseLikes(json) {
  return tweetsIn(json).filter((t) => t.id && !t.repostOf).map((t) => ({ id: t.id, handle: t.author || null, posted: t.posted || null,
    text: t.fullText || t.text || null, media: t.media || [], links: t.links || [], lang: t.lang || null }));
}

// pick: one media entry -> the file to fetch, in one pass. Pictures at name=orig (X's original),
// videos and GIFs at the highest-bitrate MP4 X listed. A video X listed only as a stream has no
// single file here: { kind: "video", url: null, hls } and the page's own saver puts it together.
export function pickLikeFile(m) {
  if (!m) return null;
  if (m.type === "photo") {
    const x = /^(https:\/\/pbs\.twimg\.com\/media\/[\w-]+)(?:\.(\w+))?(?:\?(.*))?$/.exec(String(m.url || ""));
    if (!x) return m.url ? { kind: "image", url: m.url, ext: "jpg" } : null;
    const ext = (x[2] || new URLSearchParams(x[3] || "").get("format") || "jpg").toLowerCase();
    return { kind: "image", url: `${x[1]}?format=${ext}&name=orig`, ext };
  }
  if (m.mp4) return { kind: m.type === "animated_gif" ? "gif" : "video", url: m.mp4, ext: "mp4" };
  return m.hls ? { kind: "video", url: null, hls: m.hls, ext: "mp4" } : null;
}

// dedupe: the known set holds "x:<post id>" for every post already saved anywhere in the CMMNS folder
// and "sha256:<hex>" for every file. One Set lookup, before any request.
export const postKey = (id) => `x:${id}`;
export const isKnown = (known, id) => known.has(postKey(id));

// The post's sidecar record, the same one a one-click save writes, marked as coming from the likes.
export function likeMeta(post, i = 0, total = 1, now = new Date().toISOString()) {
  return { ...postMeta({ site: "x", handle: post.handle, text: post.text, postedAt: post.posted, postUrl: post.handle ? `https://x.com/${post.handle}/status/${post.id}` : `https://x.com/i/status/${post.id}`,
    links: post.links, index: i, total, kind: (post.media || post.files || []).length ? "media" : "text", from: LIKES_SOURCE }, now) };
}

// name: post + file -> the file name a library save would give it (src/ext/library.js), the post id
// at the end, so the page and the command line write the same name for the same file.
export function fileName(post, file, i, total) { return metaName(likeMeta(post, i, total), file.ext, post.id); }
export const sidecarName = (post) => metaName({ ...likeMeta(post), item: null }, "md", post.id);

// One manifest line for a post: what to fetch and what to call it. files whose url is null are
// listed under streams for the page's saver.
export function manifestLine(post, seen = new Date().toISOString()) {
  const picked = (post.media || []).map(pickLikeFile).filter(Boolean), total = picked.length;
  const files = picked.map((f, i) => (f.url ? { url: f.url, kind: f.kind, name: fileName(post, f, i, total) } : null)).filter(Boolean);
  const streams = picked.filter((f) => !f.url).map((f) => f.hls);
  return { format: LIKES_FORMAT, id: String(post.id), handle: post.handle, posted: post.posted, text: post.text, links: post.links || [], files, sidecar: sidecarName(post),
    ...(streams.length ? { streams } : {}), seen };
}

// The manifest, written whole (a browser cannot append to a file): one JSON line per post.
export const manifestText = (lines) => lines.map((l) => JSON.stringify(l)).join("\n") + (lines.length ? "\n" : "");
export function parseManifest(text) {
  const out = [];
  for (const l of String(text || "").split(/\r?\n/)) { if (!l.trim()) continue; try { const j = JSON.parse(l); if (j && j.id && Array.isArray(j.files)) out.push(j); } catch { /* a line still being written */ } }
  return out;
}

// like.js from X's data archive ("window.YTD.like.part0 = [...]"): every liked post's id, in order,
// with the text and address the archive gives. The checklist the run is measured against.
export function parseArchiveLikes(text) {
  const s = String(text || ""), at = s.indexOf("[");
  if (at < 0) throw new Error("This is not X's like.js: no list found in it.");
  const list = JSON.parse(s.slice(at));
  return list.map((x) => (x && x.like) || x).filter((x) => x && /^\d+$/.test(String(x.tweetId))).map((x) => ({ id: String(x.tweetId), text: x.fullText || null, url: x.expandedUrl || null }));
}

// What the checklist holds that nothing saved does: ids, in the checklist's order.
export const missingLikes = (checklist, captured) => checklist.map((x) => (typeof x === "string" ? x : x.id)).filter((id) => !captured.has(postKey(id)) && !captured.has(id));

// The run's record, kept in this browser so a reload or a restart continues it.
export function likesState(kept = null, now = new Date().toISOString()) {
  const base = kept && kept.format === LIKES_FORMAT ? kept : { format: LIKES_FORMAT, created: now, lines: [], counts: { found: 0, listed: 0, saved: 0, duplicate: 0, failed: 0 }, checkpoint: null, checklist: [], sessions: [] };
  return { ...base, lines: [...base.lines], counts: { found: 0, listed: 0, saved: 0, duplicate: 0, failed: 0, ...base.counts }, checklist: [...(base.checklist || [])], sessions: [...(base.sessions || [])] };
}

// A checkpoint: the last post handled, how far down the page, and whether the run was going. A run
// that was going when the tab closed is offered again on the next visit, never restarted unasked.
export function checkpoint(state, { lastId, scrollY, status }, now = new Date().toISOString()) {
  return { ...state, checkpoint: { lastId: lastId != null ? String(lastId) : (state.checkpoint || {}).lastId || null, scrollY: Math.max(0, Math.round(Number(scrollY) || 0)), status, at: now } };
}
export const resumable = (state) => !!(state && state.checkpoint && (state.checkpoint.status === "running" || state.checkpoint.status === "paused"));

// One post through the browser half: dedupe, then the line. Returns { kind: "duplicate"|"new", line? }.
export function admit(known, lines, post) {
  if (isKnown(known, post.id) || lines.has(String(post.id))) return { kind: "duplicate" };
  return { kind: "new", line: manifestLine(post) };
}

// Per-stage timing: { add(stage, ms, items), table() } with ms per item, so the slowest stage shows.
export function stageClock() {
  const t = Object.fromEntries(STAGES.map((s) => [s, { ms: 0, items: 0 }]));
  return {
    add(stage, ms, items = 1) { const r = t[stage] || (t[stage] = { ms: 0, items: 0 }); r.ms += ms; r.items += items; },
    rows: () => Object.entries(t).filter(([, r]) => r.items).map(([stage, r]) => ({ stage, items: r.items, ms: Math.round(r.ms), perItem: +(r.ms / r.items).toFixed(3) })),
    table() { return ["| stage | items | total ms | ms per item |", "|---|---:|---:|---:|", ...this.rows().map((r) => `| ${r.stage} | ${r.items} | ${r.ms} | ${r.perItem} |`)].join("\n"); },
  };
}

// The study board's filters over saved notes (src/ext/boards.js): "From my likes only" keeps notes a
// likes run wrote (from: "x-likes") and earlier saves of posts the likes manifest lists (liked: their
// ids); since and until ("YYYY-MM-DD") keep posts from those days, inclusive, by the posted time.
export function savesFilter(front, { likes = false, liked = null, since = "", until = "" } = {}) {
  if (likes) {
    const id = (/\/status\/(\d+)/.exec(String(front.post || "")) || [])[1];
    if (front.from !== LIKES_SOURCE && !(id && liked && liked.has(id))) return false;
  }
  const day = String(front.posted || "").slice(0, 10);
  if ((since || until) && !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  return !(since && day < since) && !(until && day > until);
}
