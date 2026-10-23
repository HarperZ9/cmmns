// Daylight Commons' settings, in one normalised shape for the toolbar popup, the first-run and options pages
// and the content scripts, plus the retention prune the background worker runs. Settings live in
// chrome.storage.local under SETTINGS_KEY, on this machine only.

import { FEED_OUTLETS, cleanFeedUrl, MAX_CUSTOM_FEEDS } from "./outlets.js";

export const SETTINGS_KEY = "pb.settings";

// Sites Daylight Commons has an adapter for. A site added later starts on unless the user switches it off.
export const SITES = [["x", "X"], ["youtube", "YouTube"], ["reddit", "Reddit"], ["facebook", "Facebook"], ["instagram", "Instagram"], ["bluesky", "Bluesky"], ["threads", "Threads"],
  ["mastodon", "Mastodon"], ["tiktok", "TikTok"]];

// Search engines where Daylight Commons can show site cards on result links. Each is off until the user turns
// it on in the options page, which asks the browser for access to that engine's result pages.
// [id, name, result-page matches, origin the browser grants]
export const SEARCH_ENGINES = [["google", "Google", ["https://www.google.com/search*"], "https://www.google.com/*"], ["bing", "Bing", ["https://www.bing.com/search*"], "https://www.bing.com/*"], ["duckduckgo", "DuckDuckGo", ["https://duckduckgo.com/*"], "https://duckduckgo.com/*"]];

// The areas of the window's strip; each can be hidden from the window.
export const AREA_IDS = ["place", "account", "posting", "coordination", "language", "sources", "media"];

// Retention in days. The upper limits are what the logs keep at most (history.js keeps 60 days;
// the connections and trail logs keep 30, so a longer history setting leaves those at 30).
export const RETENTION = { historyDays: { min: 1, max: 60 }, aboutDays: { min: 1, max: 30 } };

export const DEFAULTS = Object.freeze({
  paused: false, feeds: true, auto: true, sites: {}, areas: {},
  historyDays: 60, aboutDays: 14, calm: false, large: false, onboarded: false,
  // Other coverage (src/core/coverage.js): off until the user turns it on. outlets are the suggested
  // feeds the user switched on (src/core/outlets.js), customFeeds the addresses they added, and
  // feedConsent is set when the user has read which hosts a lookup asks and clicked to ask them.
  search: {}, coverage: false, feedConsent: false, outlets: {}, customFeeds: [],
  // Read text in images (src/core/imagetext.js, src/ocr): off until the user turns it on; even then
  // it runs only on a click, on this device.
  imageText: false,
  // Evidence lookups (src/core/evidence-fetch.js): off until the user reads what is sent to GitHub,
  // RDAP and the Internet Archive and clicks to allow it; even then each lookup is one click.
  evidence: false,
  // The reading lens (src/core/reading.js): techniques under the held-out bar stay off unless the
  // user turns them all on here.
  lensAll: false,
});

const feedList = (v) => (Array.isArray(v) ? [...new Set(v.map(cleanFeedUrl).filter(Boolean))].slice(0, MAX_CUSTOM_FEEDS) : []);
const bool = (v, d) => (typeof v === "boolean" ? v : d);
const days = (v, d, r) => (Number.isFinite(Number(v)) && v !== null && v !== "" ? Math.min(r.max, Math.max(r.min, Math.round(Number(v)))) : d);
const switches = (v, allowed) => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  return Object.fromEntries(Object.entries(v).filter(([k, x]) => typeof x === "boolean" && (!allowed || allowed.includes(k))));
};

