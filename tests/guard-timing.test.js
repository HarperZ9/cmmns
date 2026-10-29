// The refresh scheduler in src/ext/guard.js. Seen on 2026-10-29: badges arrived late or not at all
// while a feed scrolled or a video played, because every page change pushed the pass back again,
// and a pass that only waited on storage was counted as slow and stretched the wait to 2 s.
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function load(now) {
  const timers = [];
  const ctx = {
    location: { pathname: "/home" }, console: { warn() {} },
    performance: { now: () => now.t }, Date: { now: () => now.t },
    setTimeout: (fn, ms) => { timers.push({ fn, at: now.t + ms, live: true }); return timers.length; },
    clearTimeout: (id) => { if (timers[id - 1]) timers[id - 1].live = false; },
    Math, Map, Promise,
  };
  ctx.globalThis = ctx;
  vm.runInNewContext(readFileSync(join(import.meta.dirname, "..", "src", "ext", "guard.js"), "utf8"), ctx);
  const advance = (ms) => {
    const end = now.t + ms;
    for (;;) {
      const next = timers.filter((x) => x.live && x.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!next) break;
      now.t = next.at; next.live = false; next.fn();
    }
    now.t = end;
  };
  return { G: ctx.PBGuard, advance };
}

test("a page that changes every 100 ms still gets a pass within the hold time", () => {
  const now = { t: 0 }, { G, advance } = load(now);
  const runs = [];
  const schedule = G.debounced(() => runs.push(now.t));
  for (let i = 0; i < 30; i++) { schedule(); advance(100); }   // 3 s of constant change
  assert.ok(runs.length >= 2, `expected at least two passes in 3 s, got ${runs.length}`);
  assert.ok(runs[0] <= G.HOLD_MS, `first pass at ${runs[0]} ms, after the ${G.HOLD_MS} ms hold`);
});

test("a quiet page runs once, after the normal wait", () => {
  const now = { t: 0 }, { G, advance } = load(now);
  const runs = [];
  const schedule = G.debounced(() => runs.push(now.t));
  schedule(); schedule(); schedule();
  advance(2000);
  assert.deepEqual(runs, [250]);
});

test("a request for 0 ms is not stretched by an earlier slow pass", async () => {
  const now = { t: 0 }, { G } = load(now);
  const slowPass = G.measured(async () => { now.t += 500; });
  await slowPass(); await slowPass();   // two slow passes stretch the automatic wait
  assert.ok(G.nextWait(250) > 250, "the automatic wait should have stretched");
  assert.equal(G.nextWait(0), 0);
});

test("time spent waiting before lap() does not count as a slow pass", async () => {
  const now = { t: 0 }, { G } = load(now);
  const waits = G.measured(async (lap) => { now.t += 900; lap(); now.t += 20; });
  await waits(); await waits(); await waits();
  assert.equal(G.nextWait(250), 250, "only the 20 ms after lap() should be measured");
});
