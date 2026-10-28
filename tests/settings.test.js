// Settings: one normalised shape for the popup, the first-run page, the options page and the
// content scripts, plus the retention prune the background worker runs.
import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULTS, SITES, SEARCH_ENGINES, searchOn, normalizeSettings, siteOn, areaOn, iconState, pruneStore, dataKeys, RETENTION } from "../src/core/settings.js";

const DAY = 86400000, NOW = Date.parse("2026-10-21T00:00:00Z");

test("missing or junk settings fall back to the defaults", () => {
  assert.deepEqual(normalizeSettings(undefined), DEFAULTS);
  assert.deepEqual(normalizeSettings("nonsense"), DEFAULTS);
  const s = normalizeSettings({ historyDays: "abc", aboutDays: -4, feeds: "yes", sites: [1, 2] });
  assert.equal(s.historyDays, DEFAULTS.historyDays);
  assert.equal(s.aboutDays, RETENTION.aboutDays.min);
  assert.equal(s.feeds, DEFAULTS.feeds);
  assert.deepEqual(s.sites, {});
});

test("retention is clamped to what the logs can hold", () => {
  assert.equal(normalizeSettings({ historyDays: 999 }).historyDays, RETENTION.historyDays.max);
  assert.equal(normalizeSettings({ historyDays: 0 }).historyDays, RETENTION.historyDays.min);
  assert.equal(normalizeSettings({ aboutDays: 7.6 }).aboutDays, 8);
});

test("old settings keep working: feeds and auto survive normalising", () => {
  const s = normalizeSettings({ feeds: false, auto: false });
  assert.equal(s.feeds, false);
  assert.equal(s.auto, false);
  assert.equal(s.paused, false);
});

test("a site is on unless switched off or CMMNS is paused; the fixture follows X", () => {
  assert.ok(SITES.some(([id]) => id === "x"));
  const s = normalizeSettings({ sites: { reddit: false } });
  assert.equal(siteOn(s, "x"), true);
  assert.equal(siteOn(s, "reddit"), false);
  assert.equal(siteOn(s, "facebook"), true, "a site added later starts on");
  assert.equal(siteOn(normalizeSettings({ sites: { x: false } }), "fixture"), false);
  assert.equal(siteOn(normalizeSettings({ paused: true }), "x"), false);
});

test("badge areas can be hidden one by one", () => {
  const s = normalizeSettings({ areas: { language: false, junk: "x" } });
  assert.equal(areaOn(s, "language"), false);
  assert.equal(areaOn(s, "place"), true);
  assert.deepEqual(s.areas, { language: false });
});

test("toolbar icon state: paused wins, then reading, else idle", () => {
  assert.equal(iconState({ paused: true, reading: 4 }), "paused");
  assert.equal(iconState({ siteOff: true }), "paused");
  assert.equal(iconState({ reading: 3 }), "reading");
  assert.equal(iconState({}), "idle");
});

test("prune drops entries older than the user's retention, in every log", () => {
  const old = NOW - 20 * DAY, fresh = NOW - 2 * DAY;
  const store = {
    "pb.history.v1": { a: { at: old }, b: { at: fresh } },
    "pb.net.v1": { threads: { a: { at: old }, b: { at: fresh } } },
    "pb.net.v2": { threads: { a: { at: old }, b: { at: fresh } } },
    "pb.feed.v1": { "X|old": { at: old }, "X|new": { at: fresh } },
    "pb.trail.v1": { media: { m1: { seen: old }, m2: { seen: fresh } }, links: { l1: { seen: old } } },
    "pb.about.v1": { alice: { at: old }, bob: { at: fresh } },
    "pb.reddit.v1": { carol: { at: old } },
  };
  const out = pruneStore(store, normalizeSettings({ historyDays: 10, aboutDays: 10 }), NOW);
  assert.deepEqual(Object.keys(out["pb.history.v1"]), ["b"]);
  assert.deepEqual(Object.keys(out["pb.net.v1"].threads), ["b"]);
  assert.deepEqual(Object.keys(out["pb.net.v2"].threads), ["b"]);
  assert.deepEqual(Object.keys(out["pb.feed.v1"]), ["X|new"]);
  assert.deepEqual(Object.keys(out["pb.trail.v1"].media), ["m2"]);
  assert.deepEqual(out["pb.trail.v1"].links, {});
  assert.deepEqual(Object.keys(out["pb.about.v1"]), ["bob"]);
  assert.deepEqual(out["pb.reddit.v1"], {});
});

test("prune returns only the keys it changed, so nothing is rewritten needlessly", () => {
  const store = { "pb.history.v1": { b: { at: NOW } }, "pb.about.v1": { x: { at: NOW - 40 * DAY } } };
  const out = pruneStore(store, DEFAULTS, NOW);
  assert.deepEqual(Object.keys(out), ["pb.about.v1"]);
});

test("clear-all removes every CMMNS key except the settings", () => {
  const keys = dataKeys(["pb.settings", "pb.tour", "pb.learn.v1", "pb.history.v1", "pb.about.v1", "pb.tpl", "other.thing"]);
  assert.deepEqual(keys.sort(), ["pb.about.v1", "pb.history.v1", "pb.learn.v1", "pb.tpl"], "the tour's No more tips is kept; self-check answers are cleared");
});

test("search-result cards and other coverage are off until the user turns them on", () => {
  const s = normalizeSettings({});
  assert.equal(s.coverage, false);
  assert.equal(s.feedConsent, false);
  assert.deepEqual(s.outlets, {}, "no outlet is chosen until the user chooses it");
  assert.deepEqual(s.customFeeds, []);
  for (const [id] of SEARCH_ENGINES) assert.equal(searchOn(s, id), false, id);
  assert.equal(searchOn(normalizeSettings({ search: { google: true } }), "google"), true);
  assert.equal(searchOn(normalizeSettings({ search: { google: true }, paused: true }), "google"), false);
  assert.deepEqual(normalizeSettings({ search: { evil: true } }).search, {});
});

test("consent to ask the feeds does not outlive turning other coverage off", () => {
  assert.equal(normalizeSettings({ coverage: false, feedConsent: true }).feedConsent, false);
  assert.equal(normalizeSettings({ coverage: true, feedConsent: true }).feedConsent, true);
});

test("consent given to the old GDELT lookup does not carry over to the feeds", () => {
  const s = normalizeSettings({ coverage: true, coverageConsent: true });
  assert.equal(s.feedConsent, false);
  assert.equal("coverageConsent" in s, false);
});

test("only known outlets and clean https feed addresses survive normalising", () => {
  const s = normalizeSettings({ outlets: { bbc: true, evil: true, npr: "yes" }, customFeeds: ["https://example.org/feed.xml", "http://plain.example/rss", "javascript:alert(1)", "https://u:p@x.example/f", "https://example.org/feed.xml#top", 7] });
  assert.deepEqual(s.outlets, { bbc: true });
  assert.deepEqual(s.customFeeds, ["https://example.org/feed.xml"]);
  assert.equal(normalizeSettings({ customFeeds: Array.from({ length: 50 }, (_, i) => `https://f${i}.example/rss`) }).customFeeds.length, 30);
});

test("reading text in images is off until the user turns it on", () => {
  assert.equal(normalizeSettings({}).imageText, false);
  assert.equal(normalizeSettings({ imageText: "yes" }).imageText, false);
  assert.equal(normalizeSettings({ imageText: true }).imageText, true);
});
