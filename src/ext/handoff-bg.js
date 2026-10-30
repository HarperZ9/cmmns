// Puts back together the pieces quick-handoff.js sends and starts the download. Where the worker can
// make a blob address itself (Firefox's background page), it does. Chrome's service worker cannot
// (it has no URL.createObjectURL), so the pieces go to an offscreen page that makes the address,
// and the address is revoked once the browser has finished writing the file.
globalThis.PBHandoffBg = (() => {
  "use strict";
  const local = typeof URL.createObjectURL === "function";
  const jobs = new Map();   // id -> { parts, at }, only where the worker builds the file itself
  const STALE_MS = 10 * 60 * 1000, DONE_WAIT_MS = 30 * 60 * 1000;
  let creating = null;

  const bytesOf = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  async function offscreen() {
    if (chrome.offscreen.hasDocument && (await chrome.offscreen.hasDocument())) return;
    creating = creating || chrome.offscreen.createDocument({ url: "offscreen.html", reasons: ["BLOBS"],
      justification: "Turns a file the page made into an address the browser can download." })
      .catch((e) => { if (!/single offscreen/i.test(String(e && e.message))) throw e; })
      .finally(() => { creating = null; });
    await creating;
  }

  // Resolves when the browser has finished (or stopped) writing download `id`, or after DONE_WAIT_MS.
  function finished(id) {
    return new Promise((resolve) => {
      const done = () => { clearTimeout(timer); chrome.downloads.onChanged.removeListener(changed); resolve(); };
      const changed = (d) => { if (d && d.id === id && d.state && d.state.current !== "in_progress") done(); };
      const timer = setTimeout(done, DONE_WAIT_MS);
      chrome.downloads.onChanged.addListener(changed);
    });
  }

  // One piece in; on the last one, the file is made and handed to PBQuickBg.download.
  async function piece(msg) {
    const last = msg.i === msg.pieces - 1;
    let url;
    if (local) {
      for (const [k, j] of jobs) if (Date.now() - j.at > STALE_MS) jobs.delete(k);
      const job = jobs.get(msg.id) || { parts: [], at: Date.now() };
      job.parts[msg.i] = bytesOf(msg.data);
      jobs.set(msg.id, job);
      if (!last) return { ok: true };
      jobs.delete(msg.id);
      url = URL.createObjectURL(new Blob(job.parts, { type: msg.mime || "application/octet-stream" }));
    } else {
      await offscreen();
      const r = await chrome.runtime.sendMessage({ target: "pb-offscreen", type: "piece", id: msg.id, i: msg.i, pieces: msg.pieces, data: msg.data, mime: msg.mime });
      if (!r || r.error) throw new Error(r && r.error ? r.error : "The offscreen page did not take the file.");
      if (!last) return { ok: true };
      url = r.url;
    }
    const revoke = () => (local ? URL.revokeObjectURL(url) : chrome.runtime.sendMessage({ target: "pb-offscreen", type: "revoke", url }).catch(() => {}));
    try {
      const r = await PBQuickBg.download({ url, filename: msg.filename, site: msg.site, study: msg.study, overwrite: msg.overwrite, library: msg.library });
      finished(r.id).then(revoke);
      return r;
    } catch (e) { revoke(); throw e; }
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.type !== "pb-qs-piece" || !sender.tab) return false;
    piece(msg).then(sendResponse, (e) => { console.error("[cmmns] the file from the page could not be saved", e); sendResponse({ error: e.message }); });
    return true;
  });
  return Object.freeze({ piece });
})();
