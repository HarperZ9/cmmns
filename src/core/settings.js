// CMMNS' settings, in one normalised shape for the toolbar popup, the first-run and options pages
// and the content scripts, plus the retention prune the background worker runs. Settings live in
// chrome.storage.local under SETTINGS_KEY, on this machine only.

import { FEED_OUTLETS, cleanFeedUrl, MAX_CUSTOM_FEEDS } from "./outlets.js";

export const SETTINGS_KEY = "pb.settings";

// Sites CMMNS has an adapter for. A site added later starts on unless the user switches it off.
export const SITES = [["x", "X"], ["youtube", "YouTube"], ["reddit", "Reddit"], ["facebook", "Facebook"], ["instagram", "Instagram"], ["bluesky", "Bluesky"], ["threads", "Threads"],
  ["mastodon", "Mastodon"], ["tiktok", "TikTok"]];

// Search engines where CMMNS can show site cards on result links. Each is off until the user turns
// it on in the options page, which asks the browser for access to that engine's result pages.
// [id, name, result-page matches, origin the browser grants]
export const SEARCH_ENGINES = [["google", "Google", ["https://www.google.com/search*"], "https://www.google.com/*"], ["bing", "Bing", ["https://www.bing.com/search*"], "https://www.bing.com/*"], ["duckduckgo", "DuckDuckGo", ["https://duckduckgo.com/*"], "https://duckduckgo.com/*"]];

// The areas of the window's strip; each can be hidden from the window.
export const AREA_IDS = ["place", "account", "posting", "coordination", "language", "sources", "media"];

// Retention in days. The upper limits are what the logs keep at most (history.js keeps 60 days;
// the connections and trail logs keep 30, so a longer history setting leaves those at 30).
export const RETENTION = { historyDays: { min: 1, max: 60 }, aboutDays: { min: 1, max: 30 }, seenDays: { min: 1, max: 365 } };

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
  // The pressure lens (src/core/reading-pressure.js): its own switch, off by default.
  pressureLens: false,
  // The discourse checks (src/core/discourse/): quote sources, persona names, counts with their sample
  // size, document images against the post and correction replies. Off by default; all run on this device.
  discourse: false,
  // The argument lens (src/core/discourse/argument.js), under the discourse checks: its own switch, and
  // "every argument role" to show roles that have not passed their held-out gate. Both off by default.
  argumentLens: false, argumentAll: false,
  // Ad blocking (src/ext/adblock-bg.js): off by default; sites in adblockAllow are always left alone.
  adblock: false, adblockAllow: [],
  // One-click downloads (src/ext/quick-*.js): the Download button on X and Reddit posts, on by
  // default; "always ask where to save" off, so files go straight to the Downloads folder.
  mediaButtons: true, mediaAskWhere: false,
  // The post's words with each download: a .md sidecar and the description inside the file, on by
  // default; a .json sidecar for tools, off by default.
  mediaSidecar: true, mediaEmbed: true, mediaSidecarJson: false,
  // Where saves land inside Downloads: "<mediaFolder>/<site>/". Empty saves straight into Downloads.
  mediaFolder: "CMMNS",
  // Saving straight into Downloads, with no folders, is its own switch, never an empty folder name.
  mediaToRoot: false,
  // Source-protection mode (project-docs/SECURITY-REVIEW.md): off by default. While on, every
  // switch in PROTECTION_FORCES is held off, and the save page and Share clean behave as it says.
  protection: false,
  // The hover Download control (src/ext/quick-hover.js): on by default; on every site once the user
  // allows that access; never on the sites listed in hoverOffSites.
  hoverDownload: true, hoverEverywhere: true, hoverOffSites: [],
  // Engagement over time (src/core/engagement-series.js, project-docs/ENGAGEMENT-SERIES.md), none of
  // which makes a request: re-reading saved posts from the page's own data, on by default; the
  // reminder of due readings on the badge, off by default; the log of every post the page loaded,
  // off by default and kept seenDays days.
  trackSeries: true, trackRemind: false, seenLog: false, seenDays: 90,
});

// The save folder before the 2026-10-28 rename to CMMNS, and the release that renamed it. A browser
// that had the extension before that release keeps saving into Downloads/Daylight: on its update,
// src/ext/lifecycle.js stores the folder it used (legacyFolderPatch). New installs save under CMMNS.
// Readers of saved files take any folder, so both trees read the same.
export const LEGACY_MEDIA_FOLDER = "Daylight";
export const MEDIA_FOLDERS = Object.freeze([DEFAULTS.mediaFolder, LEGACY_MEDIA_FOLDER]);
export const FOLDER_RENAMED_IN = "3.9.0";

const older = (a, b) => {
  const pa = String(a).split(".").map(Number), pb = String(b).split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) < (pb[i] || 0);
  return false;
};

// On an update from previousVersion: the settings to store so the save folder does not move, or
// null when nothing needs writing (a version from after the rename, or a folder already stored).
export function legacyFolderPatch(raw, previousVersion) {
  if (!previousVersion || !/^\d+(\.\d+){0,3}$/.test(String(previousVersion)) || !older(previousVersion, FOLDER_RENAMED_IN)) return null;
  const s = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  if (typeof s.mediaFolder === "string" && s.mediaFolder.trim()) return null;
  return { ...s, mediaFolder: LEGACY_MEDIA_FOLDER };
}

