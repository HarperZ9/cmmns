// Saved media, kept in this browser's IndexedDB under the extension's own origin: "items" holds
// each record (src/core/media-collect.js), "blobs" holds each file once by its SHA-256, and
// "boards" holds the moodboards. Nothing here touches the network. Files stay until the user
// deletes them on the collections page; "Delete all saved media" there removes the database.
globalThis.PBMediaStore = (() => {
  "use strict";
  const NAME = "daylight-media", VERSION = 1;
  let opening = null;

  function db() {
    if (opening) return opening;
    opening = new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains("items")) d.createObjectStore("items", { keyPath: "id" }).createIndex("sha256", "sha256");
        if (!d.objectStoreNames.contains("blobs")) d.createObjectStore("blobs");
        if (!d.objectStoreNames.contains("boards")) d.createObjectStore("boards", { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { opening = null; reject(req.error); };
    });
    return opening;
  }

  // Runs fn(stores) in one transaction and resolves with what fn returned once it commits.
  async function tx(names, mode, fn) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const t = d.transaction(names, mode);
      const stores = Object.fromEntries(names.map((n) => [n, t.objectStore(n)]));
      let out;
      try { out = fn(stores); } catch (e) { reject(e); t.abort(); return; }
      t.oncomplete = () => resolve(out && out.req ? out.req.result : out);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error("transaction aborted"));
    });
  }
  const all = (store) => ({ req: store.getAll() });

  // A record and its file. The file is stored once per hash, however many records point at it.
  const put = (record, blob) => tx(["items", "blobs"], "readwrite", (s) => { s.blobs.put(blob, record.sha256); s.items.put(record); return record; });
  const items = () => tx(["items"], "readonly", (s) => all(s.items));
  const item = (id) => tx(["items"], "readonly", (s) => ({ req: s.items.get(id) }));
  const blob = (sha256) => tx(["blobs"], "readonly", (s) => ({ req: s.blobs.get(sha256) }));
  const update = (record) => tx(["items"], "readwrite", (s) => { s.items.put(record); return record; });

  // Removes a record, and its file when no other record uses the same hash.
  async function remove(id) {
    const rec = await item(id);
    if (!rec) return false;
    const same = (await items()).filter((r) => r.sha256 === rec.sha256 && r.id !== id).length;
    await tx(["items", "blobs"], "readwrite", (s) => { s.items.delete(id); if (!same) s.blobs.delete(rec.sha256); });
    return true;
  }

  const boards = () => tx(["boards"], "readonly", (s) => all(s.boards));
  function newBoard(name, now = new Date().toISOString()) {
    const clean = String(name || "").trim().replace(/\s+/g, " ").slice(0, 80);
    if (!clean) throw new Error("A moodboard needs a name.");
    const board = { id: "mb-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: clean, created: now, note: "" };
    return tx(["boards"], "readwrite", (s) => { s.boards.put(board); return board; });
  }
  const putBoard = (board) => tx(["boards"], "readwrite", (s) => { s.boards.put(board); return board; });
  async function removeBoard(id) {
    for (const r of (await items()).filter((x) => x.collection.type === "moodboard" && x.collection.id === id)) await remove(r.id);
    await tx(["boards"], "readwrite", (s) => { s.boards.delete(id); });
  }

  // Deletes every saved file, record and moodboard.
  async function clearAll() {
    const d = await db();
    d.close();
    opening = null;
    await new Promise((resolve, reject) => { const r = indexedDB.deleteDatabase(NAME); r.onsuccess = resolve; r.onerror = () => reject(r.error); r.onblocked = resolve; });
  }

  // { files, bytes }: what the collections hold, counting each stored file once.
  async function usage() {
    const list = await items(), seen = new Map();
    for (const r of list) seen.set(r.sha256, r.bytes || 0);
    return { records: list.length, files: seen.size, bytes: [...seen.values()].reduce((a, b) => a + b, 0) };
  }

  return Object.freeze({ put, items, item, blob, update, remove, boards, newBoard, putBoard, removeBoard, clearAll, usage });
})();
