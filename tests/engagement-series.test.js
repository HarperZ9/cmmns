// Engagement over time (project-docs/ENGAGEMENT-SERIES.md): the seven acceptance tests from the
// 2026-10-29 plan, written before the code. Part 1 re-reads tracked saved posts from the page's
// own data, Part 2 lists the readings that are due, Part 3 logs every post the page loaded, and
// the export writes JSONL with a manifest and its sha256. None of it makes a request.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as ES from "../src/core/engagement-series.js";
import { tweetsIn } from "../src/core/xdata.js";
import { liveTweet } from "./fixtures/x-live-shapes.js";
import { memoryBackend } from "./fixtures/track-memory.js";
import { DEFAULTS } from "../src/core/settings.js";
const PBDefaults = () => DEFAULTS;

const HOUR = 3600000, DAY = 24 * HOUR;
const POSTED = Date.parse("2026-10-22T17:20:00Z");
const TRACKED_ID = "1850000000000000001", OTHER_ID = "1850000000000000002";
// A TweetDetail response in the shape X's web app used on 2026-10-22: two posts in one timeline.
const detail = { data: { threaded_conversation_with_injections_v2: { instructions: [{ type: "TimelineAddEntries", entries: [TRACKED_ID, OTHER_ID].map((id, i) => ({
  entryId: "tweet-" + id, content: { itemContent: { itemType: "TimelineTweet", tweet_results: { result: liveTweet(id, i ? "someone_else" : "example_author") } } } })) }] } } };
const savedMeta = (id = TRACKED_ID, handle = "example_author") => ({ site: "x", postUrl: `https://x.com/${handle}/status/${id}`, author: { handle }, postedAt: "2026-10-22T17:20:00.000Z", savedAt: "2026-10-22T18:00:00.000Z" });
const ON = { trackSeries: true, trackRemind: true, seenLog: false, seenDays: 90 };

function loadStore(backend = memoryBackend()) {
  const ctx = vm.createContext({ console, PB: ES, crypto: globalThis.crypto, TextEncoder });
  vm.runInContext(readFileSync(new URL("../src/ext/track-store.js", import.meta.url), "utf8"), ctx);
  return ctx.PBTrackStoreMake(backend, ES);
}

test("1. a tracked post in X's page data gives one reading with its counts and age; an untracked one gives none", () => {
  const entry = ES.trackEntry(savedMeta());
  const sightings = ES.sightingsFromTweets(tweetsIn(detail));
  assert.equal(sightings.length, 2);
  const now = POSTED + 30 * HOUR;
  const plan = ES.planSightings({ sightings, tracked: { [entry.key]: entry }, settings: ON, now });
  assert.equal(plan.readings.length, 1);
  const r = plan.readings[0];
  assert.equal(r.postId, TRACKED_ID);
  assert.deepEqual({ likes: r.likes, reposts: r.reposts, quotes: r.quotes, replies: r.replies, bookmarks: r.bookmarks, views: r.views },
    { likes: 120, reposts: 72, quotes: 0, replies: 11, bookmarks: 35, views: 27000 });
  assert.equal(r.ageHours, 30);
  assert.equal(r.at, new Date(now).toISOString());
  assert.equal(plan.seen.length, 0, "Part 3 off: the untracked post is not logged");
});

test("2. two sightings within 6 hours give one reading; 7 hours apart give two", async () => {
  const store = loadStore();
  await store.addTracked(savedMeta(), ON, POSTED + HOUR);
  const s = ES.sightingsFromTweets(tweetsIn(detail)).find((x) => x.postId === TRACKED_ID);
  const t0 = POSTED + 2 * DAY;
  await store.sightings([s], ON, t0);
  await store.sightings([s], ON, t0 + 5 * HOUR);
  assert.equal((await store.readings()).length, 1, "within 6 hours: one reading");
  await store.sightings([s], ON, t0 + 12 * HOUR);
  assert.equal((await store.readings()).length, 2, "the next sighting 7 hours after the last reading counts");
  assert.equal(ES.shouldRecord(t0, t0 + 6 * HOUR - 1), false);
  assert.equal(ES.shouldRecord(t0, t0 + 7 * HOUR), true);
});

