// Whole saves from a page that shows only thumbnails (Instagram's likes page in Your activity): the
// post is opened in a background tab, as a person opening it would, the page there receives the post
// from Instagram itself, full-capture.js in that tab saves it whole, and the tab closes. One post at a
// time, only on the click that asked for it, never under source protection, and only for an Instagram
// post address. Nothing is requested by this worker.
globalThis.PBCaptureOpen = globalThis.PBCaptureOpen || (() => {
  "use strict";
  const POST = /^https:\/\/www\.instagram\.com\/(p|reel|reels|tv)\/[\w-]{5,40}\/?(\?[^#]*)?$/;
  const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
  let chain = Promise.resolve();

  // Resolves when the tab has finished loading, or after ms.
  function loaded(tabId, ms) {
    return new Promise((ok) => {
      const done = () => { clearTimeout(timer); chrome.tabs.onUpdated.removeListener(on); ok(); };
      const on = (id, info) => { if (id === tabId && info.status === "complete") done(); };
      const timer = setTimeout(done, ms);
      chrome.tabs.onUpdated.addListener(on);
    });
  }
  // The content script may not be listening yet: asks again every half second until ms.
  async function ask(tabId, msg, ms) {
    const until = Date.now() + ms;
    let last = null;
    while (Date.now() < until) {
      try { const r = await chrome.tabs.sendMessage(tabId, msg); if (r) return r; } catch (e) { last = e; }
      await sleep(500);
    }
    return { error: last ? `the opened post did not answer (${last.message})` : "the opened post did not answer" };
  }

  async function openOne(msg) {
    if (!POST.test(String(msg.url || ""))) return { error: "not an Instagram post address" };
    const s = PB.normalizeSettings((await chrome.storage.local.get(PB.SETTINGS_KEY))[PB.SETTINGS_KEY]);
    if (s.protection) return { error: "source protection is on" };
    const tab = await chrome.tabs.create({ url: msg.url, active: false });
    try {
      await loaded(tab.id, 30000);
      return await ask(tab.id, { type: "pb-cap-save", shortcode: msg.shortcode, study: !!msg.study }, 60000);
    } finally { chrome.tabs.remove(tab.id).catch(() => {}); }
  }

  // One at a time, in the order asked.
  function open(msg) {
    const run = chain.then(() => openOne(msg));
    chain = run.catch(() => {});
    return run.catch((e) => { console.warn("[cmmns] could not open the post to save it", e); return { error: e.message }; });
  }

  return Object.freeze({ open, POST });
})();
