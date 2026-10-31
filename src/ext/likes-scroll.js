// Auto-scroll for Save all likes, only in the unpacked and self-distributed builds: the store packages
// leave this file out (scripts/zip.mjs, tests/store-build.test.js), for the same reason as the library's
// auto-scroll (library-scroll.js): store policy and X's terms on automated access would put the whole
// extension at risk. It scrolls only the likes page the user opened, at a reader's pace with jitter,
// pauses while the page's own saves catch up, and stops at the end of the list, on Pause or Stop, or as
// soon as X shows an error or rate-limit state. The pace is the account's protection: X decides how
// many timeline pages one account may load, and a faster pace reaches that limit sooner.
globalThis.PBLikesScroll = globalThis.PBLikesScroll || (() => {
  "use strict";
  const LABEL = "Scroll through all likes";
  // Each pace: [wait multiplier over the library's 1.6 to 4.2 s, shortest step and its spread in windows].
  // "careful" is the default. A step of a window or more moves past one or two posts, so X is asked for
  // its next 20 likes about once every 30 to 60 s at careful (an estimate from the step sizes; X's own
  // limit is not published).
  const PACES = Object.freeze({ careful: [1.5, 1.0, 0.6], reading: [1, 1.3, 0.7], brisk: [0.7, 1.6, 0.8] });
  const PACE_NOTE = "How fast the page is scrolled. Each scroll lets X load more of your likes, and X limits how many pages one account may load in a while; scrolling faster reaches that limit sooner and can get the account rate-limited or flagged. Careful (the default) waits 2.4 to 6.3 s between steps of 1 to 1.6 screens, Reading 1.6 to 4.2 s, Brisk 1.1 to 2.9 s with longer steps. CMMNS stops on X's first error or rate-limit message. Saving the files does not touch the account: they come from X's public media hosts.";

  // One step: how far (a share of the window) and how long to wait after it, with a longer pause now
  // and then, as a reader stops on a post. Catching up past posts already done, the step is longer
  // but the wait is not shorter, so X is asked for pages no faster. rnd: 0 <= x < 1.
  function step(rnd = Math.random, n = 0, pace = "careful", catchingUp = false) {
    const [k, least, spread] = PACES[pace] || PACES.careful;
    const by = catchingUp ? least + spread : least + rnd() * spread, wait = (1600 + rnd() * 2600) * k;
    const pause = n > 0 && n % (12 + Math.floor(rnd() * 8)) === 0 ? (5000 + rnd() * 7000) * k : 0;
    return { by, wait: Math.round(wait + pause) };
  }

  // X's error and rate-limit states as the page draws them: the "Something went wrong" line with
  // Retry, or a rate-limit message. Returns the words shown, or null.
  const ERROR = /something went wrong|rate limit|try reloading|too many requests|you are over the limit/i;
  function errorShown(doc = document) {
    for (const el of doc.querySelectorAll('[data-testid="error-detail"], [data-testid="primaryColumn"] [role="alert"], [data-testid="emptyState"]')) {
      const t = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (ERROR.test(t)) return t.slice(0, 160);
    }
    const retry = [...doc.querySelectorAll('[role="button"], button')].find((b) => /^retry$/i.test((b.textContent || "").trim()));
    return retry ? ((retry.closest("div") || retry).textContent || "Retry").replace(/\s+/g, " ").trim().slice(0, 160) : null;
  }

  // Why to stop, or null. s: { stopped, error, idle }.
  function stopWhy(s) {
    if (s.stopped) return "Stop pressed";
    if (s.error) return `X showed "${s.error}", so CMMNS stopped to protect the account. Wait a while (an hour is safe), reload, and press Resume`;
    if (s.idle >= 6) return "the end of the likes (nothing new loaded after six scrolls)";
    return null;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // o: { pace(), stopped(), paused(), pending() (saves waiting), seen() (posts found so far),
  // resumeY (the checkpoint's scroll position) }. Resolves to why it stopped.
  async function run(o) {
    let idle = 0, n = 0, lastH = 0, lastSeen = -1;
    for (;;) {
      const why = stopWhy({ stopped: o.stopped(), error: errorShown(), idle });
      if (why) return why;
      // Paused, or the page's own saves are far behind: wait, scrolling nothing. Saving and scrolling
      // overlap: up to 12 posts may wait while the next page loads.
      if (o.paused() || o.pending() > 12) { await sleep(800); continue; }
      const h = document.documentElement.scrollHeight, seen = o.seen();
      idle = h === lastH && seen === lastSeen && o.pending() === 0 ? idle + 1 : 0;
      lastH = h; lastSeen = seen;
      const s = step(Math.random, n++, o.pace(), (o.resumeY || 0) > scrollY + innerHeight);
      window.scrollBy({ top: Math.round(innerHeight * s.by), behavior: "smooth" });
      await sleep(s.wait);
    }
  }

  return Object.freeze({ LABEL, PACES, PACE_NOTE, step, stopWhy, errorShown, run });
})();
