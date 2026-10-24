// "Save to Daylight" in the right-click menu on any image, GIF, video or audio, and the popup's
// "Save media from this page". Either click lets Daylight Commons read the current tab once
// (activeTab): media-scan.js lists what the page loaded, and the save page opens with that list.
// Nothing is fetched here; the save page fetches only after the user picks a collection and clicks.
(() => {
  "use strict";
  const MENU = "pb-save-media";
  const jobs = {};   // fallback where storage.session is missing

  function menus() {
    if (!chrome.contextMenus) return;
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({ id: MENU, title: "Save to Daylight", contexts: ["image", "video", "audio"] }, () => void chrome.runtime.lastError);
    });
  }
  chrome.runtime.onInstalled.addListener(menus);
  if (chrome.runtime.onStartup) chrome.runtime.onStartup.addListener(menus);

  async function scanTab(tab, target, frameId) {
    const run = async (frameIds) => {
      const where = { tabId: tab.id, ...(frameIds ? { frameIds } : {}) };
      await chrome.scripting.executeScript({ target: where, files: ["media-scan.js"] });
      const [r] = await chrome.scripting.executeScript({ target: where, func: (t) => globalThis.PBMediaScan.scan(t), args: [target || null] });
      return r && r.result;
    };
    try { return await run(frameId ? [frameId] : null); } catch (e) {
      if (frameId) { try { return await run(null); } catch { /* fall through to the address only */ } }
      console.warn("[daylight-commons] could not read the page's media", e);
      return { page: tab.url || null, title: tab.title || null, items: [], streams: [], error: "Daylight Commons could not read this page. Browser pages and the extension stores cannot be read." };
    }
  }

  // Keeps the scan for the save page and opens it. Returns the job id.
  async function open(tab, target, mediaType, frameId) {
    const scan = await scanTab(tab, target, frameId);
    if (target && !/^blob:/.test(target) && !scan.items.some((i) => i.url === target)) scan.items.unshift({ kind: mediaType || null, url: target, protected: null, streams: [] });
    const id = String(Date.now()), job = { ...scan, target: target || null, mediaType: mediaType || null };
    if (chrome.storage.session) await chrome.storage.session.set({ ["pb.save." + id]: job }); else jobs[id] = job;
    await chrome.tabs.create({ url: chrome.runtime.getURL("save.html#" + id), index: tab.index + 1 });
    return id;
  }

  if (chrome.contextMenus) chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== MENU || !tab) return;
    open(tab, info.srcUrl, info.mediaType, info.frameId).catch((e) => console.error("[daylight-commons] save to Daylight failed", e));
  });

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === "pb-media-scan" && msg.tab) { open(msg.tab, null, null, 0).then((id) => sendResponse({ id }), (e) => sendResponse({ error: String(e) })); return true; }
    if (msg && msg.type === "pb-save-get") {
      const key = "pb.save." + msg.id;
      (chrome.storage.session ? chrome.storage.session.get(key).then((g) => g[key]) : Promise.resolve(jobs[msg.id])).then((j) => sendResponse(j || null));
      return true;
    }
    return false;
  });
})();
