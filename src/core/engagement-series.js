// Engagement over time for saved posts (project-docs/ENGAGEMENT-SERIES.md). A post the user saved
// is tracked by its id. Whenever the page's own data (X's post data, YouTube's player data, Reddit's
// post attributes) carries a tracked post, its counts are written down as one reading, at most one
// per post per 6 hours. A schedule of target ages says which readings are due; the user opens each
// due post, so every page load is the user's. An optional log keeps every post the page loaded.
// Pure: no DOM, no storage, and no request of any kind.
import { postTag, textTags } from "./media-meta.js";

const HOUR = 3600000, DAY = 24 * HOUR;
export const SERIES_TARGET_DAYS = Object.freeze([1, 3, 7, 14, 30, 90]);
export const SERIES_GAP_MS = 6 * HOUR;
export const SERIES_MAX_TRACKED = 20000;
export const SERIES_MAX_READINGS = 240;
export const SEEN_DAYS_DEFAULT = 90;
export const SERIES_FORMAT = "cmmns.engagement-series/1";
export const SERIES_COUNT_KEYS = Object.freeze(["likes", "reposts", "quotes", "replies", "bookmarks", "views", "score", "comments"]);
export const SERIES_DOES_NOT_PROVE = "Each reading is what the platform's own page data said when you happened to load the post. Readings are irregular, platforms round, delay and recount, and a missed age stays missed.";
const PLATFORMS = { x: "x", "twitter.com": "x", "x.com": "x", reddit: "reddit", "reddit.com": "reddit", youtube: "youtube", "youtube.com": "youtube", "m.youtube.com": "youtube" };

export const seriesKey = (platform, postId) => `${platform}:${postId}`;
const isoOf = (t) => { const d = new Date(t); return Number.isFinite(d.getTime()) ? d.toISOString() : null; };
const msOf = (t) => (t == null ? NaN : typeof t === "number" ? t : Date.parse(t));
// A count only when the data gave a whole number (Reddit's attributes are digit strings).
const count = (v) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && /^-?\d+$/.test(v.trim()) ? Number(v) : null);
const countsOf = (o) => Object.fromEntries(SERIES_COUNT_KEYS.map((k) => [k, count(o && o[k])]).filter(([, v]) => v != null));

// The tracked record for a saved post, from the sidecar record media-meta builds, or null when the
// address holds no post id this feature can match (a page, a Reddit comment, another site).
export function trackEntry(meta, now = Date.now()) {
  const platform = PLATFORMS[String((meta && meta.site) || "").replace(/^www\./, "")] || null;
  const url = String((meta && meta.postUrl) || "");
  if (!platform || !url) return null;
  if (platform === "reddit" && /\/comments\/[a-z0-9]+\/[^/]*\/[a-z0-9]+/i.test(url)) return null;
  const id = postTag({ postUrl: url });
  if (!id || (platform === "x" && !/^\d+$/.test(id))) return null;
  const handle = meta.author && meta.author.handle ? String(meta.author.handle).replace(/^@|^u\//, "") : meta.handle ? String(meta.handle).replace(/^@|^u\//, "") : null;
  return { key: seriesKey(platform, id), platform, postId: id, handle, postedAt: isoOf(meta.postedAt), savedAt: isoOf(meta.savedAt) || isoOf(now), missed: [] };
}

// The reading taken at save time from the counts the save already read, or null with none.
export function saveReading(entry, meta, now = Date.now()) {
  const c = countsOf(meta && meta.engagement);
  return Object.keys(c).length ? readingOf({ platform: entry.platform, postId: entry.postId, counts: c }, entry, now, "save") : null;
}

// Where the user goes to take a reading.
export function seriesPostUrl(e) {
  if (e.platform === "x") return `https://x.com/${e.handle || "i"}/status/${e.postId}`;
  if (e.platform === "reddit") return `https://www.reddit.com/comments/${e.postId}/`;
  if (e.platform === "youtube") return `https://www.youtube.com/watch?v=${e.postId}`;
  return null;
}

const domainOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return null; } };

// One sighting per post in X's post data (src/core/xdata.js tweetsIn).
export function sightingsFromTweets(tweets) {
  return (tweets || []).filter((t) => t && t.id).map((t) => ({
    platform: "x", postId: String(t.id), handle: t.author || null, postedAt: t.posted || null,
    counts: countsOf(t), hashtags: textTags(t.text).hashtags, linkDomains: [...new Set((t.links || []).map(domainOf).filter(Boolean))],
    mediaUrls: (t.media || []).map((m) => m.url).filter(Boolean),
  }));
}

