// Content Credentials survival: of the media files Radar checked (on the user's click), how many
// still carried intact credentials, per platform. Platforms often strip credentials on upload; a
// count of what survived tells the user how much the credentials check can do on each site.
// Radar keeps one entry per file: a short hash of its address (not the address), the site, the
// outcome and the time, in chrome.storage.local ("pb.media.v1"), pruned with the history setting.

import { credentialState } from "./c2pa.js";
import { wilson } from "./report.js";

export const MEDIA_KEY = "pb.media.v1", MAX_MEDIA = 5000;

// The outcome of one check: intact (found and every check passed), partial (found, not every part
// could be checked), changed, remote (the file points to credentials online), none, or null for a
// file Radar could not read, which counts nowhere.
export function outcomeOf(result) {
  if (!result || result.error) return null;
  return { unchanged: "intact", unchecked: "partial", changed: "changed", remote: "remote", none: "none" }[credentialState(result)] || null;
}

function key(url) {
  let h = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) { h ^= url.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36) + url.length.toString(36);
}

// The site a media check ran on: "x.com" for twitter.com, no "www.".
export function siteOf(host) {
  const h = String(host || "").toLowerCase().replace(/^www\./, "").replace(/^mobile\./, "");
  return h === "twitter.com" ? "x.com" : h;
}

// log: { [key]: { at, site, outcome } }. Returns a new log with this check, newest kept.
export function recordCheck(log, { url, host, result }, now = Date.now()) {
  const outcome = outcomeOf(result);
  if (!url || !outcome) return log || {};
  const next = { ...(log || {}), [key(url)]: { at: now, site: siteOf(host), outcome } };
  const keys = Object.keys(next);
  if (keys.length <= MAX_MEDIA) return next;
  return Object.fromEntries(keys.sort((a, b) => next[b].at - next[a].at).slice(0, MAX_MEDIA).map((k) => [k, next[k]]));
}

const OUTCOMES = ["intact", "partial", "changed", "remote", "none"];

// Per site, newest window first: [{ site, n, intact, partial, changed, remote, none, share, ci }],
// where share is intact over all files checked on that site.
export function survival(log, { days = 30, now = Date.now() } = {}) {
  const from = now - days * 86400000, by = new Map();
  for (const e of Object.values(log || {})) {
    if (!e || e.at < from || !OUTCOMES.includes(e.outcome)) continue;
    if (!by.has(e.site)) by.set(e.site, Object.fromEntries([["site", e.site], ["n", 0], ...OUTCOMES.map((o) => [o, 0])]));
    const s = by.get(e.site);
    s.n++; s[e.outcome]++;
  }
  return [...by.values()].map((s) => ({ ...s, share: s.intact / s.n, ci: wilson(s.intact, s.n) })).sort((a, b) => b.n - a.n);
}
