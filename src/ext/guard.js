// Failure and memory guards for the content scripts. Loaded first after core.bundle.js on every
// supported site (manifest content_scripts). A platform can change its page or its data at any
// time; when one of our readers stops matching, Daylight Commons must go quiet on that part and
// leave the page working. So:
// - report(): one console.warn per kind of failure per minute, prefixed "[daylight-commons]", and
//   a ring of the last 50 failures that the toolbar self-test reads. Never console.error, which a
//   site's own error tooling would count as its own fault.
// - run() and wrap(): try/catch around a callback, with report() on failure.
// - capMap(), capSet(): keep the newest entries of a cache within a fixed count, so a long session
//   (hours of scrolling) holds a bounded amount of memory.
// - withTimeout(): a promise that gives up after a fixed time, so a stalled request cannot hold a
//   reading open.
// - Budget: refresh() measures itself; a slow pass doubles the next wait (up to 4 s) and a run of
//   five failed passes pauses automatic refresh on this page until the next navigation.
(() => {
  "use strict";
  const PREFIX = "[daylight-commons]";
  const ring = [];
  const lastWarn = new Map();
  let failedRuns = 0;
  let pausedAt = "";

  function report(what, err) {
    const msg = err && err.message ? err.message : String(err == null ? "" : err);
    ring.push({ what: String(what), msg: msg.slice(0, 300), at: Date.now() });
    if (ring.length > 50) ring.shift();
    const now = Date.now();
    if (now - (lastWarn.get(what) || 0) < 60000) return;
    lastWarn.set(what, now);
    if (lastWarn.size > 200) lastWarn.clear();
    console.warn(PREFIX, what, msg);
  }

  function run(what, fn, ...args) {
    try {
      const r = fn(...args);
      return r && typeof r.catch === "function" ? r.catch((e) => { report(what, e); }) : r;
    } catch (e) { report(what, e); return undefined; }
  }
  const wrap = (what, fn) => function (...args) { return run(what, () => fn.apply(this, args)); };

  function capMap(map, max) {
    if (map.size <= max) return map;
    let drop = map.size - max;
    for (const k of map.keys()) { if (drop-- <= 0) break; map.delete(k); }
    return map;
  }
  const capSet = capMap;

  function withTimeout(promise, ms, what = "a request") {
    let t = 0;
    const timeout = new Promise((_, reject) => { t = setTimeout(() => reject(new Error(`${what} took longer than ${ms} ms`)), ms); });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
  }

  // The refresh budget: wait = 250 ms normally, doubled after each pass slower than 200 ms.
  const BUDGET_MS = 200, MAX_WAIT = 4000;
  let wait = 250;
  function measured(fn) {
    return async (...args) => {
      if (pausedAt && pausedAt === location.pathname) return undefined;
      pausedAt = "";
      const t0 = performance.now();
      try {
        const r = await fn(...args);
        failedRuns = 0;
        const ms = performance.now() - t0;
        wait = ms > BUDGET_MS ? Math.min(MAX_WAIT, wait * 2) : 250;
        return r;
      } catch (e) {
        report("refresh failed", e);
        if (++failedRuns >= 5) { pausedAt = location.pathname; report("paused on this page after five failed passes", e); }
        return undefined;
      }
    };
  }
  const nextWait = (ms) => Math.max(ms, wait);

  globalThis.PBGuard = { report, run, wrap, capMap, capSet, withTimeout, measured, nextWait,
    recent: () => ring.slice(), paused: () => !!pausedAt, BUDGET_MS };
})();