test("3. the due list gives the right posts for each target age, and a missed age is recorded as missed", async () => {
  assert.deepEqual(ES.SERIES_TARGET_DAYS, [1, 3, 7, 14, 30, 90]);
  const entry = { ...ES.trackEntry(savedMeta()), savedAt: new Date(POSTED + HOUR).toISOString() };
  for (const day of ES.SERIES_TARGET_DAYS) {
    const now = POSTED + day * DAY + HOUR;
    const done = ES.SERIES_TARGET_DAYS.filter((d) => d < day).map((d) => ({ key: entry.key, at: new Date(POSTED + d * DAY + 2 * HOUR).toISOString() }));
    const out = ES.dueReadings([entry], { [entry.key]: done }, now);
    assert.deepEqual(out.due.map((d) => [d.key, d.day]), [[entry.key, day]], `day ${day}`);
    assert.equal(out.due[0].url, `https://x.com/example_author/status/${TRACKED_ID}`);
    assert.deepEqual(out.missed, []);
  }
  // Day 1 passed with no reading; on day 3 it is missed, never filled in.
  const late = ES.dueReadings([entry], {}, POSTED + 3 * DAY + HOUR);
  assert.deepEqual(late.missed.map((m) => m.day), [1]);
  assert.deepEqual(late.due.map((d) => d.day), [3]);
  // A post saved after its first ages passed: those ages were before tracking, not missed.
  const saved5 = { ...entry, savedAt: new Date(POSTED + 5 * DAY).toISOString() };
  const s5 = ES.seriesSchedule(saved5, [], POSTED + 5 * DAY + HOUR);
  assert.deepEqual(s5.filter((x) => x.status === "before-tracking").map((x) => x.day), [1, 3]);
  // The store writes the miss into the post's record.
  const store = loadStore();
  await store.addTracked({ ...savedMeta(), savedAt: new Date(POSTED + HOUR).toISOString() }, ON, POSTED + HOUR);
  const due = await store.refresh(POSTED + 3 * DAY + HOUR);
  assert.equal(due.count, 1);
  assert.deepEqual((await store.tracked())[0].missed, [1]);
});

