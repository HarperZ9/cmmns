// Builds src/ext/claims.json, the fact-checked claims table src/core/claims.js matches against.
// Run at build time only. CMMNS never fetches fact-check data from the browser.
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
// name, the review URL and date, a guessed language, and the site where the fact-checker said the
// claim appeared (its registrable domain only, src/core/hosts.js), or null. Dropped: the person or
// account the fact-checker says made the claim, and the full links to where it appeared, because
// those name other people. A claim posted on a platform keeps no site: the post is the poster's.
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { guessLanguage } from "../src/core/claims.js";
import { splitClaims } from "../src/core/claims-parts.js";
import { arg, loadFeed, collect } from "./feed-rows.mjs";

// Newest first, at most `perChecker` rows from any one fact-checker, until the byte cap.
function select(rows, maxBytes, perChecker) {
  rows.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const checkers = [], ci = new Map(), count = new Map(), out = [];
  let bytes = 1000;   // room for the header fields
  for (const r of rows) {
    const key = r.checker.toLowerCase();
    if ((count.get(key) || 0) >= perChecker) continue;
    const fresh = !ci.has(r.checker), index = fresh ? checkers.length : ci.get(r.checker);
    const packed = [r.claim, r.rating, index, r.url, r.date, guessLanguage(r.claim), r.sites[0] || null];
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
const all = collect(feed), dropped = all.dropped;
const rows = all.rows.filter((r) => !r.short);
dropped["claim too short to match"] = all.rows.length - rows.length;
const picked = select(rows, maxBytes, perChecker);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const table = {
  built: (process.env.RADAR_BUILT || new Date().toISOString().slice(0, 10)),
  feedModified: feed.dateModified || null,
  source: { name: "Data Commons fact-check feed", url: "https://datacommons.org/factcheck/download", licence: "CC BY 4.0", licenceUrl: "https://creativecommons.org/licenses/by/4.0/", attribution: "ClaimReview markup published by each fact-checker, collected by Google Fact Check Tools and Data Commons." },
  fields: ["claim", "rating", "checker", "url", "date", "langGuess", "appearedOn"],
  checkers: picked.checkers,
  rows: picked.rows,
};
const json = JSON.stringify(table);
// In parts under 5 MB each, so the Firefox add-on linter can read them (src/core/claims-parts.js).
splitClaims(table).forEach((t, i) => writeFileSync(join(root, "src/ext", i ? `claims-${i + 1}.json` : "claims.json"), JSON.stringify(t)));
const dates = picked.rows.map((r) => r[4]).filter(Boolean).sort();
console.log(`${rows.length} usable reviews -> ${picked.rows.length} rows from ${picked.checkerCount} fact-checkers, ${Buffer.byteLength(json)} bytes, ${dates[0]} to ${dates[dates.length - 1]}`);
console.log("dropped:", JSON.stringify(dropped));
console.log(`rows naming a site where the claim appeared: ${picked.rows.filter((r) => r[6]).length} of ${picked.rows.length}`);
