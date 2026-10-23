// The first-week tour in the page (rules in src/core/learn.js). Three tips over the first uses,
// each shown once, at most one an hour, and none after "No more tips". The state lives in
// chrome.storage.local under PB.TOUR_KEY, on this machine only. Until the state has loaded, no
// tip shows, so a slow read never shows a tip twice.
(() => {
  "use strict";
  const KEY = PB.TOUR_KEY;
  const api = globalThis.chrome && chrome.storage && chrome.storage.local;
  let state = null;

  if (api) {
    api.get(KEY).then((g) => { state = PB.normalizeTour(g[KEY]); }).catch((e) => PBGuard.report("could not read the tour state", e));
    if (chrome.storage.onChanged) chrome.storage.onChanged.addListener((ch, area) => { if (area === "local" && ch[KEY]) state = PB.normalizeTour(ch[KEY].newValue); });
  }

  function write(next) {
    state = next;
    if (api) api.set({ [KEY]: next }).catch((e) => PBGuard.report("could not save the tour state", e));
  }

  // The tip for this surface now, marked as shown, or null.
  function take(where, ctx) {
    if (!state) return null;
    const tip = PB.nextTip(state, where, Date.now(), ctx);
    if (!tip) return null;
    write(PB.markShown(state, tip.id, Date.now()));
    return tip;
  }

  function stop() { write(PB.stopTips(state || {})); }

  globalThis.PBTour = Object.freeze({ take, stop });
})();
