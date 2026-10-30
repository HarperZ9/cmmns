// Failure and memory guards for the content scripts. Loaded first after core.bundle.js on every
// supported site (manifest content_scripts). A platform can change its page or its data at any
// time; when one of our readers stops matching, CMMNS must go quiet on that part and
// leave the page working. So:
// - report(): one console.warn per kind of failure per minute, prefixed "[cmmns]", and
//   a ring of the last 50 failures that the toolbar self-test reads. Never console.error, which a
//   site's own error tooling would count as its own fault.
// - run() and wrap(): try/catch around a callback, with report() on failure.
// - capMap(), capSet(): keep the newest entries of a cache within a fixed count, so a long session
//   (hours of scrolling) holds a bounded amount of memory.
// - Timeouts: every request the content scripts make carries AbortSignal.timeout (reddit.js 10 s,
//   sniff.js 15 s); the background's lookups and feeds have their own (auto.js, feedfetch.js).
// - Budget: refresh() measures itself; two slow passes in a row stretch the next wait by half (up
//   to 2 s; the first pass on a page is slow while the browser compiles the rules) and a run of
//   five failed passes pauses automatic refresh on this page until the next navigation. Only the
//   time after the pass's awaits counts, and debounced() runs a pass at least once a second on a
//   page that never stops changing.
(() => {
  "use strict";
  const PREFIX = "[cmmns]";
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


  // The refresh budget: wait = 250 ms normally, stretched after two passes in a row over 200 ms.
  // The pass is timed from its last lap: fn gets a lap() to call once its awaits are done, so time
  // spent waiting on storage or the worker (which blocks nothing) never counts as a slow pass.
  const BUDGET_MS = 200, MAX_WAIT = 2000;
  let wait = 250, slow = 0;
  function measured(fn) {
    return async (...args) => {
      if (pausedAt && pausedAt === location.pathname) return undefined;
      pausedAt = "";
      let t0 = performance.now();
      const lap = () => { t0 = performance.now(); };
      try {
        const r = await fn(...args, lap);
        failedRuns = 0;
        const ms = performance.now() - t0;
        slow = ms > BUDGET_MS ? slow + 1 : 0;
        wait = slow >= 2 ? Math.min(MAX_WAIT, Math.round(wait * 1.5)) : 250;
        return r;
      } catch (e) {
        report("refresh failed", e);
        if (++failedRuns >= 5) { pausedAt = location.pathname; report("paused on this page after five failed passes", e); }
        return undefined;
      }
    };
  }
  // A request for 0 ms (the panel opened, a reader asked again) is not stretched.
  const nextWait = (ms) => (ms === 0 ? 0 : Math.max(ms, wait));

  // A debounce that cannot starve: each call pushes the run back by the wait, but never more than
  // HOLD_MS (or the stretched wait, when slow passes stretched it past that) after the first call
  // that is still waiting. A page that changes every few hundred milliseconds (a feed while
  // scrolling, a playing video) still gets a pass that often, and a page whose passes are slow is
  // not made to run them back to back. Measured live on a YouTube watch page with the page changing
  // every 150 ms: the old debounce ran 2 passes in a minute and wired 0 of 60 comments; this one
  // ran a pass about every 1.1 s and wired all 60 (project-docs/evidence/REFRESH-STARVATION.md).
  const HOLD_MS = 1000;
  function debounced(fn) {
    let timer = 0, first = null;
    const fire = () => { timer = 0; first = null; fn(); };
    return (ms = 250) => {
      const now = Date.now(), wanted = nextWait(ms);
      if (first === null) first = now;
      const due = Math.min(now + wanted, first + Math.max(HOLD_MS, wait));
      clearTimeout(timer);
      timer = setTimeout(fire, Math.max(0, due - now));
    };
  }

  globalThis.PBGuard = { report, run, wrap, capMap, capSet, measured, nextWait, debounced, HOLD_MS,
    recent: () => ring.slice(), paused: () => !!pausedAt, BUDGET_MS };
})();
