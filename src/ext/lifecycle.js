// Background housekeeping: the first-run page on install, the toolbar icon state per tab, and the
// retention prune (src/core/settings.js pruneStore) on start-up and whenever the settings change.
// Loaded before background.js: by importScripts in Chrome's service worker, by the manifest's
// background scripts in Firefox. Nothing here touches the network.
(() => {
  "use strict";
  const KEY = PB.SETTINGS_KEY;
  const SIZES = [16, 32, 48, 128];
  const paths = (state) => Object.fromEntries(SIZES.map((n) => [n, `icons/radar${state === "idle" ? "" : "-" + state}-${n}.png`]));
  const TITLES = { idle: "Daylight Commons", reading: "Daylight Commons: reading accounts", paused: "Daylight Commons: paused" };

  async function settings() { return PB.normalizeSettings((await chrome.storage.local.get(KEY))[KEY]); }

  async function prune() {
    try {
      const store = await chrome.storage.local.get(PB.PRUNED_KEYS);
      const changed = PB.pruneStore(store, await settings());
      if (Object.keys(changed).length) await chrome.storage.local.set(changed);
    } catch (e) { console.error("[daylight-commons] retention prune failed", e); }
  }

  function setIcon(state, tabId) {
    const opts = tabId != null ? { tabId } : {};
    chrome.action.setIcon({ ...opts, path: paths(state) }).catch((e) => console.error("[daylight-commons] could not set the icon", e));
    chrome.action.setTitle({ ...opts, title: TITLES[state] || "Daylight Commons" }).catch(() => {});
  }

  chrome.runtime.onInstalled.addListener((d) => {
    if (d.reason === "install") chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") }).catch((e) => console.error("[daylight-commons] could not open the first-run page", e));
    // 3.0 replaced the GDELT lookup with the outlets' own feeds: give back any access granted for it.
    if (d.reason === "update") chrome.permissions.remove({ origins: ["https://api.gdeltproject.org/*"] }).catch(() => {});
    prune();
  });
  if (chrome.runtime.onStartup) chrome.runtime.onStartup.addListener(prune);
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== "local" || !ch[KEY]) return;
    const s = PB.normalizeSettings(ch[KEY].newValue);
    setIcon(s.paused ? "paused" : "idle");
    prune();
  });
  chrome.runtime.onMessage.addListener((msg, sender) => {
    if (msg && msg.type === "pb-icon" && sender.tab) setIcon(msg.state, sender.tab.id);
    // A lesson or the self-check, asked for from a page. Only Daylight Commons' own pages pass PB.safePage.
    if (msg && msg.type === "pb-open-page" && sender.tab) {
      const path = PB.safePage(msg.path);
      if (path) chrome.tabs.create({ url: chrome.runtime.getURL(path), index: sender.tab.index + 1 }).catch((e) => console.error("[daylight-commons] could not open", path, e));
    }
  });
  settings().then((s) => { if (s.paused) setIcon("paused"); }).catch(() => {});
  globalThis.PBLife = Object.freeze({ prune, setIcon });
})();