test("4. no module added by this feature calls fetch, XMLHttpRequest or sendBeacon", () => {
  for (const f of ["src/core/engagement-series.js", "src/ext/track-store.js", "src/ext/track.js", "src/ext/track-bg.js", "src/ext/options-series.js", "src/ext/collections-series.js"]) {
    const src = readFileSync(new URL("../" + f, import.meta.url), "utf8").replace(/\/\/[^\n]*/g, "");
    assert.ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|\.open\s*\(\s*["'](GET|POST)/.test(src), `${f} makes no request`);
  }
});

test("5. turning a switch off stops new readings, and delete removes everything in that store", async () => {
  const store = loadStore();
  const sightings = ES.sightingsFromTweets(tweetsIn(detail));
  const t0 = POSTED + DAY;
  assert.equal(await store.addTracked(savedMeta(), { ...ON, trackSeries: false }, t0), null, "Part 1 off: a save is not tracked");
  await store.addTracked(savedMeta(), ON, t0);
  await store.sightings(sightings, { ...ON, trackSeries: false }, t0);
  assert.equal((await store.readings()).length, 0, "Part 1 off: no reading");
  await store.sightings(sightings, { ...ON, seenLog: true }, t0);
  assert.equal((await store.readings()).length, 1);
  assert.equal((await store.seen()).length, 2, "Part 3 on: both posts the page loaded are logged");
  await store.sightings(sightings, { ...ON, seenLog: false }, t0 + DAY);
  assert.equal((await store.seen()).length, 2, "Part 3 off: nothing new is logged");
  await store.clearSeen();
  assert.equal((await store.seen()).length, 0);
  assert.equal((await store.counts()).seen, 0);
  assert.ok((await store.readings()).length > 0, "deleting the seen log leaves the series");
  await store.clearSeries();
  assert.deepEqual({ ...(await store.counts()) }, { posts: 0, readings: 0, seen: 0 });
});

test("6. the export round-trips, and the manifest hash matches the file", async () => {
  const store = loadStore();
  await store.addTracked(savedMeta(), ON, POSTED + HOUR);
  const s = ES.sightingsFromTweets(tweetsIn(detail)).find((x) => x.postId === TRACKED_ID);
  for (const h of [30, 40, 80]) await store.sightings([s], ON, POSTED + h * HOUR);
  const stored = await store.readings();
  assert.equal(stored.length, 3);
  const out = await store.exportSeries(POSTED + 4 * DAY, "test");
  assert.deepEqual(ES.parseSeriesJsonl(out.jsonl), stored);
  assert.equal(out.manifest.readings, 3);
  assert.equal(out.manifest.posts, 1);
  assert.equal(out.manifest.format, ES.SERIES_FORMAT);
  assert.equal(out.manifest.files[0].sha256, await ES.sha256Hex(out.jsonl));
  assert.match(out.manifest.files[0].sha256, /^[0-9a-f]{64}$/);
});

test("7. the storage cap holds: at 20,000 tracked posts, the oldest beyond retention go first", () => {
  assert.equal(ES.SERIES_MAX_TRACKED, 20000);
  const now = Date.parse("2027-06-01T00:00:00Z");
  const mk = (i, postedDaysAgo) => ({ key: "x:" + i, platform: "x", postId: String(i), postedAt: new Date(now - postedDaysAgo * DAY).toISOString(), savedAt: new Date(now - postedDaysAgo * DAY + i).toISOString(), missed: [] });
  // 100 posts whose schedule has finished (posted 200 days ago), the rest still in their schedule.
  const entries = [...Array.from({ length: 100 }, (_, i) => mk(i, 200)), ...Array.from({ length: 19905 }, (_, i) => mk(100 + i, 10 + (i % 50)))];
  assert.equal(entries.length, 20005);
  const { keep, drop } = ES.pruneTracked(entries, now);
  assert.equal(keep.length, 20000);
  assert.deepEqual(drop, ["x:0", "x:1", "x:2", "x:3", "x:4"], "the oldest finished posts are dropped first");
  // Under the cap, posts past their schedule are kept: their readings are the data.
  assert.equal(ES.pruneTracked(entries.slice(0, 500), now).drop.length, 0);
});

test("wiring: the page script, the worker, the alarm permission, and the save hooks", () => {
  const m = JSON.parse(readFileSync(new URL("../src/ext/manifest.json", import.meta.url), "utf8"));
  assert.ok(m.permissions.includes("alarms"));
  const page = m.content_scripts.find((c) => c.js.includes("content.js")).js;
  assert.ok(page.includes("track.js") && page.indexOf("track.js") < page.indexOf("content.js"));
  const bg = m.background.scripts;
  assert.ok(bg.indexOf("track-store.js") < bg.indexOf("track-bg.js") && bg.indexOf("track-bg.js") < bg.indexOf("background.js"));
  assert.match(readFileSync(new URL("../src/ext/background.js", import.meta.url), "utf8"), /"track-store\.js", "track-bg\.js"/);
  for (const f of ["quick-save.js", "quick-text.js"]) assert.match(readFileSync(new URL("../src/ext/" + f, import.meta.url), "utf8"), /PBTrack\.saved\(meta\)/, f);
  // The seen log is off by default; the reminder too.
  assert.equal(PBDefaults().seenLog, false);
  assert.equal(PBDefaults().trackRemind, false);
  assert.equal(PBDefaults().seenDays, ES.SEEN_DAYS_DEFAULT);
});

test("YouTube and Reddit sightings: a real video id and a t3_ post id, with the counts the data gives", () => {
  const yt = ES.sightingFromYt({ videoDetails: { videoId: "jNQXAC9IVRw", viewCount: "447055433", channelId: "UC4QobU6STFB0P71PMvOGN5A" }, microformat: { playerMicroformatRenderer: { publishDate: "2005-04-23T20:31:52-07:00" } } });
  assert.deepEqual([yt.postId, yt.counts.views, yt.postedAt], ["jNQXAC9IVRw", 447055433, "2005-04-24T03:31:52.000Z"]);
  assert.equal(ES.sightingFromYt({ videoDetails: { videoId: "ux", viewCount: "49" } }), null, "seen live on 2026-10-29: a player response with a short id that is no video");
  const rd = ES.sightingFromReddit({ id: "t3_abc123", author: "someone", score: "1520", "comment-count": "88", "created-timestamp": "2026-10-20T21:04:00.000000+0000" });
  assert.deepEqual([rd.postId, rd.counts, rd.postedAt], ["abc123", { score: 1520, comments: 88 }, "2026-10-20T21:04:00.000Z"]);
  assert.equal(ES.sightingFromReddit({ id: "t1_abc" }), null);
  assert.equal(ES.trackEntry({ site: "reddit", postUrl: "https://www.reddit.com/r/a/comments/abc123/title/def456/" }), null, "a saved comment is not tracked as its post");
  assert.equal(ES.trackEntry({ site: "reddit", postUrl: "https://www.reddit.com/r/a/comments/abc123/title/" }).key, "reddit:abc123");
});

test("source protection: no seen-log writes, even with the switch on, and the switch is forced off", async () => {
  const { normalizeSettings, PROTECTION_FORCES } = await import("../src/core/settings.js");
  assert.equal(PROTECTION_FORCES.seenLog, false);
  assert.equal(normalizeSettings({ seenLog: true, protection: true }).seenLog, false);
  assert.equal(normalizeSettings({ seenLog: true }).seenLog, true);
  const sightings = ES.sightingsFromTweets(tweetsIn(detail)), now = POSTED + DAY;
  // The raw switch on with protection on (a settings object that skipped normalising): still nothing.
  const raw = { ...ON, seenLog: true, protection: true };
  assert.equal(ES.planSightings({ sightings, settings: raw, now }).seen.length, 0);
  const store = loadStore();
  await store.addTracked(savedMeta(), ON, now);
  const r = await store.sightings(sightings, raw, now);
  assert.equal(r.seen, 0);
  assert.equal((await store.seen()).length, 0, "no seen-log entry is written");
  assert.equal(r.readings, 1, "the readings of saved posts go on: protection holds off the log, not the series");
  // The options page locks the switch and the protection page offers the delete.
  assert.match(readFileSync(new URL("../src/ext/options-series.js", import.meta.url), "utf8"), /Locked off while source protection is on/);
  assert.match(readFileSync(new URL("../src/ext/protection.html", import.meta.url), "utf8"), /No seen-post log/);
});