// The video in YouTube's player data (videoDetails, and the publish date in its microformat).
export function sightingFromYt(json) {
  const d = json && json.videoDetails;
  if (!d || !/^[\w-]{11}$/.test(String(d.videoId || ""))) return null;   // a video id is 11 characters
  const mf = ((json.microformat || {}).playerMicroformatRenderer) || {};
  return { platform: "youtube", postId: String(d.videoId), handle: d.channelId || null, postedAt: isoOf(mf.publishDate || mf.uploadDate),
    counts: countsOf({ views: d.viewCount }), hashtags: [], linkDomains: [], mediaUrls: [] };
}

// A Reddit post from its shreddit-post element's attributes (id "t3_<id>", score, comment-count).
export function sightingFromReddit(a) {
  const m = /^t3_([a-z0-9]+)$/i.exec(String((a && a.id) || ""));
  if (!m) return null;
  return { platform: "reddit", postId: m[1], handle: a.author || null, postedAt: isoOf(a["created-timestamp"] ? String(a["created-timestamp"]).replace(/(\.\d{3})\d+/, "$1").replace(/([+-]\d\d)(\d\d)$/, "$1:$2") : null),
    counts: countsOf({ score: a.score, comments: a["comment-count"] }), hashtags: [], linkDomains: a.domain ? [String(a.domain)] : [], mediaUrls: [] };
}

export const shouldRecord = (lastAt, now) => !Number.isFinite(lastAt) || now - lastAt >= SERIES_GAP_MS;

// One reading: the counts, the time, and the post's age then (null when the post time is unknown).
export function readingOf(s, entry, now = Date.now(), source = "page") {
  const posted = msOf((entry && entry.postedAt) || s.postedAt);
  const age = Number.isFinite(posted) ? Math.round(((now - posted) / HOUR) * 100) / 100 : null;
  return { id: `${seriesKey(s.platform, s.postId)}@${now}`, key: seriesKey(s.platform, s.postId), platform: s.platform, postId: s.postId,
    at: new Date(now).toISOString(), ageHours: age, source, ...countsOf(s.counts) };
}

// What to write for a batch of sightings. tracked: { key: entry }; lastAt and seenLast: { key: ms }.
export function planSightings({ sightings = [], tracked = {}, lastAt = {}, seenLast = {}, settings = {}, now = Date.now() }) {
  const out = { readings: [], seen: [], lastAt: {}, seenAt: {}, postedAt: {} };
  const logSeen = !!settings.seenLog && !settings.protection;   // source protection keeps no seen log
  for (const s of sightings) {
    const key = seriesKey(s.platform, s.postId), e = tracked[key];
    if (!Object.keys(countsOf(s.counts)).length) continue;
    if (settings.trackSeries && e && !(key in out.lastAt) && shouldRecord(lastAt[key] != null ? lastAt[key] : msOf(e.lastAt), now)) {
      out.readings.push(readingOf(s, e, now));
      out.lastAt[key] = now;
      if (!e.postedAt && s.postedAt) out.postedAt[key] = s.postedAt;
    }
    if (logSeen && !(key in out.seenAt) && shouldRecord(seenLast[key], now)) { out.seen.push(seenRecord(s, now)); out.seenAt[key] = now; }
  }
  return out;
}

// A seen-log line: ids, handle, times, counts, hashtags and link domains. Media addresses are kept
// only as their hashes (mediaHashes, filled by the store), and no post text is kept.
export function seenRecord(s, now = Date.now(), mediaHashes = []) {
  const key = seriesKey(s.platform, s.postId);
  return { id: `${key}@${now}`, key, platform: s.platform, postId: s.postId, handle: s.handle || null, postedAt: s.postedAt || null,
    at: new Date(now).toISOString(), atMs: now, ...countsOf(s.counts), hashtags: s.hashtags || [], linkDomains: s.linkDomains || [], mediaHashes };
}

const windowOf = (posted, day) => { const start = posted + day * DAY; return { start, end: start + Math.max(DAY, day * DAY * 0.25) }; };
const lastEnd = (posted) => windowOf(posted, SERIES_TARGET_DAYS[SERIES_TARGET_DAYS.length - 1]).end;
const anchor = (e) => { const p = msOf(e.postedAt); return Number.isFinite(p) ? p : msOf(e.savedAt); };

