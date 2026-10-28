// Adapter health (src/core/health.js): when a platform changes its markup, CMMNS says so plainly
// instead of showing nothing, and a quiet page or a sign-in wall is not mistaken for a change.
import test from "node:test";
import assert from "node:assert/strict";
import { adapterHealth, selfTestLines, HEALTH_SETTLE_MS, HEALTH_DOES_NOT_PROVE } from "../src/core/health.js";

const X = { name: "X", hasLocation: true }, REDDIT = { name: "Reddit", hasLocation: false }, BSKY = { name: "Bluesky", rootFirst: true };
const settled = HEALTH_SETTLE_MS + 1;

test("boxes found but none readable: the site changed its page", () => {
  const v = adapterHealth(REDDIT, { page: "thread", candidates: 12, read: 0, sinceMs: 100 });
  assert.equal(v.state, "changed");
  assert.equal(v.say, "Reddit changed its page; CMMNS cannot read replies here yet.");
  assert.match(adapterHealth(X, { page: "feed", candidates: 3, read: 0 }).say, /cannot read posts here/);
});

test("a post page that should show its post but shows nothing CMMNS can find, once settled", () => {
  assert.equal(adapterHealth(X, { page: "thread", candidates: 0, read: 0, sinceMs: 1000, structure: { times: 4, articles: 4 } }).state, "waiting");
  assert.equal(adapterHealth(X, { page: "thread", candidates: 0, read: 0, sinceMs: settled, structure: { times: 2, articles: 1 } }).state, "changed");
  assert.equal(adapterHealth(BSKY, { page: "thread", candidates: 0, read: 0, sinceMs: settled, structure: { times: 1, articles: 0 } }).state, "changed");
});

test("a sign-in wall or a removed post, with no post-like boxes at all, is not called a change", () => {
  assert.equal(adapterHealth(X, { page: "thread", candidates: 0, read: 0, sinceMs: settled, structure: { times: 0, articles: 0 } }).state, "empty");
});

test("a thread with no replies on a site that shows none is empty, not changed", () => {
  const v = adapterHealth(REDDIT, { page: "thread", candidates: 0, read: 0, sinceMs: settled, structure: { times: 1, articles: 0 } });
  assert.equal(v.state, "empty");
  assert.equal(v.say, null);
});

test("many unreadable boxes, or posts with no text, are a partial change", () => {
  assert.equal(adapterHealth(REDDIT, { page: "thread", candidates: 20, read: 3, withText: 3 }).state, "partial");
  assert.equal(adapterHealth(REDDIT, { page: "thread", candidates: 5, read: 2, withText: 2 }).state, "ok", "a few deleted comments are normal");
  assert.match(adapterHealth(REDDIT, { page: "thread", candidates: 10, read: 10, withText: 0 }).say, /cannot read their text/);
});

test("a page CMMNS reads well, and pages that are not posts, say nothing", () => {
  assert.deepEqual(adapterHealth(X, { page: "thread", candidates: 10, read: 10, withText: 9 }), { state: "ok", say: null });
  assert.equal(adapterHealth(X, { page: "other" }).state, "idle");
  assert.equal(adapterHealth(null, { page: "thread" }).state, "idle");
});

test("the self-test lines name the counts and the result, and a site without a reader says so", () => {
  const r = { site: "X", page: "thread", candidates: 4, read: 0, withAuthor: 0, withText: 0, withId: 0, structure: { times: 4, articles: 4 }, verdict: adapterHealth(X, { page: "thread", candidates: 4, read: 0 }), at: "2026-10-21 12:00:00 UTC" };
  const lines = Object.fromEntries(selfTestLines(r));
  assert.equal(lines["Boxes found"], "4");
  assert.match(lines.Result, /X changed its page/);
  assert.match(selfTestLines(null)[0][1], /gets the site card/);
  assert.match(HEALTH_DOES_NOT_PROVE, /sends nothing/);
});
