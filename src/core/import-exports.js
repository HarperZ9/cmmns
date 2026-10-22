// Posts from the data exports platforms give their own users: an X archive's tweets.js, a Reddit
// data export's comments.csv or posts.csv, and a Mastodon archive's outbox.json. All posts in an
// export are the user's own, so they come back with one author, "you". Reposts of other people's
// posts are left out and counted. Reddit's export has an ip column: it is dropped and never shown.

import { htmlText } from "./import-html.js";

const iso = (s) => { const t = Date.parse(s || ""); return Number.isFinite(t) ? new Date(t).toISOString() : null; };
export const EXPORT_AUTHOR = "you";

// window.YTD.tweets.part0 = [ { tweet: { id_str, full_text, created_at, entities } } ]
export function xArchivePosts(text) {
  const s = String(text || ""), at = s.indexOf("=");
  if (!/^\s*window\.YTD\./.test(s) || at < 0) return null;
  let rows;
  try { rows = JSON.parse(s.slice(at + 1).trim().replace(/;\s*$/, "")); } catch { return null; }
  const posts = [];
  let reposts = 0;
  for (const r of Array.isArray(rows) ? rows : []) {
    const t = (r && (r.tweet || r.note_tweet || r)) || {};
    const body = t.full_text || t.text || (t.core && t.core.text) || "";
    if (/^RT @\w+:/.test(body)) { reposts++; continue; }
    if (!body) continue;
    const links = ((t.entities || {}).urls || []).map((u) => u.expanded_url).filter((u) => u && !/^https?:\/\/(x|twitter)\.com\//.test(u));
    posts.push({ id: String(t.id_str || t.id || t.noteTweetId || posts.length + 1), author: EXPORT_AUTHOR, text: body, posted: iso(t.created_at || t.createdAt), links });
  }
  return { site: "X", posts, notes: reposts ? [`${reposts} repost${reposts === 1 ? "" : "s"} of other people's posts left out.`] : [] };
}

// RFC 4180: quoted fields, doubled quotes, line breaks inside quotes. Returns rows of strings.
export function parseCsv(text) {
  const s = String(text || "").replace(/^﻿/, ""), rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === "\"" && s[i + 1] === "\"") { field += "\""; i++; } else if (c === "\"") quoted = false; else field += c;
    } else if (c === "\"" && field === "") quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1 || r[0]);
}

// comments.csv: id, permalink, date, ip, subreddit, gildings, link, parent, body, media
// posts.csv:    id, permalink, date, ip, subreddit, gildings, title, url, body
export function redditExportPosts(text) {
  const rows = parseCsv(text);
  if (rows.length < 1) return null;
  const head = rows[0].map((h) => h.trim().toLowerCase()), col = (n) => head.indexOf(n);
  if (col("id") < 0 || col("body") < 0 || col("permalink") < 0) return null;
  const posts = rows.slice(1).map((r) => {
    const pick = (n) => (col(n) >= 0 ? r[col(n)] || "" : "");
    const url = pick("url"), text = [pick("title"), pick("body")].filter(Boolean).join("\n");
    return { id: pick("id"), author: EXPORT_AUTHOR, text, posted: iso(pick("date")), links: /^https?:\/\//.test(url) && !/reddit\.com\//.test(url) ? [url] : [] };
  }).filter((p) => p.id && p.text && p.text !== "[deleted]" && p.text !== "[removed]");
  return { site: "Reddit", posts, notes: col("ip") >= 0 ? ["The export's ip column was left out; Daylight Commons keeps and shows no IP address."] : [] };
}

// outbox.json: { orderedItems: [{ type: "Create", object: { id, content, published, tag } }] }.
export function mastodonOutboxPosts(json) {
  if (!json || !Array.isArray(json.orderedItems)) return null;
  const posts = [];
  let boosts = 0;
  for (const it of json.orderedItems) {
    if (it && it.type === "Announce") { boosts++; continue; }
    const o = it && it.type === "Create" ? it.object : null;
    if (!o || typeof o !== "object" || typeof o.content !== "string") continue;
    const links = [...o.content.matchAll(/<a\b[^>]*\bhref="(https?:\/\/[^"]+)"[^>]*>/gi)].filter((m) => !/\b(mention|hashtag)\b/.test(m[0])).map((m) => m[1]);
    posts.push({ id: String(o.id || it.id || posts.length + 1).split("/").pop(), author: EXPORT_AUTHOR, text: htmlText(o.content), posted: iso(o.published || it.published), links });
  }
  return { site: "Mastodon", posts, notes: boosts ? [`${boosts} boost${boosts === 1 ? "" : "s"} of other people's posts left out.`] : [] };
}
