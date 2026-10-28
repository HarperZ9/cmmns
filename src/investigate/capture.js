// Capturing one source for a case: the bytes, their sha256, the text, and how it was read. A URL
// is fetched once with no cookies and no credentials; an X or Twitter post is read from X's public
// post-data endpoint (the syndication record the embed widget uses), as the hand-made cases did.
// A page behind a login is refused, never captured.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename, extname } from "node:path";

export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

export const READ_MODES = {
  web: "public fetch, no cookies or credentials",
  x: "X public post-data endpoint (cdn.syndication.twimg.com/tweet-result), raw JSON",
  file: "local file supplied by the investigator",
};

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", "#39": "'" };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
  if (e[0] === "#") { const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1)); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
  return ENTITIES[e.toLowerCase()] ?? m;
});

// Readable text from HTML: scripts, styles and comments dropped, block ends as line breaks.
export function htmlToText(html) {
  return decode(String(html)
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|header|footer|blockquote)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/[ \t\f\v\r]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

// The publication time a page states about itself: Open Graph or article meta, JSON-LD
// datePublished, or the first <time datetime>. Null when the page states none.
export function htmlDate(html) {
  const s = String(html);
  const pats = [/<meta[^>]+(?:property|name|itemprop)=["'](?:article:published_time|og:published_time|datePublished|pubdate|publish-date|date)["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name|itemprop)=["'](?:article:published_time|datePublished)["']/i, /"datePublished"\s*:\s*"([^"]+)"/i, /<time[^>]+datetime=["']([^"']+)["']/i];
  for (const re of pats) {
    const m = s.match(re), t = m ? Date.parse(m[1]) : NaN;
    if (Number.isFinite(t)) return /T\d/.test(m[1]) ? new Date(t).toISOString() : m[1].slice(0, 10);
  }
  return null;
}

export const htmlTitle = (html) => { const m = String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i); return m ? decode(m[1]).replace(/\s+/g, " ").trim() : null; };

// The post id of an X or Twitter status URL, or null.
export function xPostId(url) {
  const m = String(url).match(/^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/[^/]+\/status(?:es)?\/(\d{5,25})/i);
  return m ? m[1] : null;
}

// The public post-data address for one post id. The token is derived from the id the same way
// X's own embed code derives it.
export function syndicationUrl(id) {
  const token = ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, "");
  return `https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=en&token=${token}`;
}

const handle = (u) => (u && u.screen_name ? "@" + u.screen_name : null);

// The fields a case uses from a syndication record. deleted: the endpoint returned a tombstone.
export function postFromSyndication(j) {
  if (!j || typeof j !== "object" || j.__typename === "TweetTombstone" || !j.id_str) return { deleted: true };
  const edits = (j.edit_control && (j.edit_control.edit_tweet_ids || (j.edit_control.initial_tweet_id ? [j.edit_control.initial_tweet_id] : []))) || [];
  return {
    deleted: false, id: j.id_str, author: handle(j.user), authorName: j.user ? j.user.name || null : null,
    posted: j.created_at ? new Date(j.created_at).toISOString() : null, text: String(j.text || ""),
    inReplyTo: j.in_reply_to_status_id_str ? { id: j.in_reply_to_status_id_str, author: j.in_reply_to_screen_name ? "@" + j.in_reply_to_screen_name : null } : null,
    quoted: j.quoted_tweet && j.quoted_tweet.id_str ? { id: j.quoted_tweet.id_str, author: handle(j.quoted_tweet.user) } : null,
    edited: !!j.isEdited || edits.length > 1, editIds: edits,
  };
}

const LOGIN_URL = /\/(login|signin|sign-in|i\/flow\/login|accounts\/login|auth\/)|[?&](login|signin)=|^https?:\/\/(accounts|login|auth)\./i;
const WALL_CHARS = 1500;
const LOGIN_TEXT = /\b(log ?in|sign ?in) to (continue|see|view|read)\b|\bthis account('s posts)? (is|are) protected\b|\bmembers only\b/i;

// Why this response must not be captured, or null. A capture never holds login-gated content.
export function loginGated({ status, finalUrl, html }) {
  if (status === 401 || status === 407) return `HTTP ${status}: the page asks for credentials`;
  if (finalUrl && LOGIN_URL.test(finalUrl)) return `the page redirected to a sign-in address (${finalUrl})`;
  // A sign-in box in a site's header does not gate the page; a page that is little more than the box does.
  const text = html ? htmlToText(html) : "";
  if (html && text.length < WALL_CHARS && /<input[^>]+type=["']?password/i.test(html)) return "the page is a sign-in form";
  if (html && text.length < WALL_CHARS && LOGIN_TEXT.test(text)) return "the page says it needs a sign-in";
  return null;
}

async function fetchBytes(fetchFn, url) {
  const res = await fetchFn(url, { redirect: "follow", credentials: "omit", headers: { "user-agent": "cmmns-case (+https://github.com/HarperZ9/cmmns)" } });
  return { res, bytes: Buffer.from(await res.arrayBuffer()) };
}

// Captures one URL. Resolves to { ok, reason?, kind, bytes, ext, text, title, readMode, post?, finalUrl }.
export async function captureUrl(url, { fetchFn = globalThis.fetch } = {}) {
  const id = xPostId(url);
  if (id) {
    const { res, bytes } = await fetchBytes(fetchFn, syndicationUrl(id));
    if (res.status === 404) return { ok: true, kind: "x-post", bytes, ext: ".json", text: "", title: null, readMode: READ_MODES.x, post: { deleted: true }, finalUrl: url, status: 404 };
    if (!res.ok) return { ok: false, reason: `the post-data endpoint answered HTTP ${res.status}` };
    let j = null;
    try { j = JSON.parse(bytes.toString("utf8") || "null"); } catch { return { ok: false, reason: "the post-data endpoint did not return JSON" }; }
    const post = postFromSyndication(j);
    return { ok: true, kind: "x-post", bytes, ext: ".json", text: post.text || "", title: null, readMode: READ_MODES.x, post, finalUrl: url, status: res.status };
  }
  const { res, bytes } = await fetchBytes(fetchFn, url);
  const type = (res.headers && res.headers.get && res.headers.get("content-type")) || "";
  const html = /html|xml/i.test(type) || /^\s*</.test(bytes.subarray(0, 64).toString("utf8")) ? bytes.toString("utf8") : null;
  const gated = loginGated({ status: res.status, finalUrl: res.url, html });
  if (gated) return { ok: false, reason: `not captured: ${gated}` };
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
  const ext = html ? ".html" : /pdf/i.test(type) ? ".pdf" : /json/i.test(type) ? ".json" : ".bin";
  return { ok: true, kind: "web", bytes, ext, text: html ? htmlToText(html) : /json|text/i.test(type) ? bytes.toString("utf8") : "", title: html ? htmlTitle(html) : null, date: html ? htmlDate(html) : null, readMode: READ_MODES.web, finalUrl: res.url || url, status: res.status };
}

// Captures one local file the investigator supplied. A saved X syndication record reads as a post.
export function captureFile(path) {
  const bytes = readFileSync(path), ext = extname(path).toLowerCase() || ".bin";
  const asText = bytes.toString("utf8");
  if (ext === ".json") {
    try {
      const j = JSON.parse(asText);
      if (j && (j.id_str || j.__typename === "TweetTombstone")) { const post = postFromSyndication(j); return { ok: true, kind: "x-post", bytes, ext, text: post.text || "", title: null, readMode: READ_MODES.file, post, name: basename(path) }; }
    } catch { /* not JSON after all: kept as bytes */ }
  }
  const html = /\.html?$/.test(ext) ? asText : null;
  if (html) { const gated = loginGated({ html }); if (gated) return { ok: false, reason: `not captured: ${gated}` }; }
  const text = html ? htmlToText(html) : /\.(txt|md|json|csv)$/.test(ext) ? asText : "";
  return { ok: true, kind: "file", bytes, ext, text, title: html ? htmlTitle(html) : null, date: html ? htmlDate(html) : null, readMode: READ_MODES.file, name: basename(path) };
}
