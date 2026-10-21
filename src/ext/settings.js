// The user's settings for the content scripts and the extension pages: loaded once from
// chrome.storage.local, normalised by PB.normalizeSettings (src/core/settings.js) and kept
// current when the popup or options page changes them. Also applies the accessibility classes
// (calm: reduced motion; large: larger text) to the page root.
(() => {
  "use strict";
  const KEY = PB.SETTINGS_KEY;
  const api = (globalThis.chrome && chrome.storage && chrome.storage.local) || null;
  let current = PB.normalizeSettings(null);
  const listeners = [];
  function apply() {
    const root = document.documentElement;
    root.classList.toggle("pb-calm", current.calm);
    root.classList.toggle("pb-large", current.large);
  }
  function set(next) { current = PB.normalizeSettings(next); apply(); for (const f of listeners) f(current); }
  const ready = api ? api.get(KEY).then((g) => set(g[KEY])).catch((e) => console.error("[radar] could not read settings", e)) : Promise.resolve();
  if (api && chrome.storage.onChanged) chrome.storage.onChanged.addListener((ch, area) => { if (area === "local" && ch[KEY]) set(ch[KEY].newValue); });
  // Merge a change into the stored settings.
  async function save(patch) {
    const stored = api ? (await api.get(KEY))[KEY] : current;
    const next = PB.normalizeSettings({ ...PB.normalizeSettings(stored), ...patch });
    if (api) await api.set({ [KEY]: next });
    set(next);
    return next;
  }
  globalThis.PBSettings = Object.freeze({ get: () => current, ready, save, onChange: (f) => listeners.push(f) });
})();
