// Content Credentials survival count (src/core/survival.js): one entry per checked file, keyed by a
// hash of its address, counted per site on the feed page and pruned with the history setting.
import test from "node:test";
import assert from "node:assert/strict";
import { recordCheck, survival, outcomeOf, siteOf, MEDIA_KEY, MAX_MEDIA } from "../src/core/survival.js";
import { pruneStore, PRUNED_KEYS } from "../src/core/settings.js";

const ok = { found: true, checks: { sig: { ok: true }, hash: { ok: true } } };
const partial = { found: true, checks: { sig: { ok: true }, hash: { ok: null } } };
const changed = { found: true, checks: { sig: { ok: false, text: "x" } } };
const none = { found: false };
const remote = { found: false, remote: "https://example.org/m" };

test("each check's outcome; a file Daylight Commons could not read counts nowhere", () => {
  assert.equal(outcomeOf(ok), "intact");
  assert.equal(outcomeOf(partial), "partial");
  assert.equal(outcomeOf(changed), "changed");
  assert.equal(outcomeOf(none), "none");
  assert.equal(outcomeOf(remote), "remote");
  assert.equal(outcomeOf({ error: "could not read the file" }), null);
  assert.equal(siteOf("www.twitter.com"), "x.com");
  assert.equal(siteOf("www.youtube.com"), "youtube.com");
});

test("the log keeps a hash of each address, never the address, and one entry per file", () => {
  const url = "https://pbs.twimg.com/media/abc123.jpg?name=large";
  let log = recordCheck({}, { url, host: "x.com", result: ok }, 1000);
  log = recordCheck(log, { url, host: "x.com", result: ok }, 2000);
  assert.equal(Object.keys(log).length, 1);
  assert.ok(!JSON.stringify(log).includes("twimg"), "no address stored");
  assert.equal(recordCheck(log, { url: "https://a/b.jpg", host: "x.com", result: { error: "no" } }), log);
  assert.equal(MEDIA_KEY, "pb.media.v1");
});

test("per site: files checked, intact, and the intact share with its interval", () => {
  const now = Date.parse("2026-10-21T00:00:00Z");
  let log = {};
  const add = (u, host, result, at = now - 1000) => { log = recordCheck(log, { url: u, host, result }, at); };
  add("1", "x.com", ok); add("2", "x.com", none); add("3", "x.com", none); add("4", "x.com", changed);
  add("5", "www.youtube.com", partial); add("6", "www.youtube.com", remote);
  add("7", "x.com", ok, now - 40 * 86400000);
  const rows = survival(log, { days: 30, now });
  assert.deepEqual(rows.map((r) => [r.site, r.n, r.intact, r.partial, r.changed, r.remote, r.none]), [["x.com", 4, 1, 0, 1, 0, 2], ["youtube.com", 2, 0, 1, 0, 1, 0]]);
  assert.equal(rows[0].share, 0.25);
  assert.ok(rows[0].ci[0] < 0.25 && rows[0].ci[1] > 0.25);
  assert.equal(survival(log, { days: 60, now })[0].n, 5, "the older check counts in a longer window");
});

test("the log is capped and pruned with the history setting", () => {
  let log = {};
  for (let i = 0; i < MAX_MEDIA + 5; i++) log = recordCheck(log, { url: "u" + i, host: "x.com", result: none }, i);
  assert.equal(Object.keys(log).length, MAX_MEDIA);
  assert.ok(PRUNED_KEYS.includes(MEDIA_KEY));
  const now = Date.parse("2026-10-21T00:00:00Z");
  const store = { [MEDIA_KEY]: { a: { at: now - 90 * 86400000, site: "x.com", outcome: "none" }, b: { at: now, site: "x.com", outcome: "intact" } } };
  const out = pruneStore(store, { historyDays: 60 }, now);
  assert.deepEqual(Object.keys(out[MEDIA_KEY]), ["b"]);
});
