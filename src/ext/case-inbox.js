// "Add to case" in the toolbar popup: keeps the address and title of the page you are on, with the
// time you added it, in this browser's own storage. "Save case list" writes them as
// case-inbox.jsonl, which `daylight case add case-inbox.jsonl` or `daylight case run` captures.
// Nothing is sent anywhere, and the page itself is not read.
globalThis.PBCaseInbox = (() => {
  "use strict";
  const KEY = "caseInbox", MAX = 500;

  // The row for one tab, or null for a page that is not a web address.
  function row(tab, now = new Date().toISOString()) {
    const url = tab && typeof tab.url === "string" ? tab.url : "";
    if (!/^https?:\/\//i.test(url)) return null;
    return { url, title: tab.title ? String(tab.title).slice(0, 300) : null, added: now };
  }

  // Adds a row unless that address is there already. Returns the list after adding.
  function addTo(list, r) {
    if (!r || list.some((x) => x.url === r.url)) return list;
    return [...list, r].slice(-MAX);
  }

  const toJsonl = (list) => list.map((r) => JSON.stringify(r)).join("\n") + (list.length ? "\n" : "");

  async function load() { const got = await chrome.storage.local.get(KEY); return Array.isArray(got[KEY]) ? got[KEY] : []; }
  async function add(tab) { const list = addTo(await load(), row(tab)); await chrome.storage.local.set({ [KEY]: list }); return list; }
  // A saved media file (src/core/media-collect.js caseInboxRow): its address with the hash, page and
  // lineage the browser recorded. A second save of the same address replaces the first row.
  async function addRow(r) {
    if (!r || !/^https?:\/\//i.test(String(r.url || ""))) return load();
    const list = [...(await load()).filter((x) => x.url !== r.url), r].slice(-MAX);
    await chrome.storage.local.set({ [KEY]: list });
    return list;
  }

  function save(list, doc = document) {
    const a = doc.createElement("a");
    a.href = URL.createObjectURL(new Blob([toJsonl(list)], { type: "application/x-ndjson" }));
    a.download = "case-inbox.jsonl";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return Object.freeze({ row, addTo, toJsonl, load, add, addRow, save, KEY, MAX });
})();
