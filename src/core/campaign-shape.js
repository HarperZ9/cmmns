// Engagement shape for the launch campaign lens (project-docs/CAMPAIGN-LENS.md, signal 1): the
// ratios between a post's reposts, likes, replies, bookmarks and views, and where the post sits
// against three references: the author's own posts, a stratified platform baseline, and a
// labelled historical reference. It shows a position, never a verdict.

import { CAMPAIGN_BASELINES } from "./campaign-baselines-data.js";

export const SHAPE_MIN_INTERACTIONS = 20, OWN_MIN_POSTS = 5, OWN_OUTLIER_FACTOR = 5, STRATUM_MIN = 200;
export const SHAPE_DOES_NOT_PROVE = "The ratio shows how this post's engagement is shaped. Posts travel through repost-heavy communities such as news, giveaways and art shares.";

const num = (v) => (Number.isFinite(v) && v >= 0 ? v : null);
const ratio = (a, b) => (a != null && b != null && b > 0 ? a / b : null);

// counts: { reposts, likes, replies, quotes, bookmarks, views } -> ratios (null where unknown).
export function shapeOf(counts) {
  const c = Object.fromEntries(["reposts", "likes", "replies", "quotes", "bookmarks", "views"].map((k) => [k, num((counts || {})[k])]));
  const interactions = (c.reposts || 0) + (c.likes || 0) + (c.replies || 0) + (c.quotes || 0);
  return {
    counts: c, interactions,
    repostsPerLike: c.likes === 0 && c.reposts > 0 ? Infinity : ratio(c.reposts, c.likes),
    repliesPerLike: ratio(c.replies, c.likes),
    bookmarksPerLike: ratio(c.bookmarks, c.likes),
    likesPerThousandViews: c.views ? ratio(c.likes, c.views / 1000) : null,
    repostsPerThousandViews: c.views ? ratio(c.reposts, c.views / 1000) : null,
  };
}

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };

// The author's own other posts (counts only) as the reference. Only posts with enough interactions
// to make a ratio stable count. Returns { n, median, max, outlier, factor } or { n, insufficient }.
export function ownBaseline(post, others) {
  const me = shapeOf(post).repostsPerLike;
  const refs = (others || []).map((o) => shapeOf(o)).filter((s) => s.interactions >= SHAPE_MIN_INTERACTIONS && Number.isFinite(s.repostsPerLike)).map((s) => s.repostsPerLike);
  if (refs.length < OWN_MIN_POSTS || me == null) return { n: refs.length, insufficient: true };
  const med = median(refs), max = Math.max(...refs);
  const factor = med > 0 ? me / med : me > 0 ? Infinity : 1;
  return { n: refs.length, median: med, max, value: me, factor, outlier: me > max && factor >= OWN_OUTLIER_FACTOR };
}

// Audience stratum by follower count. Strata are per platform (no shared thresholds).
export function stratumOf(platform, followers) {
  const def = CAMPAIGN_BASELINES[platform];
  if (!def || !Number.isFinite(followers)) return null;
  return def.strata.find((s) => followers >= s.min && followers < s.max) || null;
}

// Where a value sits in a quantile table { q05, q25, q50, q75, q95, q99 } -> a phrase key.
export function position(value, q) {
  if (value == null || !q) return null;
  if (value > q.q99) return "above the 99th percentile";
  if (value > q.q95) return "between the 95th and 99th percentiles";
  if (value > q.q75) return "between the 75th and 95th percentiles";
  if (value >= q.q25) return "in the middle half";
  if (value >= q.q05) return "between the 5th and 25th percentiles";
  return "below the 5th percentile";
}

// The full engagement-shape reading for one post on one platform.
// post: counts plus { followers? }; others: the author's other posts (counts) seen on this device.
export function engagementShape(platform, post, others) {
  const shape = shapeOf(post);
  if (shape.interactions < SHAPE_MIN_INTERACTIONS) return { platform, shape, tooFew: true };
  const own = ownBaseline(post, others);
  const def = CAMPAIGN_BASELINES[platform] || null;
  const st = stratumOf(platform, post && post.followers);
  const current = st && st.current && st.current.n >= STRATUM_MIN ? { ...st.current, position: position(shape.repostsPerLike, st.current.repostsPerLike) } : null;
  const historical = def && def.historical ? (() => {
    const h = def.historical.strata.find((s) => Number.isFinite(post && post.followers) && post.followers >= s.min && post.followers < s.max) || null;
    return h ? { source: def.historical.source, label: h.label, n: h.n, q: h.repostsPerLike, position: position(shape.repostsPerLike, h.repostsPerLike) } : { source: def.historical.source, noStratum: true };
  })() : null;
  return { platform, shape, own, current, currentInsufficient: !current, stratum: st ? st.label : null, historical, outlier: !!own.outlier };
}