// Each target age: done (a reading in its window), due, missed, upcoming, or before-tracking (the
// window closed before the post was saved).
export function seriesSchedule(entry, readings = [], now = Date.now()) {
  const posted = anchor(entry), saved = msOf(entry.savedAt), at = readings.map((r) => msOf(r.at));
  return SERIES_TARGET_DAYS.map((day) => {
    const { start, end } = windowOf(posted, day);
    const status = at.some((t) => t >= start && t < end) ? "done" : saved >= end ? "before-tracking" : now < start ? "upcoming" : now < end ? "due" : "missed";
    return { day, start: new Date(start).toISOString(), end: new Date(end).toISOString(), status };
  });
}

// The due readings across tracked posts, soonest window end first, and the ages missed.
export function dueReadings(entries, readingsByKey = {}, now = Date.now()) {
  const due = [], missed = [];
  for (const e of entries || []) {
    for (const s of seriesSchedule(e, readingsByKey[e.key] || [], now)) {
      if (s.status === "due") due.push({ key: e.key, day: s.day, end: s.end, url: seriesPostUrl(e), handle: e.handle, platform: e.platform });
      if (s.status === "missed") missed.push({ key: e.key, day: s.day });
    }
  }
  due.sort((a, b) => a.end.localeCompare(b.end) || a.key.localeCompare(b.key));
  return { due, missed };
}

// At most `cap` tracked posts: posts whose schedule has finished go first, oldest save first, then
// the oldest saves. Under the cap nothing is dropped.
export function pruneTracked(entries, now = Date.now(), cap = SERIES_MAX_TRACKED) {
  const list = [...(entries || [])], over = list.length - cap;
  if (over <= 0) return { keep: list, drop: [] };
  const finished = (e) => now >= lastEnd(anchor(e));
  const order = [...list].sort((a, b) => Number(finished(b)) - Number(finished(a)) || msOf(a.savedAt) - msOf(b.savedAt));
  const drop = new Set(order.slice(0, over).map((e) => e.key));
  return { keep: list.filter((e) => !drop.has(e.key)), drop: [...drop] };
}

// At most `max` readings for one post: the reading closest to the one before it goes first; the
// first and the last readings always stay.
export function thinReadings(readings, max = SERIES_MAX_READINGS) {
  const list = [...readings].sort((a, b) => a.at.localeCompare(b.at)), drop = [];
  while (list.length > max && list.length > 2) {
    let at = 1;
    for (let i = 2; i < list.length - 1; i++) if (msOf(list[i].at) - msOf(list[i - 1].at) < msOf(list[at].at) - msOf(list[at - 1].at)) at = i;
    drop.push(list.splice(at, 1)[0].id);
  }
  return { keep: list, drop };
}

export const sortReadings = (list) => [...list].sort((a, b) => a.at.localeCompare(b.at) || a.key.localeCompare(b.key));
export const seriesJsonl = (list) => sortReadings(list).map((r) => JSON.stringify(r)).join("\n") + (list.length ? "\n" : "");
export const parseSeriesJsonl = (text) => String(text || "").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));

export async function sha256Hex(text) {
  const d = await crypto.subtle.digest("SHA-256", typeof text === "string" ? new TextEncoder().encode(text) : text);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// The manifest beside an export: what each file holds, its line count and its sha256.
export async function seriesManifest(files, { tracked = [], now = Date.now(), version = null } = {}) {
  const rows = [];
  for (const f of files) rows.push({ name: f.name, holds: f.holds, lines: parseSeriesJsonl(f.text).length, sha256: await sha256Hex(f.text) });
  const missed = tracked.reduce((n, e) => n + (e.missed || []).length, 0);
  return { format: SERIES_FORMAT, exported: new Date(now).toISOString(), tool: version ? `CMMNS ${version}` : "CMMNS", posts: tracked.length,
    readings: rows[0] ? rows[0].lines : 0, missed, targetDays: [...SERIES_TARGET_DAYS], gapHours: SERIES_GAP_MS / HOUR, files: rows,
    tracked: tracked.map((e) => ({ key: e.key, platform: e.platform, postId: e.postId, handle: e.handle, postedAt: e.postedAt, savedAt: e.savedAt, missed: e.missed || [] })),
    doesNotProve: SERIES_DOES_NOT_PROVE };
}
