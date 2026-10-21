// "Your feed": what the user's feeds and threads carried over the last 7 or 30 days, from local
// logs only. Thread snapshots come from history.js; feed posts are tallied here per site and day,
// each post once. Every figure keeps its count and its denominator, so the page can write the
// numbers out. A snapshot saved before a field existed is left out of that field's denominator.

import { wilson } from "./report.js";
import { shownTechniques } from "./persuasion.js";
import { coGraph } from "./graph.js";

export const FEED_RETAIN_DAYS = 60, FEED_MAX_IDS = 3000;
const DAY = 86400000;
const dayOf = (t) => new Date(t).toISOString().slice(0, 10);

// posts: [{ id, domains, strong, note, claims, techniques }]. Log: { "site|day": entry }.
export function addFeedPosts(log, site, posts, now = Date.now()) {
  const L = { ...(log || {}) };
  const key = `${site}|${dayOf(now)}`;
  const e = L[key] ? { ...L[key], ids: [...L[key].ids], links: { ...L[key].links }, techniques: { ...L[key].techniques } } : { site, day: dayOf(now), at: now, ids: [], posts: 0, strong: 0, notes: 0, claims: 0, links: {}, techniques: {} };
  const have = new Set(e.ids);
  for (const p of posts) {
    if (!p || !p.id || have.has(p.id) || e.ids.length >= FEED_MAX_IDS) continue;
    have.add(p.id); e.ids.push(p.id);
    e.posts++;
    if (p.strong) e.strong++;
    if (p.note) e.notes++;
    if (p.claims) e.claims++;
    for (const d of new Set(p.domains || [])) e.links[d] = (e.links[d] || 0) + 1;
    for (const t of new Set(p.techniques || [])) e.techniques[t] = (e.techniques[t] || 0) + 1;
  }
  e.at = now;
  L[key] = e;
  return Object.fromEntries(Object.entries(L).filter(([, v]) => now - v.at <= FEED_RETAIN_DAYS * DAY));
}

// One thread's context for its snapshot: posts linking each site, Community Notes and posts that
// match a fact-checked claim. items: [{ id, domains }]; noteOf, claimsOf: (id) => value or null.
export function threadContext(items, { noteOf = () => null, claimsOf = () => null } = {}) {
  const links = new Map();
  let notes = 0, claims = 0;
  for (const it of items) {
    for (const d of new Set(it.domains || [])) links.set(d, (links.get(d) || 0) + 1);
    if (noteOf(it.id)) notes++;
    const c = claimsOf(it.id);
    if (c && c.length) claims++;
  }
  return { posts: items.length, notes, claims, links: [...links].map(([domain, n]) => ({ domain, n })).sort((a, b) => b.n - a.n || (a.domain < b.domain ? -1 : 1)) };
}

const share = (k, n) => (n ? { k, n, share: k / n, ci: wilson(k, n) } : null);
const count = (k, n) => (n ? { k, n } : null);
const add = (m, k, n) => m.set(k, (m.get(k) || 0) + n);

// reports: history snapshots; feedLog: addFeedPosts log; net: connections log.
// opts: { days, now, isState(domain), shown: technique ids the window may show }.
export function feedDashboard(reports, feedLog, net, { days = 7, now = Date.now(), isState = () => false, shown = shownTechniques() } = {}) {
  const since = now - days * DAY;
  const snaps = Object.values(reports || {}).filter((s) => s && s.at >= since);
  const feeds = Object.values(feedLog || {}).filter((f) => f && f.at >= since);
  const T = { strongK: 0, strongN: 0, ctxK: { notes: 0, claims: 0 }, ctxN: 0, looked: 0, flagged: 0 };
  const sites = new Map(), tech = new Map(), daily = dailyFrame(days, now);
  for (const s of snaps) {
    T.looked += s.lookedUp || 0; T.flagged += s.flaggedK || 0;
    if (s.strong != null) { T.strongK += s.strong; T.strongN += s.replies || 0; }
    if (s.context) {
      T.ctxN += s.context.posts || 0; T.ctxK.notes += s.context.notes || 0; T.ctxK.claims += s.context.claims || 0;
      for (const l of s.context.links || []) add(sites, l.domain, l.n);
    }
    for (const [t, n] of Object.entries(s.techniques || {})) add(tech, t, n);
    dayAdd(daily, s.at, { posts: s.replies || 0, strong: s.strong, strongN: s.strong != null ? s.replies || 0 : 0, threads: 1 });
  }
  for (const f of feeds) {
    T.strongK += f.strong; T.strongN += f.posts; T.ctxN += f.posts; T.ctxK.notes += f.notes; T.ctxK.claims += f.claims;
    for (const [d, n] of Object.entries(f.links || {})) add(sites, d, n);
    for (const [t, n] of Object.entries(f.techniques || {})) add(tech, t, n);
    dayAdd(daily, f.at, { posts: f.posts, strong: f.strong, strongN: f.posts, feedPosts: f.posts });
  }
  const mentions = [...sites.values()].reduce((a, b) => a + b, 0);
  const stateK = [...sites].filter(([d]) => isState(d)).reduce((a, [, n]) => a + n, 0);
  return {
    days, from: dayOf(since), to: dayOf(now),
    threads: snaps.length, feedPosts: feeds.reduce((a, f) => a + f.posts, 0), replies: snaps.reduce((a, s) => a + (s.replies || 0), 0),
    sites: [...sites].map(([domain, n]) => ({ domain, n })).sort((a, b) => b.n - a.n || (a.domain < b.domain ? -1 : 1)).slice(0, 10),
    siteMentions: mentions, siteCount: sites.size,
    state: share(stateK, mentions),
    strong: share(T.strongK, T.strongN),
    flagged: share(T.flagged, T.looked),
    notes: count(T.ctxK.notes, T.ctxN), claims: count(T.ctxK.claims, T.ctxN),
    techniques: { shown: [...shown], counts: [...tech].filter(([t]) => shown.includes(t)).map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n) },
    together: coGraph(net, { min: 3, since, maxNodes: 40 }).edges.slice(0, 10),
    daily: [...daily.values()],
  };
}

function dailyFrame(days, now) {
  const m = new Map();
  for (let i = days - 1; i >= 0; i--) { const d = dayOf(now - i * DAY); m.set(d, { day: d, posts: 0, strong: 0, strongN: 0, threads: 0, feedPosts: 0 }); }
  return m;
}
function dayAdd(m, at, v) {
  const e = m.get(dayOf(at));
  if (!e) return;
  e.posts += v.posts; e.strong += v.strong || 0; e.strongN += v.strongN; e.threads += v.threads || 0; e.feedPosts += v.feedPosts || 0;
}

export const FEED_DOES_NOT_SHOW = "What this does not show: what your feed would carry for anyone else, or what a platform carries overall. These counts cover only posts and threads you opened with Radar on, in the order each platform chose to show them. A site's share says how often it was linked, not whether it is accurate, and a strong-rhetoric sign is about wording, not about the person who wrote it.";