// What source-protection mode holds off while it is on: evidence lookups (GitHub, RDAP, the Internet
// Archive), Other coverage (outlets' feeds), reading About pages automatically, and one-click
// downloads (which fetch the file again from its host). Turning the mode off leaves them off until
// the user turns each one back on.
export const PROTECTION_FORCES = Object.freeze({ evidence: false, coverage: false, feedConsent: false, auto: false, mediaButtons: false });
// A folder path inside Downloads: letters, digits, spaces, dots, hyphens, underscores and slashes,
// no ".." part, at most 120 characters.
const folder = (v, d) => (typeof v !== "string" ? d
  : v.split(/[\\/]+/).map((p) => p.replace(/[^\p{L}\p{N} ._-]+/gu, "-").trim()).filter((p) => p && !/^\.+$/.test(p)).join("/").slice(0, 120));

const feedList = (v) => (Array.isArray(v) ? [...new Set(v.map(cleanFeedUrl).filter(Boolean))].slice(0, MAX_CUSTOM_FEEDS) : []);
// Sites the user exempts from ad blocking: lower-case host names, at most 500.
const siteList = (v) => (Array.isArray(v) ? [...new Set(v.filter((h) => typeof h === "string" && /^[a-z0-9.-]{1,253}$/i.test(h)).map((h) => h.toLowerCase().replace(/^www\./, "")))].slice(0, 500) : []);
const bool = (v, d) => (typeof v === "boolean" ? v : d);
const days = (v, d, r) => (Number.isFinite(Number(v)) && v !== null && v !== "" ? Math.min(r.max, Math.max(r.min, Math.round(Number(v)))) : d);
const switches = (v, allowed) => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  return Object.fromEntries(Object.entries(v).filter(([k, x]) => typeof x === "boolean" && (!allowed || allowed.includes(k))));
};

export function normalizeSettings(raw) {
  const s = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const out = {
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
    pressureLens: bool(s.pressureLens, DEFAULTS.pressureLens),
    discourse: bool(s.discourse, DEFAULTS.discourse),
    argumentLens: bool(s.argumentLens, DEFAULTS.argumentLens), argumentAll: bool(s.argumentAll, DEFAULTS.argumentAll),
    adblock: bool(s.adblock, DEFAULTS.adblock), adblockAllow: siteList(s.adblockAllow),
    mediaButtons: bool(s.mediaButtons, DEFAULTS.mediaButtons), mediaAskWhere: bool(s.mediaAskWhere, DEFAULTS.mediaAskWhere),
    mediaSidecar: bool(s.mediaSidecar, DEFAULTS.mediaSidecar), mediaEmbed: bool(s.mediaEmbed, DEFAULTS.mediaEmbed), mediaSidecarJson: bool(s.mediaSidecarJson, DEFAULTS.mediaSidecarJson),
    mediaFolder: folder(s.mediaFolder, DEFAULTS.mediaFolder) || DEFAULTS.mediaFolder,
    mediaToRoot: bool(s.mediaToRoot, DEFAULTS.mediaToRoot),
    protection: bool(s.protection, DEFAULTS.protection),
    hoverDownload: bool(s.hoverDownload, DEFAULTS.hoverDownload), hoverEverywhere: bool(s.hoverEverywhere, DEFAULTS.hoverEverywhere), hoverOffSites: siteList(s.hoverOffSites),
    trackSeries: bool(s.trackSeries, DEFAULTS.trackSeries), trackRemind: bool(s.trackRemind, DEFAULTS.trackRemind),
    seenLog: bool(s.seenLog, DEFAULTS.seenLog), seenDays: days(s.seenDays, DEFAULTS.seenDays, RETENTION.seenDays),
  };
  return out.protection ? { ...out, ...PROTECTION_FORCES } : out;
}

// The fixture harness behaves as an X page, so it follows the X switch.
export function siteOn(s, id) {
  const key = id === "fixture" ? "x" : id;
  return !s.paused && s.sites[key] !== false;
}

export const areaOn = (s, area) => s.areas[area] !== false;
export const searchOn = (s, id) => !s.paused && s.search[id] === true;

// The toolbar icon: paused when CMMNS is paused or off for this site, reading while it is reading
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

// "Clear all CMMNS data": every CMMNS key except the settings themselves. The Mastodon servers the
// user turned on (pb.instances.v1) are settings too, removed in the options page with their access.
// The tour's "No more tips" (pb.tour, src/core/learn.js) is a choice like a setting, so clearing data keeps it.
// Imported data packs and the keys the user trusts (src/ext/packs-bg.js) are choices too.
const KEPT = new Set([SETTINGS_KEY, "pb.tour", "pb.instances.v1", "pb.packs.v1", "pb.packkeys.v1"]);
export const dataKeys = (keys) => keys.filter((k) => k.startsWith("pb.") && !KEPT.has(k));
