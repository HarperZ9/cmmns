import test from "node:test";
import assert from "node:assert/strict";
import { snapshot, addSnapshot, summarize, HISTORY_RETAIN_DAYS } from "../src/core/history.js";

const rep = (over = {}) => ({ replies: 20, lookedUp: 10, extreme: { n: 4, flagged: 2 }, others: { n: 6, flagged: 1 }, machine: { n: 1 }, bursts: [], origins: [{ place: "France", n: 6 }], state: [], upstream: { accounts: [{ handle: "src1", n: 3 }], domains: [{ domain: "site.example", n: 2 }], uploads: 2, recycled: 1 }, ...over });

test("snapshots are kept per thread and pruned by age", () => {
  const now = Date.parse("2026-10-18T12:00:00Z");
  let log = addSnapshot({}, snapshot("x:/a/status/1", "X", rep(), now - (HISTORY_RETAIN_DAYS + 1) * 86400000), now);
  log = addSnapshot(log, snapshot("x:/b/status/2", "X", rep(), now), now);
  assert.deepEqual(Object.keys(log), ["x:/b/status/2"]);
  log = addSnapshot(log, snapshot("x:/b/status/2", "X", rep({ replies: 30 }), now), now);
  assert.equal(log["x:/b/status/2"].replies, 30);
});

test("summary pools flagged shares and finds the recurring upstream sources", () => {
  const now = Date.now();
  let log = {};
  log = addSnapshot(log, snapshot("t1", "X", rep(), now - 3000), now);
  log = addSnapshot(log, snapshot("t2", "X", rep({ upstream: { accounts: [{ handle: "src1", n: 2 }, { handle: "src2", n: 2 }], domains: [], uploads: 0, recycled: 0 } }), now - 2000), now);
  log = addSnapshot(log, snapshot("t3", "YouTube", rep({ upstream: null }), now - 1000), now);
  const net = { threads: { a: { authors: { u1: 1, u2: 2 } }, b: { authors: { u1: 3 } }, c: { authors: { u1: 4, u2: 5 } } } };
  const s = summarize(log, net, {});
  assert.equal(s.threads, 3);
  assert.deepEqual(s.sites, { X: 2, YouTube: 1 });
  assert.equal(s.looked, 30);
  assert.equal(s.flagged, 9);
  assert.ok(Math.abs(s.flaggedShare.share - 0.3) < 1e-9);
  assert.deepEqual(s.funnel.accounts, [{ handle: "src1", threads: 2 }]);
  assert.deepEqual(s.recurring, [{ handle: "u1", threads: 3 }]);
  assert.equal(s.origins[0].place, "France");
  assert.equal(s.origins[0].n, 18);
});

test("an empty history summarises to zeros, not errors", () => {
  const s = summarize({}, {}, {});
  assert.equal(s.threads, 0);
  assert.equal(s.flaggedShare, null);
  assert.deepEqual(s.funnel.accounts, []);
});
