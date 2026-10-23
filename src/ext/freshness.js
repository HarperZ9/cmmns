// The catalogue's age on the account card and in the toolbar popup: Current, Aging, Expired or Not
// checked, with the catalogue date. Asked of the background worker (src/ext/head-bg.js) once per
// page and again when a new head is stored. An expired catalogue changes the wording only; every
// finding still shows.
(() => {
  "use strict";
  const api = { view: null, ready: null };
  const load = () => (api.ready = chrome.runtime.sendMessage({ type: "pb-freshness" })
    .then((v) => (api.view = v || null))
    .catch((e) => { console.error("[daylight-commons] could not read the catalogue's age", e); return null; }));
  load();
  chrome.storage.onChanged.addListener((ch, area) => { if (area === "local" && ch["pb.head.v1"]) load(); });
  globalThis.PBFreshness = api;
})();
