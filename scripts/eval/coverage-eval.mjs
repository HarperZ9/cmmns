// Other coverage with the outlets' own feeds: how many other outlets a lookup finds, and how long
// asking every suggested feed takes. The test stories are the newest headlines of each suggested
// outlet; each is matched against every other outlet's feed exactly as the extension does
// (src/core/feedfetch.js, src/core/coverage.js). One request per feed, made once. Matched pairs go
// to --out for labelling by hand; precision is not measured by this script.
//
//   node scripts/eval/coverage-eval.mjs [--per 3] [--out <dir>]
import { writeFileSync, mkdirSync } from "node:fs";
import { FEED_OUTLETS } from "../../src/core/outlets.js";
import { feedFetcher } from "../../src/core/feedfetch.js";
import { coverageFromFeeds } from "../../src/core/coverage.js";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const PER = Number(arg("--per", 3)), OUT = arg("--out", null);
const feeds = FEED_OUTLETS.map(([id, name, url, site, country]) => ({ id, name, url, site, country, custom: false }));

const t0 = Date.now();
const results = await feedFetcher({ fetch, allowed: async () => true }).fetchAll(feeds);
const askAllMs = Date.now() - t0;
const failed = results.filter((r) => r.error).map((r) => `${r.feed.id}: ${r.error}`);

const lookups = [];
for (const r of results.filter((x) => !x.error)) {
  for (const it of r.items.slice(0, PER)) {
    const { words, list } = coverageFromFeeds(it.title, results, { self: r.feed.site });
    if (words.length < 2) continue;
    lookups.push({ from: r.feed.id, title: it.title, outlets: list.length, matches: list.map((x) => ({ outlet: x.outlet, title: x.title, shared: x.shared })) });
  }
}
const counts = lookups.map((l) => l.outlets).sort((a, b) => a - b);
const share = (k) => `${lookups.filter((l) => l.outlets >= k).length} of ${lookups.length}`;
const summary = {
  date: new Date().toISOString().slice(0, 10), feeds: feeds.length, feedsAnswered: feeds.length - failed.length, failed, askAllMs,
  lookups: lookups.length, atLeast1: share(1), atLeast3: share(3), medianOutlets: counts.length ? counts[Math.floor(counts.length / 2)] : null, maxOutlets: counts.at(-1) ?? null,
  precision: "not measured; label the pairs in --out by hand",
};
console.log(JSON.stringify(summary, null, 1));
if (OUT) { mkdirSync(OUT, { recursive: true }); writeFileSync(`${OUT}/coverage-feeds.json`, JSON.stringify({ summary, lookups }, null, 1)); }
