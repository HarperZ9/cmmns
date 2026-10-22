// Threads from JSON a platform's own web app or API returned, saved by the user: X's GraphQL
// TweetDetail, Bluesky's app.bsky.feed.getPostThread, a Mastodon status context, or a thread in
// Daylight Commons' own input shape ({ site, root, replies }). Field names follow each platform's public
// formats; the readers walk the JSON, so a wrapper around the response does not matter.

import { htmlText } from "./import-html.js";

const iso = (s) => { const t = Date.parse(s || ""); return Number.isFinite(t) ? new Date(t).toISOString() : null; };

function walk(json, visit, limit = 300000) {
  const stack = [json];
  let guard = 0;
  while (stack.length && guard++ < limit) {
    const v = stack.pop();
    if (!v || typeof v !== "object") continue;
    visit(v);
    for (const k in v) if (v[k] && typeof v[k] === "object") stack.push(v[k]);
  }
}

// The post most others reply to is the root; the rest are replies, oldest first.
function asThread(site, posts) {
  if (!posts.length) return null;
  const counts = new Map();
  for (const p of posts) if (p.replyTo) counts.set(p.replyTo, (counts.get(p.replyTo) || 0) + 1);
  const top = [...counts].sort((a, b) => b[1] - a[1])[0];
  const root = (top && posts.find((p) => p.id === top[0])) || posts.find((p) => !p.replyTo) || null;
  const replies = posts.filter((p) => p !== root).sort((a, b) => String(a.posted).localeCompare(String(b.posted)));
  const clean = ({ replyTo, ...p }) => p;
  return { site, root: root ? clean(root) : null, replies: replies.map(clean) };
}

function xThread(json) {
  const posts = new Map();
  walk(json, (v) => {
    if (v.__typename !== "Tweet" || !v.rest_id || !v.legacy) return;
    const L = v.legacy, u = ((v.core || {}).user_results || {}).result || {};
    const note = (((v.note_tweet || {}).note_tweet_results || {}).result || {}).text;
    posts.set(v.rest_id, { id: v.rest_id, author: (u.core || {}).screen_name || (u.legacy || {}).screen_name || "unknown", text: note || L.full_text || "", posted: iso(L.created_at),
      links: ((L.entities || {}).urls || []).map((x) => x.expanded_url).filter((x) => x && !/^https?:\/\/(x|twitter)\.com\//.test(x)), replyTo: L.in_reply_to_status_id_str || null });
  });
  return asThread("X", [...posts.values()]);
}

function bskyThread(json) {
  const posts = new Map();
  walk(json, (v) => {
    if (typeof v.uri !== "string" || !v.uri.startsWith("at://") || !v.author || typeof v.author.handle !== "string" || !v.record || typeof v.record.text !== "string") return;
    const links = [];
    for (const f of v.record.facets || []) for (const x of f.features || []) if (x && typeof x.uri === "string") links.push(x.uri);
    const ext = v.record.embed && v.record.embed.external;
    if (ext && ext.uri) links.push(ext.uri);
    const parent = v.record.reply && v.record.reply.parent && v.record.reply.parent.uri;
    posts.set(v.uri, { id: v.uri.split("/").pop(), author: v.author.handle, text: v.record.text, posted: iso(v.record.createdAt), links, replyTo: parent ? parent.split("/").pop() : null });
  });
  return asThread("Bluesky", [...posts.values()]);
}

function mastoThread(json) {
  const posts = new Map();
  walk(json, (v) => {
    if (typeof v.id !== "string" || typeof v.content !== "string" || !v.account || typeof v.account.acct !== "string") return;
    const links = [...v.content.matchAll(/<a\b[^>]*\bhref="(https?:\/\/[^"]+)"[^>]*>/gi)].filter((m) => !/\b(mention|hashtag)\b/.test(m[0])).map((m) => m[1]);
    posts.set(v.id, { id: v.id, author: v.account.acct, text: htmlText(v.content), posted: iso(v.created_at), links, replyTo: v.in_reply_to_id || null });
  });
  return asThread("Mastodon", [...posts.values()]);
}

const isRadarShape = (j) => j && Array.isArray(j.replies) && j.replies.every((r) => r && typeof r.text === "string");

// Returns { site, root, replies } or null when the JSON holds no thread Daylight Commons can read.
export function threadFromJson(json) {
  if (!json || typeof json !== "object") return null;
  if (isRadarShape(json)) return { site: json.site || null, root: json.root || null, replies: json.replies };
  const text = JSON.stringify(json).slice(0, 2000000);
  if (text.includes("\"__typename\":\"Tweet\"")) return xThread(json);
  if (text.includes("\"at://")) return bskyThread(json);
  if (text.includes("\"acct\"")) return mastoThread(json);
  return null;
}