export function normalizeSettings(raw) {
  const s = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    paused: bool(s.paused, DEFAULTS.paused), feeds: bool(s.feeds, DEFAULTS.feeds), auto: bool(s.auto, DEFAULTS.auto),
    sites: switches(s.sites), areas: switches(s.areas, AREA_IDS),
    historyDays: days(s.historyDays, DEFAULTS.historyDays, RETENTION.historyDays),
    aboutDays: days(s.aboutDays, DEFAULTS.aboutDays, RETENTION.aboutDays),
    calm: bool(s.calm, DEFAULTS.calm), large: bool(s.large, DEFAULTS.large), onboarded: bool(s.onboarded, DEFAULTS.onboarded),
    search: switches(s.search, SEARCH_ENGINES.map(([id]) => id)), coverage: bool(s.coverage, DEFAULTS.coverage),
    feedConsent: bool(s.coverage, false) && bool(s.feedConsent, false),
    outlets: switches(s.outlets, FEED_OUTLETS.map(([id]) => id)), customFeeds: feedList(s.customFeeds),
    imageText: bool(s.imageText, DEFAULTS.imageText),
    evidence: bool(s.evidence, DEFAULTS.evidence),
    lensAll: bool(s.lensAll, DEFAULTS.lensAll),
  };
}

// The fixture harness behaves as an X page, so it follows the X switch.
export function siteOn(s, id) {
  const key = id === "fixture" ? "x" : id;
  return !s.paused && s.sites[key] !== false;
}

export const areaOn = (s, area) => s.areas[area] !== false;
export const searchOn = (s, id) => !s.paused && s.search[id] === true;

// The toolbar icon: paused when Daylight Commons is paused or off for this site, reading while it is reading
// accounts, idle otherwise.
export function iconState({ paused, siteOff, reading } = {}) {
  if (paused || siteOff) return "paused";
  return reading ? "reading" : "idle";
}

const DAY = 86400000;
const keepMap = (m, field, cutoff) => Object.fromEntries(Object.entries(m || {}).filter(([, v]) => v && (v[field] || 0) >= cutoff));
const size = (m) => Object.keys(m || {}).length;

// Drop every entry older than the user's retention. Returns only the keys whose value changed.
export function pruneStore(store, settings, now = Date.now()) {
  const s = normalizeSettings(settings);
  const hist = now - s.historyDays * DAY, about = now - s.aboutDays * DAY;
  const out = {};
  const H = store["pb.history.v1"];
  if (H) { const k = keepMap(H, "at", hist); if (size(k) !== size(H)) out["pb.history.v1"] = k; }
  // The connections log moved to v2 (threads keyed by post id); v1 is pruned until it empties.
  for (const key of ["pb.net.v1", "pb.net.v2"]) {
    const N = store[key];
    if (N && N.threads) { const k = keepMap(N.threads, "at", hist); if (size(k) !== size(N.threads)) out[key] = { ...N, threads: k }; }
  }
  const F = store["pb.feed.v1"];
  if (F) { const k = keepMap(F, "at", hist); if (size(k) !== size(F)) out["pb.feed.v1"] = k; }
  const M = store["pb.media.v1"];
  if (M) { const k = keepMap(M, "at", hist); if (size(k) !== size(M)) out["pb.media.v1"] = k; }
  const T = store["pb.trail.v1"];
  if (T) {
    const media = keepMap(T.media, "seen", hist), links = keepMap(T.links, "seen", hist);
    if (size(media) !== size(T.media) || size(links) !== size(T.links)) out["pb.trail.v1"] = { ...T, media, links };
  }
  for (const key of ["pb.about.v1", "pb.reddit.v1"]) {
    const A = store[key];
    if (A) { const k = keepMap(A, "at", about); if (size(k) !== size(A)) out[key] = k; }
  }
  return out;
}

export const PRUNED_KEYS = ["pb.history.v1", "pb.net.v1", "pb.net.v2", "pb.feed.v1", "pb.media.v1", "pb.trail.v1", "pb.about.v1", "pb.reddit.v1"];

// "Clear all Daylight Commons data": every Daylight Commons key except the settings themselves. The Mastodon servers the
// user turned on (pb.instances.v1) are settings too, removed in the options page with their access.
// The tour's "No more tips" (pb.tour, src/core/learn.js) is a choice like a setting, so clearing data keeps it.
// Imported data packs and the keys the user trusts (src/ext/packs-bg.js) are choices too.
const KEPT = new Set([SETTINGS_KEY, "pb.tour", "pb.instances.v1", "pb.packs.v1", "pb.packkeys.v1"]);
export const dataKeys = (keys) => keys.filter((k) => k.startsWith("pb.") && !KEPT.has(k));
