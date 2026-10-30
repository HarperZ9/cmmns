// Chrome's offscreen page for downloads (handoff-bg.js). It holds the pieces of one file the page
// made, turns them into a blob address the browser can download, and revokes the address when the
// worker says the file is written. It answers only the worker, never a page.
(() => {
  "use strict";
  const jobs = new Map();   // id -> parts

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.target !== "pb-offscreen" || sender.tab || sender.id !== chrome.runtime.id) return false;
    if (msg.type === "revoke") { URL.revokeObjectURL(msg.url); return false; }
    if (msg.type !== "piece") return false;
    try {
      const parts = jobs.get(msg.id) || [];
      parts[msg.i] = Uint8Array.from(atob(msg.data), (c) => c.charCodeAt(0));
      if (msg.i < msg.pieces - 1) { jobs.set(msg.id, parts); sendResponse({ ok: true }); return false; }
      jobs.delete(msg.id);
      sendResponse({ url: URL.createObjectURL(new Blob(parts, { type: msg.mime || "application/octet-stream" })) });
    } catch (e) {
      console.error("[cmmns] offscreen: could not build the file", e);
      jobs.delete(msg.id);
      sendResponse({ error: String(e && e.message) });
    }
    return false;
  });
})();
