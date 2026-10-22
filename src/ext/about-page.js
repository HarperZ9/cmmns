// Reads the two public pages Daylight Commons uses for an account and caches what they show:
//   /handle        the profile header: bio, self-declared location, website, counts, join date
//   /handle/about  X's "About this account": where it is based, app store, name changes
// Ordinary browsing fills the cache with no extra requests. When the background worker opened
// the page for a scan (#pb-lookup), the reading is also sent back to it.
// X is a single-page app, so content.js calls PBAbout.check() after each in-app navigation.
(() => {
  "use strict";
  let timer = 0;
  const T = (sel) => { const e = document.querySelector(sel); return e ? e.innerText.trim() : null; };
  // "1,234 Followers", "12.5K Following" -> the count text as X shows it.
  const count = (suffix) => {
    const a = document.querySelector(`a[href$="/${suffix}"]`);
    return a ? a.innerText.replace(/\s+/g, " ").trim() : null;
  };

  function readProfile(handle) {
    const posts = [...document.querySelectorAll("h2 + div, [dir='ltr']")].map((e) => e.innerText).find((t) => /^[\d.,]+[KM]?\s+posts?$/i.test(t || ""));
    const reading = {
      handle,
      bio: T('[data-testid="UserDescription"]'),
      profileLocation: T('[data-testid="UserLocation"]'),
      website: T('[data-testid="UserUrl"]'),
      joinedText: T('[data-testid="UserJoinDate"]'),
      followers: count("verified_followers") || count("followers"),
      following: count("following"),
      posts: posts || null,
    };
    const found = reading.joinedText || reading.followers;
    if (found && !reading.joinDate && reading.joinedText) reading.joinDate = PB.parseJoined(reading.joinedText);
    return found ? reading : null;
  }

  function readAbout(handle) {
    const main = document.querySelector("main") || document.body;
    const reading = PB.parseAbout(main ? main.innerText : "", handle);
    return reading.basedIn || reading.joinDate ? { ...reading, aboutRead: true } : null;
  }

  function check() {
    clearTimeout(timer);
    // X pages only: other sites' paths look like handles too ("/watch", "/nasa/").
    if (!/(^|\.)(x|twitter)\.com$/.test(location.hostname) && !document.documentElement.dataset.pbFixture) return;
    const about = location.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/about\/?$/);
    const profile = location.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/?$/);
    const m = about || profile;
    if (!m || ["home", "explore", "notifications", "messages", "search", "settings", "i"].includes(m[1].toLowerCase())) return;
    const handle = m[1], forLookup = location.hash === "#pb-lookup", started = Date.now();
    const kind = about ? "about" : "profile";
    const tryRead = () => {
      const reading = kind === "about" ? readAbout(handle) : readProfile(handle);
      if (!reading && Date.now() - started < 10000) { timer = setTimeout(tryRead, 400); return; }
      if (reading) PBStore.put(reading).catch((e) => console.error("[daylight-commons] cache write failed", e));
      else console.warn("[daylight-commons] nothing readable on the", kind, "page for", handle, "- the layout may have changed");
      if (forLookup) chrome.runtime.sendMessage({ type: "pb-page-read", kind, reading }).catch(() => {});
    };
    timer = setTimeout(tryRead, 600);
  }

  globalThis.PBAbout = Object.freeze({ check });
  check();
})();
