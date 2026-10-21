// "Your feed": the data shaping behind the dashboard. Every share carries its count and its
// denominator; snapshots from before a field existed are left out of that field's denominator.
import test from "node:test";
import assert from "node:assert/strict";
import { addFeedPosts, threadContext, feedDashboard, FEED_RETAIN_DAYS } from "../src/core/feed.js";
import { snapshot, addSnapshot } from "../src/core/history.js";

const DAY = 86400000, NOW = Date.parse("2026-10-20T12:00:00Z");
const post = (id, over = {}) => ({ id, domains: [], strong: false, note: false, claims: 0, techniques: [], ...over });
const rep = (over = {}) => ({ replies: 10, lookedUp: 5, extreme: { n: 2, flagged: 1 }, others: { n: 3, flagged: 0 }, machine: { n: 0 }, bursts: [], origins: [], state: [], upstream: null,
  strong: { n: 3 }, techniques: { "loaded-language": 2 }, context: { posts: 11, notes: 1, claims: 2, links: [{ domain: "rt.com", n: 4 }, { domain: "news.example", n: 2 }] }, ...over });

test("feed posts are counted once per site and day, however often the feed refreshes", () => {
  let log = addFeedPosts({}, "X", [post("1", { domains: ["a.example"], strong: true }), post("2")], NOW);
  log = addFeedPosts(log, "X", [post("1", { domains: ["a.example"], strong: true }), post("3", { note: true, claims: 1 })], NOW + 1000);
  const [k] = Object.keys(log);
  assert.equal(Object.keys(log).length, 1);
  assert.equal(log[k].posts, 3);
  assert.equal(log[k].strong, 1);
  assert.equal(log[k].notes, 1);
  assert.equal(log[k].claims, 1);
  assert.deepEqual(log[k].links, { "a.example": 1 });
});

test("feed days older than the retention are dropped", () => {
  let log = addFeedPosts({}, "X", [post("1")], NOW - (FEED_RETAIN_DAYS + 2) * DAY);
  log = addFeedPosts(log, "X", [post("2")], NOW);
  assert.equal(Object.keys(log).length, 1);
});

test("thread context counts posts that link each site, notes and fact-check matches", () => {
  const items = [{ id: "a", domains: ["rt.com", "rt.com"] }, { id: "b", domains: ["rt.com", "x.example"] }, { id: "c", domains: [] }];
  const c = threadContext(items, { noteOf: (id) => (id === "a" ? "a note" : null), claimsOf: (id) => (id === "b" ? [{ url: "u" }] : null) });
  assert.equal(c.posts, 3);
  assert.equal(c.notes, 1);
  assert.equal(c.claims, 1);
  assert.deepEqual(c.links, [{ domain: "rt.com", n: 2 }, { domain: "x.example", n: 1 }]);
});

test("the dashboard pools threads and feeds inside the window, with exact counts", () => {
  let reports = addSnapshot({}, snapshot("x:1", "X", rep(), NOW - 2 * DAY), NOW);
  reports = addSnapshot(reports, snapshot("x:2", "X", rep(), NOW - 20 * DAY), NOW);
  const feed = addFeedPosts({}, "X", [post("f1", { domains: ["rt.com"], strong: true, techniques: ["loaded-language"] }), post("f2", { note: true })], NOW - DAY);
  const d7 = feedDashboard(reports, feed, {}, { days: 7, now: NOW, isState: (d) => d === "rt.com", shown: ["loaded-language"] });
  assert.equal(d7.threads, 1);
  assert.equal(d7.feedPosts, 2);
  assert.deepEqual(d7.strong, { k: 4, n: 12, share: 4 / 12, ci: d7.strong.ci });
  assert.equal(d7.state.k, 5);
  assert.equal(d7.state.n, 7);
  assert.deepEqual(d7.sites[0], { domain: "rt.com", n: 5 });
  assert.deepEqual(d7.notes, { k: 2, n: 13 });
  assert.deepEqual(d7.claims, { k: 2, n: 13 });
  assert.deepEqual(d7.flagged.k, 1);
  assert.deepEqual(d7.techniques.counts, [{ id: "loaded-language", n: 3 }]);
  const d30 = feedDashboard(reports, feed, {}, { days: 30, now: NOW, isState: () => false, shown: [] });
  assert.equal(d30.threads, 2);
  assert.equal(d30.state.k, 0);
  // No technique has passed its measurement: counts stay empty even if old data holds some.
  assert.deepEqual(d30.techniques, { shown: [], counts: [] });
});

test("snapshots saved before a field existed do not shrink that field's share", () => {
  const old = snapshot("x:old", "X", rep({ strong: undefined, techniques: undefined, context: undefined }), NOW - DAY);
  const reports = addSnapshot({}, old, NOW);
  const d = feedDashboard(reports, {}, {}, { days: 7, now: NOW });
  assert.equal(d.threads, 1);
  assert.equal(d.strong, null);
  assert.equal(d.notes, null);
  assert.equal(d.state, null);
  assert.equal(d.flagged.n, 5);
});

test("accounts seen together come from the connections log inside the window", () => {
  const t = (at, ...hs) => ({ at, authors: Object.fromEntries(hs.map((h) => [h, 1])) });
  const net = { threads: { a: t(NOW - DAY, "p", "q", "r"), b: t(NOW - DAY, "p", "q"), c: t(NOW - 2 * DAY, "p", "q", "r"), d: t(NOW - 20 * DAY, "p", "r"), e: t(NOW - 21 * DAY, "p", "r") } };
  const d7 = feedDashboard({}, {}, net, { days: 7, now: NOW });
  assert.deepEqual(d7.together.map(({ a, b, n }) => ({ a, b, n })), [{ a: "p", b: "q", n: 3 }]);
  assert.deepEqual(d7.together[0].threads.sort(), ["a", "b", "c"]);
  const d30 = feedDashboard({}, {}, net, { days: 30, now: NOW });
  assert.deepEqual(d30.together.map((e) => `${e.a}-${e.b}:${e.n}`), ["p-r:4", "p-q:3"]);
});

test("an empty store gives an empty dashboard, not errors", () => {
  const d = feedDashboard(undefined, undefined, undefined, { days: 7, now: NOW });
  assert.equal(d.threads, 0);
  assert.equal(d.feedPosts, 0);
  assert.deepEqual(d.sites, []);
  assert.deepEqual(d.daily.length, 7);
});
