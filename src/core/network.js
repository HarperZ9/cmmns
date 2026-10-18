// Connections and activity across the threads the user has viewed. Radar keeps a small local log
// (chrome.storage.local, this browser only): which accounts replied in which thread, and how many
// seconds after the original post. From it Radar shows, per account, how often it turns up, which
// accounts it keeps turning up alongside, and how fast it replies; per thread, groups of accounts
// that have appeared together before. Entries older than RETAIN_DAYS are dropped; the user can
// clear the log. Nothing is linked across platforms.

export const RETAIN_DAYS = 30, MAX_THREADS = 2000;
const DAY = 86400000;

// log: { threads: { [threadKey]: { at, authors: { [handle]: delaySeconds|null } } } }
// rows: [{ author, posted }], rootPosted: ISO time of the original post (or null)
export function recordThread(log, threadKey, rows, rootPosted, now = Date.now()) {
  const L = { threads: { ...((log && log.threads) || {}) } };
  const t0 = Date.parse(rootPosted);
  const authors = {}, hours = {};
  for (const r of rows) {
    const t = Date.parse(r.posted);
    const delay = Number.isFinite(t0) && Number.isFinite(t) ? Math.max(0, Math.round((t - t0) / 1000)) : null;
    const h = r.author.toLowerCase();
    if (!(h in authors) || (delay != null && (authors[h] == null || delay < authors[h]))) authors[h] = delay;
    if (Number.isFinite(t)) (hours[h] = hours[h] || []).push(t);
  }
  L.threads[threadKey] = { at: now, authors, posts: hours };
  // retention and size cap, oldest first
  const keys = Object.keys(L.threads).filter((k) => now - L.threads[k].at <= RETAIN_DAYS * DAY).sort((a, b) => L.threads[b].at - L.threads[a].at);
  return { threads: Object.fromEntries(keys.slice(0, MAX_THREADS).map((k) => [k, L.threads[k]])) };
}

const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

// One account's activity across the log.
export function activity(log, handle) {
  const h = String(handle).toLowerCase();
  const threads = Object.values((log && log.threads) || {}).filter((t) => h in t.authors);
  const delays = threads.map((t) => t.authors[h]).filter((d) => d != null);
  const together = new Map();
  for (const t of threads) for (const other of Object.keys(t.authors)) if (other !== h) together.set(other, (together.get(other) || 0) + 1);
  return {
    threads: threads.length,
    firstSeen: threads.length ? new Date(Math.min(...threads.map((t) => t.at))).toISOString().slice(0, 10) : null,
    medianDelay: median(delays),
    fastReplies: delays.filter((d) => d <= 60).length,
    activeHours: activeHours(threads.flatMap((t) => (t.posts && t.posts[h]) || [])),
    alongside: [...together].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([other, n]) => ({ handle: other, n })),
  };
}

// Pairs of accounts in this thread that have appeared together in at least `min` other threads.
export function returningGroups(log, threadKey, handles, min = 2) {
  const hs = [...new Set(handles.map((x) => x.toLowerCase()))];
  const others = Object.entries((log && log.threads) || {}).filter(([k]) => k !== threadKey).map(([, t]) => t.authors);
  const pairs = [];
  for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) {
    const n = others.filter((a) => hs[i] in a && hs[j] in a).length;
    if (n >= min) pairs.push({ a: hs[i], b: hs[j], n });
  }
  return pairs.sort((x, y) => y.n - x.n).slice(0, 10);
}

// Inferred from posting times Radar has seen: the UTC offset whose waking day (08:00 to 24:00 local)
// holds the most posts. Needs MIN_POSTS posts over MIN_DAYS days; otherwise null. This is an
// inference about when the account is operated, not where anyone lives: shift workers, night
// owls, schedulers and teams across time zones all break it.
export const MIN_POSTS = 12, MIN_DAYS = 3;
export function activeHours(times) {
  const ts = [...new Set(times)].filter(Number.isFinite);
  const days = new Set(ts.map((t) => Math.floor(t / DAY))).size;
  if (ts.length < MIN_POSTS || days < MIN_DAYS) return null;
  const hist = new Array(24).fill(0);
  for (const t of ts) hist[new Date(t).getUTCHours()]++;
  let best = { offset: 0, share: 0 };
  for (let off = -12; off <= 14; off++) {
    let inWake = 0;
    for (let utc = 0; utc < 24; utc++) { const local = (utc + off + 48) % 24; if (local >= 8) inWake += hist[utc]; }
    const share = inWake / ts.length;
    if (share > best.share) best = { offset: off, share };
  }
  const quiet = hist.map((n, utc) => ({ utc, n })).filter((x) => x.n === 0).map((x) => x.utc);
  return { utcOffset: best.offset, fit: Math.round(best.share * 100) / 100, posts: ts.length, days, quietUtcHours: quiet };
}
