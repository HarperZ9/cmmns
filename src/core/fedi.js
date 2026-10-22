// Mastodon and TikTok data from the responses each site's own web app already loaded, passed on by
// src/ext/fedisniff.js. Daylight Commons makes no request of its own. Field names follow Mastodon's public REST
// API (Account and Status entities) and the comment list TikTok's web app requests.

function walk(json, visit, limit = 200000) {
  const stack = [json];
  let guard = 0;
  while (stack.length && guard++ < limit) {
    const v = stack.pop();
    if (!v || typeof v !== "object") continue;
    visit(v);
    for (const k in v) if (v[k] && typeof v[k] === "object") stack.push(v[k]);
  }
}

const day = (s) => (typeof s === "string" && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null);
const num = (x) => (Number.isFinite(x) ? x : undefined);

// A Mastodon Account entity: id, username, acct, url, created_at.
const isMastoAccount = (v) => typeof v.acct === "string" && typeof v.username === "string" && typeof v.url === "string" && "created_at" in v;

// acct (lower case, "user" for local, "user@host" for remote) -> what the server loaded about the
// account. `bot` is the account's own "automated" switch; `group` marks a group actor.
export function mastoAccounts(json) {
  const out = new Map();
  if (!json) return out;
  walk(json, (v) => {
    if (!isMastoAccount(v)) return;
    const r = { handle: v.acct, aboutRead: true, labelSource: "Mastodon" };
    if (v.display_name) r.display = String(v.display_name).slice(0, 80);
    const joined = day(v.created_at);
    if (joined) r.joinDate = joined;
    if (v.bot === true) r.platformLabels = ["automated (set by the account)"];
    if (v.group === true) r.group = true;
    if (v.moved) r.moved = true;
    if (num(v.followers_count) != null) r.followersCount = v.followers_count;
    if (num(v.following_count) != null) r.followingCount = v.following_count;
    if (num(v.statuses_count) != null) r.postsCount = v.statuses_count;
    const k = v.acct.toLowerCase();
    out.set(k, { ...(out.get(k) || {}), ...r });
  });
  return out;
}

// Status id -> { id, author, posted, lang } for statuses in the response.
export function mastoStatuses(json) {
  const out = new Map();
  if (!json) return out;
  walk(json, (v) => {
    if (typeof v.id !== "string" || typeof v.content !== "string" || !v.account || !isMastoAccount(v.account)) return;
    out.set(v.id, { id: v.id, author: v.account.acct, posted: v.created_at || null, lang: v.language || null });
  });
  return out;
}

// What the page probe in the toolbar popup found: the Mastodon web app's root element and the
// version and domain from its initial state. Only those two fields are read from the state.
export function mastodonProbe(p) {
  if (!p || !p.root) return null;
  const version = typeof p.version === "string" ? p.version.slice(0, 40) : null;
  const domain = typeof p.domain === "string" && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(p.domain) ? p.domain.toLowerCase() : null;
  return version ? { version, domain } : null;
}

// The origin pattern Daylight Commons asks permission for, from a tab's URL; null for anything but https.
export function instanceOrigin(url) {
  let u;
  try { u = new URL(url); } catch (_) { return null; }
  if (u.protocol !== "https:" || !u.hostname.includes(".")) return null;
  return `https://${u.hostname}/*`;
}

// TikTok comment list: cid -> { id, author, text, posted } (create_time is in seconds). Kept in
// memory only, to match each rendered comment to its id and time.
export function tiktokComments(json) {
  const out = new Map();
  if (!json) return out;
  walk(json, (v) => {
    if (typeof v.cid !== "string" || typeof v.text !== "string" || !v.user || typeof v.user.unique_id !== "string") return;
    const t = Number(v.create_time);
    out.set(v.cid, { id: v.cid, author: v.user.unique_id, text: v.text.slice(0, 500), posted: Number.isFinite(t) && t > 0 ? new Date(t * 1000).toISOString() : null });
  });
  return out;
}
