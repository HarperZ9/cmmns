// Reddit account data for comment authors, read from Reddit's own public endpoint on the page's
// own site (www.reddit.com/user/<name>/about.json). One account every GAP_MS, at most MAX_PER_PAGE
// per page, a pause of PAUSE_MS after a rate limit. Readings are kept for 14 days in this browser.
(() => {
  "use strict";
  const KEY = "pb.reddit.v1", GAP_MS = 2000, PAUSE_MS = 5 * 60000, MAX_PER_PAGE = 120, KEEP_DAYS = 14, DAY = 86400000;
  let cache = {}, loaded = false, busy = false, pausedUntil = 0, perPage = 0, page = location.pathname, onChange = () => {}, saveTimer = 0;
  const queue = [], asked = new Set();
  chrome.storage.local.get(KEY).then((g) => {
    const now = Date.now();
    const keep = globalThis.PBSettings ? PBSettings.get().aboutDays : KEEP_DAYS;
    cache = Object.fromEntries(Object.entries(g[KEY] || {}).filter(([, r]) => now - r.at < keep * DAY));
    loaded = true; onChange(); pump();
  }).catch((e) => PBGuard.report("reddit cache failed", e));

  function save() { clearTimeout(saveTimer); saveTimer = setTimeout(() => chrome.storage.local.set({ [KEY]: cache }).catch((e) => PBGuard.report("could not save reddit readings", e)), 1500); }

  async function readOne(name) {
    if (globalThis.PBSettings && PBSettings.get().protection) return;   // source-protection mode: no lookups
    const res = await fetch(`/user/${encodeURIComponent(name)}/about.json`, { credentials: "include", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) });
    if (res.status === 429) { pausedUntil = Date.now() + PAUSE_MS; queue.unshift(name); return; }
    // A deleted or suspended account answers 404 or a stub; record it so it is not asked again.
    const reading = res.ok ? PB.redditAbout(await res.json()) : null;
    cache[name.toLowerCase()] = { ...(reading || { handle: name, aboutRead: true, unavailable: res.status }), at: Date.now() };
    save(); onChange();
  }

  async function pump() {
    if (busy || !loaded || !queue.length || Date.now() < pausedUntil) return;
    busy = true;
    try { await readOne(queue.shift()); } catch (e) { PBGuard.report("reddit lookup failed", e); }
    busy = false;
    setTimeout(pump, Date.now() < pausedUntil ? pausedUntil - Date.now() : GAP_MS);
  }

  // names: authors on screen. Unknown ones are queued once per page.
  function want(names, cb) {
    if (cb) onChange = cb;
    if (location.pathname !== page) { page = location.pathname; perPage = 0; }
    for (const n of names) {
      const k = n.toLowerCase();
      if (cache[k] || asked.has(k) || perPage >= MAX_PER_PAGE || /^\[deleted\]$|^AutoModerator$/i.test(n)) continue;
      asked.add(k); perPage++; queue.push(n);
    }
    pump();
  }

  const get = (name) => cache[String(name).toLowerCase()] || null;
  const left = () => queue.length;
  const paused = () => Date.now() < pausedUntil;
  const clear = () => { cache = {}; asked.clear(); return chrome.storage.local.remove(KEY); };
  globalThis.PBReddit = Object.freeze({ want, get, left, paused, clear });
})();
