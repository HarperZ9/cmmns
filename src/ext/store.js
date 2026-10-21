// Local cache of "About this account" readings, keyed by lower-case handle. Lives in
// chrome.storage.local on this machine only. Readings older than the user's About cache setting
// (options page; MAX_AGE_DAYS by default) are refreshed, and the background worker deletes them.
(() => {
  "use strict";
  const KEY = "pb.about.v1", MAX_AGE_DAYS = 14, DAY = 86400000;
  const api = (globalThis.chrome && chrome.storage && chrome.storage.local) || null;

  // An in-memory mirror, loaded once and kept current, so a refresh never waits on storage.
  let mirror = null;
  async function all() {
    if (!api) return {};
    if (!mirror) mirror = (await api.get(KEY))[KEY] || {};
    return mirror;
  }
  if (api && chrome.storage.onChanged) chrome.storage.onChanged.addListener((ch, area) => { if (area === "local" && ch[KEY]) mirror = ch[KEY].newValue || {}; });
  async function get(handle) {
    const rec = (await all())[String(handle).toLowerCase()];
    if (!rec) return null;
    const days = globalThis.PBSettings ? PBSettings.get().aboutDays : MAX_AGE_DAYS;
    return Date.now() - rec.at > days * DAY ? null : rec;
  }
  // Writes are read-modify-write on one key, so they run one after another; two lookups
  // finishing together would otherwise each overwrite the other's reading.
  let chain = Promise.resolve();
  function put(reading) {
    if (!api || !reading || !reading.handle) return Promise.resolve();
    chain = chain.then(async () => {
      const map = { ...(await all()) };
      // Merge: the profile page and the About page each fill part of the record.
      const key = reading.handle.toLowerCase(), old = map[key] || {};
      const fresh = Object.fromEntries(Object.entries(reading).filter(([, v]) => v != null));
      map[key] = { ...old, ...fresh, at: Date.now() };
      mirror = map;
      await api.set({ [KEY]: map });
    }).catch((e) => console.error("[radar] cache write failed", e));
    return chain;
  }
  async function clear() { mirror = {}; if (api) await api.remove(KEY); }
  globalThis.PBStore = Object.freeze({ get, put, all, clear });
})();
