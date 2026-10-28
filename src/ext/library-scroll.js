// Auto-scroll for a library capture, only in the unpacked and self-distributed builds: the store
// packages leave this file out (scripts/zip.mjs, tests/store-build.test.js), because store policy and
// the sites' terms on automated access would endanger the whole extension. Collector mode
// (library.js) ships everywhere; this only scrolls the page the user opened, at a person's pace with
// jitter, and stops at the end of the feed, at the user's cap, or on Stop.
globalThis.PBLibraryScroll = globalThis.PBLibraryScroll || (() => {
  "use strict";
  const LABEL = "Scroll to the end";

  // One step: how far to scroll (a share of the window) and how long to wait after it. Every so
  // often a longer pause, as a reader stops on a post. rnd: a function giving 0 <= x < 1.
  function step(rnd = Math.random, n = 0) {
    const by = 0.55 + rnd() * 0.35, wait = 1600 + rnd() * 2600;
    const pause = n > 0 && n % (12 + Math.floor(rnd() * 8)) === 0 ? 5000 + rnd() * 7000 : 0;
    return { by, wait: Math.round(wait + pause) };
  }

  // Why to stop now, or null. s: { stopped, saved, cap, idle }; idle counts steps that loaded no new
  // post and left the page the same height.
  function stopWhy(s) {
    if (s.stopped) return "Stop pressed";
    if (s.cap > 0 && s.saved >= s.cap) return `the cap of ${s.cap} posts was reached`;
    if (s.idle >= 6) return "the end of the feed (nothing new loaded after six scrolls)";
    return null;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Scrolls until stopWhy says to stop. o: { cap, saved() (posts saved this session), pending()
  // (posts waiting to be saved), stopped(), progress() (posts looked at, saved or not) }. Resolves to
  // the reason it stopped.
  async function run(o) {
    let idle = 0, n = 0, lastHeight = 0, lastSaved = -1;
    for (;;) {
      const saved = o.saved(), why = stopWhy({ stopped: o.stopped(), saved, cap: o.cap, idle });
      if (why) return why;
      // The saves keep up first: no scrolling while more than a few posts wait.
      if (o.pending() > 4) { await sleep(800); continue; }
      const h = document.documentElement.scrollHeight;
      const seen = o.progress ? o.progress() : saved;
      idle = h === lastHeight && seen === lastSaved && o.pending() === 0 ? idle + 1 : 0;
      lastHeight = h; lastSaved = seen;
      const s = step(Math.random, n++);
      window.scrollBy({ top: Math.round(innerHeight * s.by), behavior: "smooth" });
      await sleep(s.wait);
    }
  }

  return Object.freeze({ LABEL, step, stopWhy, run });
})();
