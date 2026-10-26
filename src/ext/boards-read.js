// Where a board's plates come from, for the Boards page: a 3.6.0 moodboard in this browser's
// collections (opened as a board, nothing rewritten), or a folder of saves the person picks (the
// Daylight folder, or one site's or the study folder), read with the browser's folder picker. Each
// plate's file becomes a blob address for the page; nothing leaves the browser.
globalThis.PBBoardsRead = (() => {
  "use strict";

  // { board, urls: Map(path -> blob address), entries } for a moodboard.
  async function fromMoodboard(id) {
    const mb = (await PBMediaStore.boards()).find((b) => b.id === id);
    if (!mb) throw new Error("That moodboard is not in this browser any more.");
    const records = PB.filterItems(await PBMediaStore.items(), { collection: { type: "moodboard", id } }).reverse();
    const urls = new Map();
    for (const r of records) { const b = await PBMediaStore.blob(r.sha256); if (b) urls.set(r.sha256, URL.createObjectURL(b)); }
    const board = PB.boardFromMoodboard(mb, records, { layout: mb.layout || "grid" });
    if (mb.lane) { board.lane = mb.lane; board.running_head.right = mb.lane.toUpperCase(); }
    if (mb.keywords) board.keyword_line = mb.keywords;
    return { board, urls, moodboard: mb };
  }

  async function* walk(dir, depth = 0) {
    if (depth > 6) return;
    for await (const [name, h] of dir.entries()) {
      if (h.kind === "directory") { if (name !== "boards") yield* walk(h, depth + 1); }
      else yield { name, h, dir };
    }
  }

  // The saves under a picked folder: [{ sidecar, sidecarName, files: [names], file: { name -> File } }].
  async function fromFolder(handle) {
    const out = [];
    for await (const { name, h, dir } of walk(handle)) {
      if (!name.endsWith(".md")) continue;
      const text = await (await h.getFile()).text();
      const sc = PB.parseSidecar(text);
      if (!sc) continue;
      const files = {};
      for (const f of Array.isArray(sc.front.files) ? sc.front.files : []) {
        try { files[f] = await (await dir.getFileHandle(f)).getFile(); } catch { /* the file was moved or deleted; its note stays */ }
      }
      out.push({ sidecar: sc, sidecarName: name, files: Object.keys(files), file: files, text });
    }
    return out.sort((a, b) => String(a.sidecar.front.posted || "").localeCompare(String(b.sidecar.front.posted || "")));
  }

  return Object.freeze({ fromMoodboard, fromFolder });
})();
