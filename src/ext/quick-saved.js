// Files already saved, so a library of thousands keeps one copy of each: the direct address and,
// for files made in the page, the content hash, in this browser only (chrome.storage.local, under
// "pb.saved.v1", at most 20,000 entries). One page keeps one copy of the list in memory, so a save
// reads storage once per page rather than once per file. Writes go one after another, so the files
// of one post saved at the same time never overwrite each other's entries, and the save does not
// wait for them: the note says the file is saved as soon as the browser has it.
globalThis.PBQuickSaved = globalThis.PBQuickSaved || (() => {
  "use strict";
  const KEY = "pb.saved.v1", MAX = 20000;
  let cache = null, chain = Promise.resolve();

  async function all() {
    if (!cache) cache = chrome.storage.local.get(KEY).then((g) => g[KEY] || {});
    return cache;
  }
  // Another tab (or "Clear saved list" in the options) changed the list: read it again next time.
  try { chrome.storage.onChanged.addListener((ch, area) => { if (area === "local" && ch[KEY]) cache = null; }); } catch { /* no storage events here */ }

  // The name a key was saved under, or null.
  async function savedAs(keys) {
    try { const list = await all(); const k = keys.find((x) => x && list[x]); return k ? list[k][0] : null; }
    catch (e) { console.warn("[cmmns] could not read the saved list", e); cache = null; return null; }
  }

  // Entries noted but not yet written. One write takes all of them: a bulk save of 200 files reads and
  // writes the list a handful of times, not 200 times (each write is the whole list, up to 20,000 entries).
  let pending = new Map(), queued = false;
  async function write() {
    queued = false;
    const batch = pending;
    pending = new Map();
    if (!batch.size) return;
    const list = await chrome.storage.local.get(KEY).then((g) => g[KEY] || {});
    for (const [k, v] of batch) list[k] = v;
    const entries = Object.entries(list);
    const kept = entries.length > MAX ? Object.fromEntries(entries.sort((a, b) => b[1][1] - a[1][1]).slice(0, MAX)) : list;
    await chrome.storage.local.set({ [KEY]: kept });
    for (const [k, v] of pending) kept[k] = v;   // noted while this write was on its way
    cache = Promise.resolve(kept);
  }
  // Notes the file; resolves when written. Callers need not wait: writes are queued in order.
  function remember(keys, name) {
    const now = keys.filter(Boolean).map((k) => [k, [name, Date.now()]]);
    for (const [k, v] of now) pending.set(k, v);
    // This page's copy knows at once, so a second save of the same file before the write is caught.
    if (cache) cache = cache.then((l) => { for (const [k, v] of now) l[k] = v; return l; });
    if (!queued) { queued = true; chain = chain.then(write).catch((e) => console.warn("[cmmns] could not note the saved file", e)); }
    return chain;
  }

  class Already extends Error { constructor(name) { super(`Already saved as ${name}.`); this.fileName = name; } }

  return Object.freeze({ savedAs, remember, Already, settled: () => chain });
})();
