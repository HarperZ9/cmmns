// History across the threads the user has viewed: a small snapshot per thread, and aggregates that
// show whether the same few sources keep feeding what the user sees. Everything is computed from
// local logs (this browser only). The numbers describe what the user happened to view, ranked by
// each platform's own algorithm; they are not a sample of the platform, and they say nothing about
// any one account.

import { wilson } from "./report.js";

export const HISTORY_RETAIN_DAYS = 60, HISTORY_MAX = 600;
const DAY = 86400000;

// One thread's snapshot from its report (content.js), small enough to keep hundreds.
export function snapshot(key, site, report, now = Date.now()) {
  return {
    key, site, at: now,
    replies: report.replies, lookedUp: report.lookedUp,
    flaggedK: (report.extreme ? report.extreme.flagged : 0) + (report.others ? report.others.flagged : 0),
    extreme: report.extreme ? { n: report.extreme.n, k: report.extreme.flagged } : null,
    others: report.others ? { n: report.others.n, k: report.others.flagged } : null,
    machine: report.machine ? report.machine.n : 0,
    bursts: (report.bursts || []).length,
    origins: (report.origins || []).slice(0, 8),
    state: (report.state || []).map((s) => ({ state: s.state, basis: s.basis, actor: s.actor || null, replies: s.replies })),
    // Feed dashboard fields (src/core/feed.js); null in snapshots saved before they existed.
    strong: report.strong ? report.strong.n : null,
    techniques: report.techniques || null,
    context: report.context ? { posts: report.context.posts, notes: report.context.notes, claims: report.context.claims, links: (report.context.links || []).slice(0, 20) } : null,
    upstream: report.upstream ? { accounts: report.upstream.accounts, domains: report.upstream.domains, uploads: report.upstream.uploads, recycled: report.upstream.recycled } : null,
  };
}

export function addSnapshot(log, snap, now = Date.now()) {
  const L = { ...(log || {}) };
  L[snap.key] = snap;
  const keys = Object.keys(L).filter((k) => now - L[k].at <= HISTORY_RETAIN_DAYS * DAY).sort((a, b) => L[b].at - L[a].at).slice(0, HISTORY_MAX);
  return Object.fromEntries(keys.map((k) => [k, L[k]]));
}

const tally = (pairs) => { const m = new Map(); for (const [k, n] of pairs) m.set(k, (m.get(k) || 0) + n); return m; };
const top = (m, min = 1, n = 10) => [...m].filter(([, v]) => v >= min).sort((a, b) => b[1] - a[1]).slice(0, n);

// Aggregates. reports: { key: snapshot }, net: connections log (network.js), trail: trail log.
export function summarize(reports, net, trail) {
  const snaps = Object.values(reports || {}).sort((a, b) => a.at - b.at);
  const sum = (f) => snaps.reduce((t, s) => t + (f(s) || 0), 0);
  const looked = sum((s) => s.lookedUp), flagged = sum((s) => s.flaggedK);
  const eN = sum((s) => s.extreme && s.extreme.n), eK = sum((s) => s.extreme && s.extreme.k);
  const oN = sum((s) => s.others && s.others.n), oK = sum((s) => s.others && s.others.k);

  // The funnel: upstream accounts and sites that recur across threads, by the number of threads.
  const upAccounts = tally(snaps.flatMap((s) => ((s.upstream && s.upstream.accounts) || []).map((a) => [a.handle, 1])));
  const upDomains = tally(snaps.flatMap((s) => ((s.upstream && s.upstream.domains) || []).map((d) => [d.domain, 1])));

  // Accounts that keep turning up in different threads (connections log).
  const threads = Object.values((net && net.threads) || {});
  const appearances = tally(threads.flatMap((t) => Object.keys(t.authors || {}).map((h) => [h, 1])));

  // Uploads carried by several accounts (trail log).
  const uploads = Object.values((trail && trail.media) || {}).map((s) => ({ accounts: new Set(s.posts.map((p) => p.handle)).size, posts: s.posts.length, first: s.posts[0] }))
    .filter((u) => u.accounts >= 3).sort((a, b) => b.accounts - a.accounts).slice(0, 10);

  // Per day: accounts read and the share flagged, for a simple trend.
  const byDay = new Map();
  for (const s of snaps) {
    const d = new Date(s.at).toISOString().slice(0, 10);
    const e = byDay.get(d) || { day: d, threads: 0, looked: 0, flagged: 0 };
    e.threads++; e.looked += s.lookedUp || 0; e.flagged += s.flaggedK || 0;
    byDay.set(d, e);
  }

  const stateLinks = tally(snaps.flatMap((s) => (s.state || []).map((x) => [`${x.state}|${x.basis}|${x.actor || ""}`, x.replies])));
  return {
    threads: snaps.length,
    sites: Object.fromEntries(tally(snaps.map((s) => [s.site, 1]))),
    since: snaps.length ? new Date(snaps[0].at).toISOString().slice(0, 10) : null,
    replies: sum((s) => s.replies), looked, flagged,
    flaggedShare: looked ? { share: flagged / looked, ci: wilson(flagged, looked) } : null,
    extreme: eN ? { n: eN, share: eK / eN, ci: wilson(eK, eN) } : null,
    others: oN ? { n: oN, share: oK / oN, ci: wilson(oK, oN) } : null,
    machine: sum((s) => s.machine), bursts: sum((s) => s.bursts),
    origins: top(tally(snaps.flatMap((s) => (s.origins || []).map((o) => [o.place, o.n]))), 1, 12).map(([place, n]) => ({ place, n })),
    funnel: {
      accounts: top(upAccounts, 2).map(([handle, n]) => ({ handle, threads: n })),
      domains: top(upDomains, 2).map(([domain, n]) => ({ domain, threads: n })),
      // How concentrated the upstream is: the share of upstream mentions held by the top 5 sources.
      concentration: (() => { const all = [...upAccounts.values()].reduce((a, b) => a + b, 0); const t5 = top(upAccounts, 1, 5).reduce((a, [, n]) => a + n, 0); return all ? { top5: t5 / all, mentions: all, sources: upAccounts.size } : null; })(),
    },
    recurring: top(appearances, 3, 15).map(([handle, n]) => ({ handle, threads: n })),
    uploads,
    stateLinks: top(stateLinks, 1, 15).map(([k, replies]) => { const [state, basis, actor] = k.split("|"); return { state, basis, actor: actor || null, replies }; }),
    days: [...byDay.values()],
  };
}

export const HISTORY_DOES_NOT_PROVE = "These totals cover the threads you opened, in the order each platform chose to show them. A recurring source shows where your feed's material comes from.";
