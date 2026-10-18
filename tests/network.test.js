import test from "node:test";
import assert from "node:assert/strict";
import { recordThread, activity, returningGroups, RETAIN_DAYS } from "../src/core/network.js";

const now = Date.parse("2026-10-18T12:00:00Z");
const at = (s) => new Date(Date.parse("2026-10-17T10:00:00Z") + s * 1000).toISOString();
const root = at(0);

function build() {
  let log = {};
  log = recordThread(log, "t1", [{ author: "botA", posted: at(8) }, { author: "botB", posted: at(11) }, { author: "claire", posted: at(3600) }], root, now - 3 * 86400000);
  log = recordThread(log, "t2", [{ author: "botA", posted: at(5) }, { author: "botB", posted: at(9) }], root, now - 2 * 86400000);
  log = recordThread(log, "t3", [{ author: "BotA", posted: at(12) }, { author: "botB", posted: at(14) }, { author: "marc", posted: at(900) }], root, now - 86400000);
  return log;
}

test("activity counts threads, fast replies and frequent company", () => {
  const a = activity(build(), "botA");
  assert.equal(a.threads, 3);
  assert.equal(a.medianDelay, 8);
  assert.equal(a.fastReplies, 3);
  assert.deepEqual(a.alongside[0], { handle: "botb", n: 3 });
});

test("returning groups: accounts seen together in other threads", () => {
  const log = build();
  const g = returningGroups(log, "t3", ["BotA", "botB", "marc"]);
  assert.deepEqual(g, [{ a: "bota", b: "botb", n: 2 }]);
});

test("old threads are dropped after the retention period", () => {
  let log = recordThread({}, "old", [{ author: "x", posted: at(1) }], root, now - (RETAIN_DAYS + 1) * 86400000);
  log = recordThread(log, "new", [{ author: "y", posted: at(1) }], root, now);
  assert.deepEqual(Object.keys(log.threads), ["new"]);
});

test("active hours: needs enough posts, then finds the waking-day offset", async () => {
  const { activeHours } = await import("../src/core/network.js");
  assert.equal(activeHours([Date.now()]), null);
  // posts between 05:00 and 20:00 UTC over 5 days fit a UTC+3 day (08:00 to 23:00 local)
  const ts = [];
  for (let d = 0; d < 5; d++) for (const hr of [5, 8, 12, 16, 20]) ts.push(Date.UTC(2026, 9, 10 + d, hr, 15));
  const a = activeHours(ts);
  assert.ok(a.utcOffset >= 3 && a.utcOffset <= 4, String(a.utcOffset));
  assert.equal(a.fit, 1);
});

test("inferred flags: fast replier and active hours outside the labelled region", async () => {
  const { flagsFor } = await import("../src/core/flags.js");
  const activity = { fastReplies: 4, medianDelay: 9, activeHours: { utcOffset: 8, fit: 0.9, posts: 30, days: 6 } };
  const ids = flagsFor({ handle: "a", basedIn: "France" }, { activity }).map((f) => f.id);
  assert.ok(ids.includes("fast-replier"));
  assert.ok(ids.includes("hours-elsewhere"));
  const near = flagsFor({ handle: "a", basedIn: "France" }, { activity: { ...activity, fastReplies: 1, activeHours: { ...activity.activeHours, utcOffset: 2 } } }).map((f) => f.id);
  assert.deepEqual(near, []);
});

test("echoes: the same wording in other threads, ignoring links, mentions and case", async () => {
  const { echoes, fingerprint } = await import("../src/core/network.js");
  const text = "The election was stolen and everyone in charge knows it, wake up people";
  assert.equal(fingerprint("so true"), null);
  let log = recordThread({}, "t1", [{ author: "a1", posted: at(5), text }], root, now - 86400000);
  log = recordThread(log, "t2", [{ author: "a2", posted: at(5), text: "@someone " + text.toUpperCase() + " https://x.co/1" }], root, now);
  const e = echoes(log, "t3", text);
  assert.equal(e.threads, 2);
  assert.deepEqual(e.authors.sort(), ["a1", "a2"]);
  assert.equal(echoes(log, "t3", "A completely different reply about the weather in Lyon this week"), null);
});

test("pushed links: a domain several accounts post across threads", async () => {
  const { pushedLinks } = await import("../src/core/network.js");
  let log = {};
  for (let i = 0; i < 3; i++) log = recordThread(log, "t" + i, [{ author: "u" + i, posted: at(5), domains: ["junknews.example"] }, { author: "z", posted: at(9), domains: ["bbc.co.uk"] }], root, now - i * 1000);
  assert.deepEqual(pushedLinks(log, ["junknews.example", "bbc.co.uk"]), [{ domain: "junknews.example", threads: 3, authors: 3 }]);
});

test("copied-elsewhere flag names the other accounts", async () => {
  const { flagsFor } = await import("../src/core/flags.js");
  const f = flagsFor({ handle: "a1" }, { echo: { threads: 2, authors: ["a1", "a2"] } }).find((x) => x.id === "copied-elsewhere");
  assert.match(f.evidence, /2 other threads.*@a2/);
  assert.ok(f.doesNotProve);
});
