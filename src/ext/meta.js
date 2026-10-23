// Account readings for Facebook, Instagram, Bluesky and Mastodon, kept per site in this browser for
// 14 days, and post times for Bluesky, Mastodon and TikTok, in memory only. They come only from what
// the site already shows or loaded for the viewer:
// - Instagram: the "About this account" dialog, read when the viewer opens it.
// - Facebook: the "Page transparency" section of a Page, read when the viewer opens it.
// - Bluesky: the app's own thread, profile and feed responses (src/ext/bskysniff.js).
// - Mastodon and TikTok: the web app's own status, thread and comment responses (src/ext/fedisniff.js).
// Daylight Commons makes no request of its own on these sites.
(() => {
  "use strict";
  const KEY = "pb.meta.v1", KEEP_DAYS = 14, DAY = 86400000;
  const host = location.hostname, fixture = document.documentElement.dataset.pbFixture;
  const IG = /(^|\.)instagram\.com$/.test(host) || fixture === "instagram", FB = /(^|\.)facebook\.com$/.test(host) || fixture === "facebook";
  let cache = {}, saveTimer = 0, onChange = () => {};
  const posts = new Map();   // Bluesky post id -> { posted, langs }
  const api = globalThis.chrome && chrome.storage && chrome.storage.local;
  if (api) api.get(KEY).then((g) => {
    const now = Date.now();
    cache = { ...Object.fromEntries(Object.entries(g[KEY] || {}).filter(([, r]) => now - r.at < KEEP_DAYS * DAY)), ...cache };
    onChange();
  }).catch((e) => PBGuard.report("meta cache failed", e));

  const k = (site, handle) => site + ":" + String(handle || "").toLowerCase();
  function save() { clearTimeout(saveTimer); saveTimer = setTimeout(() => api && api.set({ [KEY]: cache }).catch((e) => PBGuard.report("could not save account readings", e)), 1500); }
  function put(site, reading) {
    if (!reading || !reading.handle) return;
    const key = k(site, reading.handle);
    cache[key] = { ...(cache[key] || {}), ...reading, at: Date.now() };
    save(); onChange();
  }
  const get = (site, handle) => cache[k(site, handle)] || null;
  const clear = () => { cache = {}; posts.clear(); return api ? api.remove(KEY) : Promise.resolve(); };

  // Instagram and Facebook: read the open dialog or section once per distinct text.
  let lastText = "";
  function readOpen() {
    if (IG) {
      const d = [...document.querySelectorAll('[role="dialog"]')].find((x) => /^\s*About this account/.test(x.innerText || ""));
      if (!d || d.innerText === lastText) return;
      lastText = d.innerText;
      const path = location.pathname.match(/^\/([A-Za-z0-9._]{1,30})\/?$/);
      const r = PB.igAbout(d.innerText, path ? path[1] : null);
      if (r) put("instagram", r); else console.warn("[daylight-commons] nothing readable in Instagram's About this account; the layout may have changed");
    }
    if (FB) {
      // The main column is read only on a Page's transparency view; dialogs anywhere.
      const where = /transparen/i.test(location.pathname + location.search + location.hash) ? '[role="dialog"], [role="main"]' : '[role="dialog"]';
      const box = [...document.querySelectorAll(where)].find((x) => /\bPage transparency\b/.test(x.innerText || ""));
      if (!box || box.innerText === lastText) return;
      lastText = box.innerText;
      const key = PB.fbKey(location.origin + location.pathname.split("/").slice(0, 2).join("/") + location.search);
      const r = key && PB.pageTransparency(box.innerText, key);
      if (r) put("facebook", r);
    }
  }
  let readTimer = 0;
  if (IG || FB) {
    new MutationObserver(() => { clearTimeout(readTimer); readTimer = setTimeout(readOpen, 700); }).observe(document.documentElement, { childList: true, subtree: true });
  }

  // Bluesky: data the app downloaded, posted by bskysniff.js.
  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data || e.data.source !== "radar-bsky") return;
    for (const [, r] of PB.bskyAuthors(e.data.json)) put("bluesky", r);
    for (const [id, p] of PB.bskyPosts(e.data.json)) posts.set(id, p);
    if (posts.size > 5000) posts.clear();
  });

  // Mastodon and TikTok: data the app downloaded, posted by fedisniff.js. Mastodon accounts are
  // keyed per server, since "user" alone means a local account of the server being viewed.
  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data) return;
    if (e.data.source === "radar-masto") {
      for (const [, r] of PB.mastoAccounts(e.data.json)) put("mastodon@" + host, r);
      for (const [id, p] of PB.mastoStatuses(e.data.json)) posts.set(id, p);
    } else if (e.data.source === "radar-tiktok") {
      for (const [id, p] of PB.tiktokComments(e.data.json)) posts.set(id, p);
    } else return;
    if (posts.size > 5000) posts.clear();
    onChange();
  });

  globalThis.PBMeta = Object.freeze({ get, put, clear, post: (id) => posts.get(id) || null, findPost: (pred) => [...posts.values()].find(pred) || null,
    onChange: (cb) => { onChange = cb; } });
})();
