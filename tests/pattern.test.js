import test from "node:test";
import assert from "node:assert/strict";
import { postingPattern, byAuthor } from "../src/core/pattern.js";
import { flagsFor } from "../src/core/flags.js";

const t0 = Date.parse("2026-10-15T00:00:00Z");
const post = (i, extra = {}) => ({ id: String(i), author: "acct", posted: new Date(t0 + i * 3600000).toISOString(), client: "Buffer", lang: "en", ...extra });

test("too few posts gives no pattern", () => {
  assert.equal(postingPattern([post(1), post(2)]), null);
});

test("a scheduled account posting every hour, every day", () => {
  const ps = Array.from({ length: 96 }, (_, i) => post(i, i % 10 === 0 ? { repostOf: "x" } : {}));
  // X's created_at gives seconds: posts exactly on the hour are a scheduler, not rounded times.
  const p = postingPattern(ps, { precision: "second" });
  assert.equal(p.posts, 96);
  assert.equal(p.days, 4);
  assert.equal(p.activeUtcHours, 24);
  assert.equal(p.medianGapSec, 3600);
  assert.deepEqual(p.clients[0], { name: "Buffer", share: 1 });
  assert.equal(p.reposts, 0.1);
  const ids = flagsFor({ handle: "acct", pattern: p }).map((f) => f.id);
  assert.ok(ids.includes("automation-app"));
  assert.ok(ids.includes("no-sleep-gap"));
  assert.ok(!ids.includes("repost-only"));
});

test("a person posting from X's own app during the day raises nothing", () => {
  const ps = [];
  for (let d = 0; d < 5; d++) for (const h of [8, 9, 12, 13, 18, 20, 21]) ps.push({ id: `${d}-${h}`, author: "p", posted: new Date(t0 + d * 86400000 + h * 3600000).toISOString(), client: "Twitter for iPhone" });
  const p = postingPattern(ps);
  assert.equal(p.activeUtcHours, 7);
  assert.deepEqual(flagsFor({ handle: "p", pattern: p }).map((f) => f.id), []);
});

test("repost-only accounts", () => {
  const ps = Array.from({ length: 30 }, (_, i) => post(i, { repostOf: "x", client: "Twitter for Android" }));
  assert.ok(flagsFor({ handle: "a", pattern: postingPattern(ps) }).some((f) => f.id === "repost-only"));
});

test("posts are grouped by author", () => {
  const g = byAuthor([{ author: "A" }, { author: "a" }, { author: "b" }, {}]);
  assert.equal(g.get("a").length, 2);
  assert.equal(g.size, 2);
});

test("hour histogram and the last 14 days", () => {
  const ps = Array.from({ length: 48 }, (_, i) => post(i));
  const p = postingPattern(ps);
  assert.equal(p.hourHist.length, 24);
  assert.equal(p.hourHist.reduce((a, b) => a + b, 0), 48);
  assert.equal(p.daily.length, 14);
  assert.equal(p.daily[13].day, "2026-10-16");
  assert.equal(p.daily[13].n, 24);
  assert.equal(p.daily[12].n, 24);
  assert.equal(p.daily[11].n, 0);
});
