// Local cache of "About this account" readings, keyed by lower-case handle. Lives in
// chrome.storage.local on this machine only. Readings older than MAX_AGE_DAYS are refreshed.
(() => {
  "use strict";
  const KEY = "pb.about.v1", MAX_AGE_DAYS = 14, DAY = 86400000;
  const api = (globalThis.chrome && chrome.storage && chrome.storage.local) || null;

  async function all() {
    if (!api) return {};
    const got = await api.get(KEY);
    return got[KEY] || {};
  }
  async function get(handle) {
    const rec = (await all())[String(handle).toLowerCase()];
    if (!rec) return null;
    return Date.now() - rec.at > MAX_AGE_DAYS * DAY ? null : rec;
  }
  // Writes are read-modify-write on one key, so they run one after another; two lookups
  // finishing together would otherwise each overwrite the other's reading.
  let chain = Promise.resolve();
  function put(reading) {
    if (!api || !reading || !reading.handle) return Promise.resolve();
    chain = chain.then(async () => {
      const map = await all();
      // Merge: the profile page and the About page each fill part of the record.
      const key = reading.handle.toLowerCase(), old = map[key] || {};
      const fresh = Object.fromEntries(Object.entries(reading).filter(([, v]) => v != null));
      map[key] = { ...old, ...fresh, at: Date.now() };
      await api.set({ [KEY]: map });
    }).catch((e) => console.error("[radar] cache write failed", e));
    return chain;
  }
  async function clear() { if (api) await api.remove(KEY); }
  globalThis.PBStore = Object.freeze({ get, put, all, clear });
})();
