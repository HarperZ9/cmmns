// Shared by scripts/claims-build.mjs and scripts/sites-build.mjs: reads the Data Commons
// ClaimReview feed into rows, each with the sites where the fact-checker said the claim appeared
// (src/core/hosts.js reviewSites). Build time only; Daylight Commons never fetches the feed from the browser.
import { readFileSync } from "node:fs";
import { claimTokens, MIN_CLAIM_TOKENS } from "../src/core/claims.js";
import { reviewSites, siteKey, hostOf } from "../src/core/hosts.js";

export const FEED = "https://storage.googleapis.com/datacommons-feeds/factcheck/latest/data.json";
const OPEN_LICENCES = /creativecommons\.org\/(?:licenses\/by\/|licenses\/by-sa\/|publicdomain\/zero\/)|^CC[- ]?BY|^CC0/i;
const CLAIM_MAX = 300, RATING_MAX = 80;

export function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

export async function loadFeed() {
  const file = arg("--in", null);
  if (file) return JSON.parse(readFileSync(file, "utf8"));
  const res = await fetch(FEED, { headers: { "User-Agent": "Daylight Commons table builder (local, manual run)" } });
  if (!res.ok) throw new Error(`feed download failed: ${res.status}`);
  return res.json();
}

const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
export const trim = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s);
const items = (feed) => (feed.dataFeedElement || []).flatMap((el) => (el.item || []).map((item) => [item, el]));

// The site key of every fact-checker's review URL, so no fact-check page counts as an appearance.
export function checkerSites(feed) {
  const out = new Set();
  for (const [item] of items(feed)) { const k = siteKey(hostOf(item && item.url)); if (k) out.add(k); }
  return out;
}

// One feed item to a row, or null with the reason it was dropped.
function rowOf(item, element, checkers) {
  if (!item || item["@type"] !== "ClaimReview") return [null, "not ClaimReview"];
  if (item.sdLicense && !OPEN_LICENCES.test(String(item.sdLicense))) return [null, "closed sdLicense"];
  const claim = clean(item.claimReviewed), rating = clean((item.reviewRating || {}).alternateName);
  const checker = clean((item.author || {}).name), url = clean(item.url);
  if (!claim || !rating || !checker) return [null, "missing claim, rating or checker"];
  if (!/^https?:\/\//.test(url)) return [null, "no review URL"];
  // Malformed publisher data: markup in a name or rating, or a link given as the fact-checker's name.
  if (/[<>]/.test(claim + rating + checker) || /^https?:\/\/|^www\./i.test(checker)) return [null, "malformed name or rating"];
  if (rating.length > RATING_MAX) return [null, "rating too long to quote"];
  const date = String(item.datePublished || element.dateCreated || "").slice(0, 10);
  const ok = /^(19|20)\d\d-\d\d-\d\d$/.test(date) && date <= new Date().toISOString().slice(0, 10);
  const at = reviewSites(item, checkers);
  return [{ claim: trim(claim, CLAIM_MAX), rating, checker, url, date: ok ? date : null, sites: at.sites, appear: at, short: claimTokens(claim).tokens.length < MIN_CLAIM_TOKENS }, null];
}

// Every usable review once (by URL and claim), with drop reasons counted.
export function collect(feed) {
  const checkers = checkerSites(feed), rows = [], dropped = {}, seen = new Set();
  for (const [item, el] of items(feed)) {
    const [row, why] = rowOf(item, el, checkers);
    if (!row) { dropped[why] = (dropped[why] || 0) + 1; continue; }
    const key = row.url + "|" + row.claim;
    if (seen.has(key)) { dropped.duplicate = (dropped.duplicate || 0) + 1; continue; }
    seen.add(key);
    rows.push(row);
  }
  return { rows, dropped, checkers };
}

// How often a review names a site where its claim appeared, and why the rest do not.
export function appearanceStats(rows) {
  const s = { reviews: rows.length, withAppearance: 0, withSite: 0, platformOnly: 0, archiveOnly: 0, shortenerOnly: 0, wordsOfOthersOnly: 0, factCheckerOnly: 0, other: 0, hosted: {} };
  for (const r of rows) {
    const a = r.appear;
    for (const k of a.hosted) s.hosted[k] = (s.hosted[k] || 0) + 1;
    if (!a.urls) continue;
    s.withAppearance++;
    if (a.sites.length) { s.withSite++; continue; }
    const kinds = new Set(a.hosted);
    if (kinds.size === 1 && kinds.has("platform")) s.platformOnly++;
    else if (kinds.size === 1 && kinds.has("archive")) s.archiveOnly++;
    else if (kinds.size === 1 && kinds.has("shortener")) s.shortenerOnly++;
    else if (kinds.size && [...kinds].every((k) => ["transcript", "aggregator", "fact-check tool", "hosting"].includes(k))) s.wordsOfOthersOnly++;
    else if (!kinds.size && a.excluded) s.factCheckerOnly++;
    else s.other++;
  }
  return s;
}
