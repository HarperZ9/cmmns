// Evidence capture, in the worker: pictures the visible part of the tab (the click on "Capture as
// evidence" grants activeTab), appends one line to the custody chain (kept in this browser, each line
// naming the hash of the one before), and saves <name>.capture.png and <name>.capture.json beside the
// saved files in <save folder>/<site>/. Nothing is sent anywhere.
globalThis.PBCaptureBg = (() => {
  "use strict";
  const LOG = "pb.custody";
  let queue = Promise.resolve();   // one capture at a time, so the chain stays in order

  const b64 = (bytes) => { let s = ""; for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode(...bytes.subarray(i, i + 32768)); return btoa(s); };
  const dataBytes = (url) => Uint8Array.from(atob(url.slice(url.indexOf(",") + 1)), (c) => c.charCodeAt(0));

  async function capture({ meta, files, page, transformed, offsetMinutes }, tab) {
    // The browser pictures the window's visible tab; a capture of any other tab would be the wrong page.
    const [shown] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
    if (!shown || shown.id !== tab.id) throw new Error("The page must be the visible tab to be pictured. Bring it to the front and capture again.");
    const shot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    const png = dataBytes(shot), stem = files[0].name.replace(/\.[a-z0-9]{1,5}$/i, "");
    const screenshot = { name: `${stem}.capture.png`, sha256: await PB.mediaSha256(png), viewport_height: page.viewport_height, page_height: page.page_height, scroll_y: page.scroll_y };
    const record = PB.captureRecord({ meta, files, screenshot, page, transformed, offsetMinutes, tool: { version: chrome.runtime.getManifest().version, browser: navigator.userAgent } });
    const recordHash = await PB.mediaSha256(new TextEncoder().encode(PB.captureCanonical(record)));
    const log = ((await chrome.storage.local.get(LOG))[LOG]) || [];
    const line = await PB.custodyLine(log[log.length - 1] || null, { what: "capture", page: page.url, hashes: [...files.map((f) => f.sha256), screenshot.sha256, recordHash], tool: `CMMNS ${record.tool.version}` });
    await chrome.storage.local.set({ [LOG]: [...log, line] });
    const site = meta.site || null;
    await PBQuickBg.download({ url: shot, filename: screenshot.name, site });
    const json = new TextEncoder().encode(JSON.stringify({ ...record, custody: line }, null, 2) + "\n");
    await PBQuickBg.download({ url: `data:application/json;base64,${b64(json)}`, filename: `${stem}.capture.json`, site });
    const kept = record.transparency.rows.filter((r) => r.kept === "full").length;
    return { seq: line.seq, kept: `${kept} of ${record.transparency.rows.length} parts kept in full; the rest are listed in the record.` };
  }

  // The whole chain, for export and for `cmmns capture verify`.
  async function log() { return ((await chrome.storage.local.get(LOG))[LOG]) || []; }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.type !== "pb-qs-capture" || !sender.tab) return false;
    const run = queue.then(() => capture(msg, sender.tab));
    queue = run.catch(() => {});
    run.then(sendResponse, (e) => { console.error("[cmmns] evidence capture failed", e); sendResponse({ error: e.message }); });
    return true;
  });

  return Object.freeze({ log });
})();
