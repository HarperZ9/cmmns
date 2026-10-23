// How an account posts, from the posts X has loaded for it (a profile timeline, a thread, a search):
// which apps it posts from, how much is reposts and replies, how often, and whether it ever stops.
// Everything describes the account's behaviour; none of it says who runs it.
// Hours of the day need times to the hour and gaps between posts need seconds (precision.js); below
// that, those fields are null and timeNotObservable names them.

import { timePrecision, observable, NOT_OBSERVABLE } from "./precision.js";

export const MIN_PATTERN_POSTS = 10;

const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

// posts: tweets by one author, as tweetsIn() returns them ({ posted, client, repostOf, replyTo, quotedId, media, lang }).
// opts.precision: how precise the times are, when known; otherwise it is inferred from them.
export function postingPattern(posts, opts = {}) {
  const ps = [...new Map(posts.filter((p) => p && p.posted).map((p) => [p.id, p])).values()].sort((a, b) => Date.parse(a.posted) - Date.parse(b.posted));
  if (ps.length < MIN_PATTERN_POSTS) return null;
  const n = ps.length, share = (f) => Math.round((ps.filter(f).length / n) * 100) / 100;
  const clients = new Map();
  for (const p of ps) if (p.client) clients.set(p.client, (clients.get(p.client) || 0) + 1);
  const langs = new Map();
  for (const p of ps) if (p.lang) langs.set(p.lang, (langs.get(p.lang) || 0) + 1);
  const times = ps.map((p) => Date.parse(p.posted));
  const gaps = times.slice(1).map((t, i) => Math.round((t - times[i]) / 1000));
  const hours = new Set(times.map((t) => new Date(t).getUTCHours()));
  const days = new Set(times.map((t) => new Date(t).toISOString().slice(0, 10)));
  const spanDays = Math.max(1, (times[n - 1] - times[0]) / 86400000);
  const prec = timePrecision(ps, opts.precision).precision, byHour = observable(prec, "active-hours"), bySecond = observable(prec, "fast-replier");
  return {
    posts: n, from: new Date(times[0]).toISOString(), to: new Date(times[n - 1]).toISOString(), days: days.size,
    perDay: Math.round((n / spanDays) * 10) / 10,
    reposts: share((p) => p.repostOf), replies: share((p) => p.replyTo && !p.repostOf), quotes: share((p) => p.quotedId), media: share((p) => (p.media || []).length),
    clients: [...clients].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, k]) => ({ name, share: Math.round((k / n) * 100) / 100 })),
    langs: [...langs].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([lang, k]) => ({ lang, share: Math.round((k / n) * 100) / 100 })),
    medianGapSec: bySecond ? median(gaps) : null,
    // Hours of the UTC day with at least one post; people sleep, so 22 or more over several days is rare.
    activeUtcHours: byHour ? hours.size : null,
    // For the window's small charts: posts per UTC hour of the day, and per day for the last 14 days.
    hourHist: byHour ? Array.from({ length: 24 }, (_, h) => times.filter((t) => new Date(t).getUTCHours() === h).length) : null,
    timePrecision: prec,
    timeNotObservable: byHour && bySecond ? null : `${[!byHour && "hours of the day", !bySecond && "gaps between posts"].filter(Boolean).join(" and ")}: ${NOT_OBSERVABLE}`,
    daily: lastDays(times, 14),
  };
}

function lastDays(times, n) {
  const end = new Date(times[times.length - 1]); end.setUTCHours(0, 0, 0, 0);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(end.getTime() - (n - 1 - i) * 86400000).toISOString().slice(0, 10);
    return { day: d, n: times.filter((t) => new Date(t).toISOString().slice(0, 10) === d).length };
  });
}

// Group a batch of loaded posts by author (lower-case handle).
export function byAuthor(tweets) {
  const m = new Map();
  for (const t of tweets) if (t.author) { const k = t.author.toLowerCase(); (m.get(k) || m.set(k, []).get(k)).push(t); }
  return m;
}
