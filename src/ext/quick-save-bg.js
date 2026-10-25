// The right-click entries Download, Download as GIF, Copy and Copy link, and the browser download
// each one asks for. A click lets Daylight Commons read the clicked tab once (activeTab): the
// in-page scripts (quick-*.js) find the media under the pointer and make the file; this worker
// hands addresses to chrome.downloads, which saves to the Downloads folder without a dialog unless
// "Always ask where to save" is on. Protected media references are kept in the collections store.
globalThis.PBQuickBg = (() => {
  "use strict";
  const PAGE = ["quick-toast.js", "quick-resolve.js", "quick-sites.js", "quick-stream.js", "quick-gif.js", "quick-save.js", "quick-copy.js"];
  const ITEMS = [
    ["pb-dl", "Download", ["image", "video", "audio"]],
    ["pb-dl-here", "Download media here", ["page", "link", "frame"]],
    ["pb-dl-gif", "Download as GIF", ["image", "video"]],
    ["pb-copy", "Copy", ["image", "video", "page", "link", "frame"]],
    ["pb-copy-link", "Copy link", ["image", "video", "audio", "page", "link", "frame"]],
  ];
  const pending = new Map();   // download id or address -> { fixExt, filename }

  function create() {
    for (const [id, title, contexts] of ITEMS) chrome.contextMenus.create({ id, title, contexts }, () => void chrome.runtime.lastError);
  }

  async function inject(tabId, frameId) {
    const target = { tabId, ...(frameId ? { frameIds: [frameId] } : {}) };
    const [has] = await chrome.scripting.executeScript({ target, func: () => [!!globalThis.PB, !!globalThis.PBQuickSave] });
    const [pb, quick] = (has && has.result) || [false, false];
    if (!pb) await chrome.scripting.executeScript({ target, files: ["core.bundle.js"] });
    if (!quick) await chrome.scripting.executeScript({ target, files: PAGE });
    return target;
  }

  async function onClick(info, tab) {
    const id = info.menuItemId;
    if (!tab || !ITEMS.some(([x]) => x === id)) return;
    try {
      const target = await inject(tab.id, info.frameId);
      const args = { srcUrl: info.srcUrl || null, linkUrl: info.linkUrl || null, asGif: id === "pb-dl-gif", copy: id === "pb-copy", link: id === "pb-copy-link" };
      await chrome.scripting.executeScript({ target, args: [args], func: (a) => {
        if (a.copy || a.link) return PBQuickCopy.copy(PBQuickResolve.resolve(a), { link: a.link }).then(() => true);
        PBQuickSave.fromMenu(a);
        return true;
      } });
    } catch (e) {
      console.warn("[daylight-commons] could not read the page for the download", e);
      // Browser pages and extension stores cannot be read; a picture's own address still downloads.
      if (id === "pb-dl" && info.srcUrl && /^https?:/.test(info.srcUrl)) download({ url: info.srcUrl, filename: null, fixExt: true }).catch(() => {});
    }
  }

  async function settings() {
    const k = PB.SETTINGS_KEY;
    try { return PB.normalizeSettings((await chrome.storage.local.get(k))[k]); } catch { return PB.normalizeSettings(null); }
  }

  // Starts a browser download. { url, filename, fixExt } -> { id }.
  async function download({ url, filename, fixExt }) {
    if (!chrome.downloads) throw new Error("This browser did not give Daylight Commons the downloads permission.");
    const s = await settings();
    const opts = { url, saveAs: !!s.mediaAskWhere, conflictAction: "uniquify", ...(filename ? { filename: filename.replace(/[\\/]/g, "-") } : {}) };
    pending.set(url, { fixExt: !!fixExt, filename });
    const id = await chrome.downloads.download(opts);
    if (id === undefined) throw new Error((chrome.runtime.lastError && chrome.runtime.lastError.message) || "The browser refused the download.");
    pending.set(id, pending.get(url));
    pending.delete(url);
    setTimeout(() => pending.delete(id), 600000);
    return { id };
  }

  // Chrome only. While any extension listens here, Chrome drops the name passed to download(), so
  // every download this file started gets its name again here; when the type was guessed from the
  // address, the server's real type decides the extension. Firefox keeps the name it was given.
  function onFilename(item, suggest) {
    const p = pending.get(item.id) || pending.get(item.url) || pending.get(item.finalUrl);
    if (!p || !p.filename) return;
    const ext = p.fixExt ? PB.downloadExt(item.mime) : null;
    suggest({ filename: ext ? p.filename.replace(/\.[a-z0-9]{1,5}$/i, "") + "." + ext : p.filename, conflictAction: "uniquify" });
  }

  // A protected item's reference: kept on the "Protected references" moodboard with its label.
  async function reference(ref, thumbs) {
    const boards = await PBMediaStore.boards();
    const board = boards.find((b) => b.name === "Protected references") || (await PBMediaStore.newBoard("Protected references"));
    let kept = 0;
    for (const t of thumbs.slice(0, 4)) {
      const bytes = Uint8Array.from(atob(t.b64), (c) => c.charCodeAt(0));
      const sha256 = await PB.mediaSha256(bytes), mime = PB.sniffMime(bytes) || "image/jpeg";
      const rec = { ...PB.savedRecord({ bytes: bytes.length, mime, url: t.url, page: ref.page, pageTitle: ref.title }, { sha256, collection: { type: "moodboard", id: board.id }, tags: ["protected source", "reference"], note: `${ref.label} ${ref.reason || ""}`.trim() }), reference: ref };
      await PBMediaStore.put(rec, new Blob([bytes], { type: mime }));
      kept++;
    }
    if (!kept) {
      const sha256 = await PB.mediaSha256(new TextEncoder().encode(JSON.stringify(ref)));
      const rec = { ...PB.savedRecord({ bytes: 0, mime: "text/uri-list", url: ref.page, page: ref.page, pageTitle: ref.title }, { sha256, collection: { type: "moodboard", id: board.id }, tags: ["protected source", "reference"], note: `${ref.label} ${ref.reason || ""}`.trim() }), kind: "image", reference: ref };
      await PBMediaStore.put(rec, new Blob([JSON.stringify(ref, null, 2)], { type: "application/json" }));
    }
    return { board: board.name, kept };
  }

  function onMessage(msg, sender, sendResponse) {
    if (!msg || !sender.tab) return false;
    if (msg.type === "pb-qs-download") { download(msg).then(sendResponse, (e) => sendResponse({ error: e.message })); return true; }
    if (msg.type === "pb-qs-reference") { reference(msg.ref, msg.thumbs || []).then(sendResponse, (e) => sendResponse({ error: e.message })); return true; }
    return false;
  }

  if (chrome.contextMenus) chrome.contextMenus.onClicked.addListener((info, tab) => { onClick(info, tab); });
  if (chrome.downloads && chrome.downloads.onDeterminingFilename) chrome.downloads.onDeterminingFilename.addListener(onFilename);
  chrome.runtime.onMessage.addListener(onMessage);
  return Object.freeze({ create, download, onClick, reference });
})();
