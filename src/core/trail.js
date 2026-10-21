// Source trails: where a post's material came from, and how it spread across the posts the user has
// viewed. Downstream copies point upstream through data X itself records: a quote points to the
// quoted post, lifted media points to the post it came from, a media id stays the same wherever
// that exact upload is reposted, and a link's real address survives X's t.co shortener. Radar
// follows those pointers back. It never guesses a source from wording or behaviour, and it cannot
// see past the first upload (who filmed it, who paid for it).

export const TRAIL_RETAIN_DAYS = 30, TRAIL_MAX_ITEMS = 5000, TRAIL_MAX_POSTS = 40;
const DAY = 86400000;

// log: { media: { [mediaId]: Spread }, links: { [url]: Spread } }
// Spread: { posts: [{ id, handle, at }] } sorted by time; `at` is the post time (ISO).
function add(table, key, entry) {
  const s = table[key] || { posts: [] };
  if (!s.posts.some((p) => p.id === entry.id)) {
    s.posts.push(entry);
    s.posts.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    if (s.posts.length > TRAIL_MAX_POSTS) s.posts.length = TRAIL_MAX_POSTS;
  }
  s.seen = Date.now();
  table[key] = s;
}

function prune(table, now) {
  const keys = Object.keys(table).filter((k) => now - (table[k].seen || 0) <= TRAIL_RETAIN_DAYS * DAY).sort((a, b) => table[b].seen - table[a].seen);
  return Object.fromEntries(keys.slice(0, TRAIL_MAX_ITEMS).map((k) => [k, table[k]]));
}

const mediaKey = (m) => (m.fromPost ? null : m.url || null);
export const normLink = (u) => { try { const x = new URL(u); x.hash = ""; for (const k of [...x.searchParams.keys()]) if (/^(utm_|fbclid|gclid|s$|t$|ref)/.test(k)) x.searchParams.delete(k); return x.toString().replace(/\/$/, ""); } catch { return null; } };

// tweets: [{ id, author, posted, media, links }] as tweetsIn() returns them.
export function recordSpread(log, tweets, now = Date.now()) {
  const L = { media: { ...((log && log.media) || {}) }, links: { ...((log && log.links) || {}) } };
  for (const t of tweets) {
    if (!t.author || !t.posted) continue;
    const entry = { id: t.id, handle: t.author.toLowerCase(), at: t.posted };
    for (const m of t.media || []) { const k = mediaKey(m); if (k) add(L.media, k, entry); }
    for (const u of t.links || []) { const k = normLink(u); if (k) add(L.links, k, entry); }
  }
  return { media: prune(L.media, now), links: prune(L.links, now) };
}

// Who shared one upload or link: { posts, accounts, first, isFirst } for the given post.
function spreadOf(s, postId) {
  if (!s || !s.posts.length) return null;
  const accounts = new Set(s.posts.map((p) => p.handle));
  return { posts: s.posts.length, accounts: accounts.size, first: s.posts[0], isFirst: s.posts[0].id === postId, sharers: [...accounts].slice(0, 8) };
}

// The trail for one post: steps upstream, plus how its media and links spread.
// tweets: Map id -> tweet, so quoted posts loaded on the page can be followed.
export function trailFor(t, tweets, log, maxHops = 4) {
  if (!t) return null;
  const steps = [];
  let cur = t;
  for (let hop = 0; cur && hop < maxHops; hop++) {
    const up = cur.quotedId || cur.repostOf;
    if (!up) break;
    const next = tweets.get(up);
    steps.push({ kind: cur.quotedId ? "quotes" : "reposts", id: up, handle: next && next.author, at: next && next.posted });
    cur = next;
  }
  for (const m of t.media || []) {
    if (m.fromPost) steps.push({ kind: "media from", id: m.fromPost, at: m.fromPostTime, handle: (tweets.get(m.fromPost) || {}).author });
    steps.push({ kind: "uploaded", at: m.uploaded, type: m.type });
  }
  const media = (t.media || []).map((m) => spreadOf((log && log.media || {})[mediaKey(m) || ""], t.id)).filter(Boolean);
  const links = (t.links || []).map((u) => ({ url: u, spread: spreadOf((log && log.links || {})[normLink(u) || ""], t.id) }));
  return { steps, media, links };
}

// Upstream summary for a thread: which accounts and sites the replies' material leads back to.
// items: [{ id }], tweets: Map. Returns { accounts: [{ handle, n }], domains: [{ domain, n }], uploads }.
export function upstream(items, tweets, log) {
  const acc = new Map(), dom = new Map();
  let uploads = 0, recycled = 0;
  for (const it of items) {
    const t = tweets.get(it.id);
    if (!t) continue;
    const tr = trailFor(t, tweets, log);
    const top = [...tr.steps].reverse().find((s) => s.handle && s.handle.toLowerCase() !== String(t.author || "").toLowerCase());
    if (top) acc.set(top.handle.toLowerCase(), (acc.get(top.handle.toLowerCase()) || 0) + 1);
    for (const u of t.links || []) { try { const d = new URL(u).hostname.replace(/^www\./, ""); dom.set(d, (dom.get(d) || 0) + 1); } catch { /* skip */ } }
    for (const m of tr.media) { uploads++; if (!m.isFirst && m.accounts >= 2) recycled++; }
  }
  const rank = (m) => [...m].map(([k, n]) => ({ k, n })).filter((x) => x.n >= 2).sort((a, b) => b.n - a.n).slice(0, 5);
  return { accounts: rank(acc).map((x) => ({ handle: x.k, n: x.n })), domains: rank(dom).map((x) => ({ domain: x.k, n: x.n })), uploads, recycled };
}

// "First seen" for each piece of media on a post: the earliest post Radar has seen carrying the same
// upload (same media id, so the same file X stores), and the post X credits it to ("From @account").
// The earliest of the two leads. Radar sees only what the user viewed; X's upload time comes from
// the media id. [{ type, uploaded, from, seen, first }], where first is { handle, at, id, how }.
export function firstSeen(t, tweets, log) {
  const table = (log && log.media) || {};
  return ((t && t.media) || []).map((m) => {
    const from = m.fromPost ? { id: m.fromPost, at: m.fromPostTime || null, handle: (tweets.get(m.fromPost) || {}).author || null } : null;
    const s = m.url && table[m.url];
    const seen = s && s.posts.length ? { ...s.posts[0], posts: s.posts.length, accounts: new Set(s.posts.map((p) => p.handle)).size } : null;
    const cands = [from && { ...from, how: "from" }, seen && { id: seen.id, handle: seen.handle, at: seen.at, how: "seen" }].filter((c) => c && c.at);
    cands.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    const first = cands[0] || (from && { ...from, how: "from" }) || null;
    return { type: m.type, url: m.url || null, uploaded: m.uploaded || null, from, seen, first: first && first.id === t.id ? { ...first, isThis: true } : first };
  });
}
