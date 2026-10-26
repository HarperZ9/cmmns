// The right-click entries Download, Download as GIF, Copy, Copy link and Copy with caption, and
// the browser download each one asks for. A click lets Daylight Commons read the clicked tab once (activeTab): the
// in-page scripts (quick-*.js) find the media under the pointer and make the file; this worker
// hands addresses to chrome.downloads, which saves to the Downloads folder without a dialog unless
// "Always ask where to save" is on. Protected media references are kept in the collections store.
globalThis.PBQuickBg = (() => {
  "use strict";
  const PAGE = ["quick-toast.js", "quick-resolve.js", "quick-sites.js", "quick-stream.js", "quick-gif.js", "quick-save.js", "quick-copy.js", "quick-text.js"];
  const ITEMS = [
    ["pb-dl", "Download", ["image", "video", "audio"]],
    ["pb-dl-here", "Download media here", ["page", "link", "frame"]],
    ["pb-study", "Study", ["image", "video", "audio", "page", "link", "frame", "selection"]],
    ["pb-note", "Save as note", ["page", "link", "frame", "selection"]],
    ["pb-card", "Save as card", ["page", "link", "frame", "selection"]],
    ["pb-dl-gif", "Download as GIF", ["image", "video"]],
    ["pb-copy", "Copy", ["image", "video", "page", "link", "frame"]],
    ["pb-copy-link", "Copy link", ["image", "video", "audio", "page", "link", "frame"]],
    ["pb-copy-caption", "Copy with caption", ["image", "video", "page", "link", "frame", "selection"]],
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
    // Source-protection mode: no download from a host. The page is told why, never left silent.
    if (!/copy-(link|caption)$/.test(id) && (await settings()).protection) { chrome.scripting.executeScript({ target: { tabId: tab.id }, args: [PROTECTED_SAVE], func: (t) => alert(t) }).catch(() => {}); return; }
    try {
      const target = await inject(tab.id, info.frameId);
      const args = { srcUrl: info.srcUrl || null, linkUrl: info.linkUrl || null, asGif: id === "pb-dl-gif", study: id === "pb-study", copy: id === "pb-copy", link: id === "pb-copy-link", caption: id === "pb-copy-caption",
        selection: info.selectionText || null, text: id === "pb-note" ? "note" : id === "pb-card" ? "card" : null };
      await chrome.scripting.executeScript({ target, args: [args], func: (a) => {
        // Text: a selection, a note or card of the post under the pointer, or a caption with no media.
        if (a.text) return PBQuickText.run(a.text, a).then(() => true);
        if (a.selection && (a.study || a.caption)) return PBQuickText.run(a.study ? "study" : "caption", a).then(() => true);
        if (a.caption && !a.srcUrl && !PBQuickResolve.resolve(a)) return PBQuickText.run("caption", a).then(() => true);
        if (a.copy || a.link || a.caption) return PBQuickCopy.copy(PBQuickResolve.resolve(a), { link: a.link, caption: a.caption }).then(() => true);
        PBQuickSave.fromMenu(a);
        return true;
      } });
    } catch (e) {
      console.warn("[daylight-commons] could not read the page for the download", e);
      // Browser pages and extension stores cannot be read; a picture's own address still downloads.
      if (id === "pb-dl" && info.srcUrl && /^https?:/.test(info.srcUrl)) download({ url: info.srcUrl, filename: null, fixExt: true }).catch(() => {});
    }
  }

  const PROTECTED_SAVE = "Source protection is on, so Daylight Commons did not download this: the request would tell the host. Use your browser's own Save as, and add the file to your case.";

  async function settings() {
    const k = PB.SETTINGS_KEY;
    try { return PB.normalizeSettings((await chrome.storage.local.get(k))[k]); } catch { return PB.normalizeSettings(null); }
  }

  // Starts a browser download. { url, filename, site, fixExt } -> { id }. The file goes to
  // "<save folder>/<site>/<name>" inside Downloads, so thousands of saves stay in one tree.
  async function download({ url, filename: name, site, fixExt, study = false, overwrite = false }) {
    if (!chrome.downloads) throw new Error("This browser did not give Daylight Commons the downloads permission.");
    const s = await settings();
    if (s.protection && /^https?:/i.test(url)) throw new Error(PROTECTED_SAVE);
    // Study saves go to "<save folder>/study/<site>/"; the reference library reads them first.
    const folder = study ? `${s.mediaFolder || "Daylight"}/study` : s.mediaFolder, conflict = overwrite ? "overwrite" : "uniquify";
    const filename = name ? PB.saveFolder(folder, site) + name.replace(/[\\/]/g, "-") : null;
    const opts = { url, saveAs: !!s.mediaAskWhere && !overwrite, conflictAction: conflict, ...(filename ? { filename } : {}) };
    pending.set(url, { fixExt: !!fixExt, filename, conflict });
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
    suggest({ filename: ext ? p.filename.replace(/\.[a-z0-9]{1,5}$/i, "") + "." + ext : p.filename, conflictAction: p.conflict || "uniquify" });
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
  return Object.freeze({ create, download, onClick, reference, inject, settings });
})();
