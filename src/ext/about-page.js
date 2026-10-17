// Acts only on an account's "About this account" page (/handle/about). Whenever the user
// visits one, the reading is cached, so ordinary browsing fills the cache with no extra
// requests. When the page was opened by a lookup (#pb-lookup), the reading is also sent back
// to the background worker, which closes the tab. X is a single-page app, so content.js calls
// PBAbout.check() again after each in-app navigation.
(() => {
  "use strict";
  let timer = 0;

  function check() {
    clearTimeout(timer);
    const m = location.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/about\/?$/);
    if (!m) return;
    const handle = m[1], forLookup = location.hash === "#pb-lookup", started = Date.now();
    const tryRead = () => {
      if (!location.pathname.toLowerCase().startsWith(`/${handle.toLowerCase()}/about`)) return;
      const main = document.querySelector("main") || document.body;
      const reading = PB.parseAbout(main ? main.innerText : "", handle);
      const found = reading.basedIn || reading.joinDate;
      if (!found && Date.now() - started < 12000) { timer = setTimeout(tryRead, 500); return; }
      if (found) PBStore.put(reading).catch((e) => console.error("[provenance-badges] cache write failed", e));
      else console.warn("[provenance-badges] no about fields found for", handle, "- the page layout may have changed");
      if (forLookup) chrome.runtime.sendMessage({ type: "pb-about-read", reading: found ? reading : null }).catch(() => {});
    };
    timer = setTimeout(tryRead, 800);
  }

  globalThis.PBAbout = Object.freeze({ check });
  check();
})();
