// The catalogue's age in the background worker (src/core/head.js freshness): the head state the
// options page stored after the user checked a signed head they picked, and the date of the data
// this install carries, from its own bundled data pack. Nothing is fetched from the web.
(() => {
  "use strict";
  const KEY = "pb.head.v1";
  let catalogue = null;
  const bundled = () => (catalogue ||= fetch(chrome.runtime.getURL("radar-data.pack.json")).then((r) => r.json()).then((p) => ({ version: p.manifest.version, date: p.manifest.created })));

  async function view() {
    const [g, cat] = await Promise.all([chrome.storage.local.get(KEY), bundled()]);
    return PB.freshness(g[KEY] || null, { now: Date.now(), catalogue: cat });
  }
  globalThis.PBHead = Object.freeze({ KEY, view });
})();
