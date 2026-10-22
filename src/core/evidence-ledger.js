// The local engagement-history ledger (project-docs/EVIDENCE-LAYER.md): each time the user opens a
// post, its public counts are written down with the time, on this device only. Over several visits
// the ledger shows how the counts grew: a repost count that jumps by thousands between two visits an
// hour apart while likes stay flat is a fact the user saw twice. No account and no text is kept.

export const LEDGER_KEY = "pb.ledger.v1", LEDGER_RETAIN_DAYS = 30, LEDGER_MAX_POSTS = 500, LEDGER_MAX_POINTS = 48, LEDGER_MIN_GAP_MS = 10 * 60000;
export const LEDGER_DOES_NOT_PROVE = "Counts are what the platform showed at each visit. Platforms round, delay and recount, and a post can be shared into a large community between two visits.";
const KEYS = ["reposts", "likes", "replies", "quotes", "bookmarks", "views"];
const DAY = 86400000;

// Adds one observation of a post's counts. A point closer than LEDGER_MIN_GAP_MS to the last one
// replaces it, so a page refreshing every few seconds does not fill the ledger.
export function recordCounts(ledger, postId, counts, at = Date.now()) {
  const L = { ...(ledger || {}) };
  const point = { at, ...Object.fromEntries(KEYS.filter((k) => Number.isFinite(counts && counts[k])).map((k) => [k, counts[k]])) };
  if (Object.keys(point).length < 2) return L;
  const pts = [...((L[postId] || {}).points || [])];
  if (pts.length && at - pts[pts.length - 1].at < LEDGER_MIN_GAP_MS) pts[pts.length - 1] = point; else pts.push(point);
  L[postId] = { seen: at, points: pts.slice(-LEDGER_MAX_POINTS) };
  return pruneLedger(L, at);
}

export function pruneLedger(ledger, now = Date.now()) {
  const keep = Object.entries(ledger || {}).filter(([, v]) => now - v.seen <= LEDGER_RETAIN_DAYS * DAY).sort((a, b) => b[1].seen - a[1].seen).slice(0, LEDGER_MAX_POSTS);
  return Object.fromEntries(keep);
}

// Growth between the first and last visit, and the largest step between two visits, per count.
export function ledgerGrowth(entry) {
  const pts = (entry && entry.points) || [];
  if (pts.length < 2) return null;
  const out = { visits: pts.length, from: new Date(pts[0].at).toISOString(), to: new Date(pts[pts.length - 1].at).toISOString(), counts: {} };
  for (const k of KEYS) {
    const xs = pts.filter((p) => Number.isFinite(p[k]));
    if (xs.length < 2) continue;
    let step = { by: 0, hours: null };
    for (let i = 1; i < xs.length; i++) { const by = xs[i][k] - xs[i - 1][k]; if (by > step.by) step = { by, hours: Math.round(((xs[i].at - xs[i - 1].at) / 3600000) * 10) / 10 }; }
    out.counts[k] = { first: xs[0][k], last: xs[xs.length - 1][k], largestStep: step };
  }
  return out;
}
