// Builds src/ext/claims.json, the fact-checked claims table src/core/claims.js matches against.
// Run at build time only. Radar never fetches fact-check data from the browser.
//
// Source: the Data Commons fact-check feed, ClaimReview markup published by fact-checkers and
// collected by Google's Fact Check Tools. Data Commons publishes the feed under CC BY 4.0
// (https://datacommons.org/factcheck/download, checked 2026-10-21). A row whose own sdLicense
// field names a licence outside OPEN_LICENCES is dropped. Sources with unknown terms are not
// used; see data/claims.README.md.
//
//   node scripts/claims-build.mjs                    download the feed (about 200 MB), then build
//   node scripts/claims-build.mjs --in feed.json     build from a copy already on disk
//   --max-bytes N (default 6000000)   --per-checker N (default 1500)
//
// Kept per row: the claim as the fact-checker summarised it, the rating in their words, their
// name, the review URL and date, and a guessed language. Dropped: the person or account the
// fact-checker says made the claim, and the links to where it appeared, because those name
// other people and Radar does not need them to show the review.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { guessLanguage, claimTokens, MIN_CLAIM_TOKENS } from "../src/core/claims.js";

const FEED = "https://storage.googleapis.com/datacommons-feeds/factcheck/latest/data.json";
const OPEN_LICENCES = /creativecommons\.org\/(?:licenses\/by\/|licenses\/by-sa\/|publicdomain\/zero\/)|^CC[- ]?BY|^CC0/i;
const CLAIM_MAX = 300, RATING_MAX = 80;

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function loadFeed() {
  const file = arg("--in", null);
  if (file) return JSON.parse(readFileSync(file, "utf8"));
  const res = await fetch(FEED, { headers: { "User-Agent": "Radar claims table builder (local, manual run)" } });
  if (!res.ok) throw new Error(`feed download failed: ${res.status}`);
  return res.json();
}

const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
const trim = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s);

// One feed item to a row, or null with the reason it was dropped.
function rowOf(item, element) {
  if (!item || item["@type"] !== "ClaimReview") return [null, "not ClaimReview"];
  if (item.sdLicense && !OPEN_LICENCES.test(String(item.sdLicense))) return [null, "closed sdLicense"];
  const claim = clean(item.claimReviewed), rating = clean((item.reviewRating || {}).alternateName);
  const checker = clean((item.author || {}).name), url = clean(item.url);
  if (!claim || !rating || !checker) return [null, "missing claim, rating or checker"];
  if (!/^https?:\/\//.test(url)) return [null, "no review URL"];
  if (rating.length > RATING_MAX) return [null, "rating too long to quote"];
  if (claimTokens(claim).tokens.length < MIN_CLAIM_TOKENS) return [null, "claim too short to match"];
  const date = String(item.datePublished || element.dateCreated || "").slice(0, 10);
  const ok = /^(19|20)\d\d-\d\d-\d\d$/.test(date) && date <= new Date().toISOString().slice(0, 10);
  return [{ claim: trim(claim, CLAIM_MAX), rating, checker, url, date: ok ? date : null }, null];
}

function collect(feed) {
  const rows = [], dropped = {}, seen = new Set();
  for (const el of feed.dataFeedElement || []) for (const item of el.item || []) {
    const [row, why] = rowOf(item, el);
    if (!row) { dropped[why] = (dropped[why] || 0) + 1; continue; }
    const key = row.url + "|" + row.claim;
    if (seen.has(key)) { dropped.duplicate = (dropped.duplicate || 0) + 1; continue; }
    seen.add(key);
    rows.push(row);
  }
  return { rows, dropped };
}

// Newest first, at most `perChecker` rows from any one fact-checker, until the byte cap.
function select(rows, maxBytes, perChecker) {
  rows.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const checkers = [], ci = new Map(), count = new Map(), out = [];
  let bytes = 1000;   // room for the header fields
  for (const r of rows) {
    const key = r.checker.toLowerCase();
    if ((count.get(key) || 0) >= perChecker) continue;
    const fresh = !ci.has(r.checker), index = fresh ? checkers.length : ci.get(r.checker);
    const packed = [r.claim, r.rating, index, r.url, r.date, guessLanguage(r.claim)];
    const size = Buffer.byteLength(JSON.stringify(packed)) + 1 + (fresh ? Buffer.byteLength(JSON.stringify(r.checker)) + 1 : 0);
    if (bytes + size > maxBytes) break;
    if (fresh) { ci.set(r.checker, index); checkers.push(r.checker); }
    bytes += size;
    count.set(key, (count.get(key) || 0) + 1);
    out.push(packed);
  }
  return { checkers, rows: out, checkerCount: checkers.length };
}

const maxBytes = Number(arg("--max-bytes", 6000000)), perChecker = Number(arg("--per-checker", 1500));
const feed = await loadFeed();
const { rows, dropped } = collect(feed);
const picked = select(rows, maxBytes, perChecker);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const table = {
  built: new Date().toISOString().slice(0, 10),
  feedModified: feed.dateModified || null,
  source: { name: "Data Commons fact-check feed", url: "https://datacommons.org/factcheck/download", licence: "CC BY 4.0", licenceUrl: "https://creativecommons.org/licenses/by/4.0/", attribution: "ClaimReview markup published by each fact-checker, collected by Google Fact Check Tools and Data Commons." },
  fields: ["claim", "rating", "checker", "url", "date", "langGuess"],
  checkers: picked.checkers,
  rows: picked.rows,
};
const json = JSON.stringify(table);
writeFileSync(join(root, "src/ext/claims.json"), json);
const dates = picked.rows.map((r) => r[4]).filter(Boolean).sort();
console.log(`${rows.length} usable reviews -> ${picked.rows.length} rows from ${picked.checkerCount} fact-checkers, ${Buffer.byteLength(json)} bytes, ${dates[0]} to ${dates[dates.length - 1]}`);
console.log("dropped:", JSON.stringify(dropped));
