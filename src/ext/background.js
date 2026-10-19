// Account lookups and the one-click scan.
// - Radar's toolbar popup (popup.js) asks the current tab to scan its thread.
// - A scan asks for every account on screen. This worker reads each account's profile header and
//   its "About this account" page in ONE reused tab inside a minimised window, so no tabs flicker open and closed.
//   One account at a time, at least GAP_MS apart, never faster than a person clicking through
//   profiles. The window closes itself when the queue has been empty for IDLE_CLOSE_MS.
const GAP_MS = 2500, TIMEOUT_MS = 12000, IDLE_CLOSE_MS = 15000;
const queue = [];
let busy = false, lastAt = 0, current = null, worker = null, idleTimer = 0, timeoutTimer = 0;


// The ownership table (owners.json, about 1 MB) is loaded once here, never into pages. Content
// scripts send the domains and handles a page shows and get back only the matching rows.
let ownersReady = null;
function owners() {
  if (!ownersReady) ownersReady = fetch(chrome.runtime.getURL("owners.json")).then((r) => r.json())
    .then((t) => { globalThis.PB_OWNER_ROWS = t.rows; return t.rows; })
    .catch((e) => { console.error("[radar] owners.json failed to load", e); return []; });
  return ownersReady;
}

// State links (state.json, src/core/state.js): small, but served the same way.
let stateReady = null;
function stateRows() {
  if (!stateReady) stateReady = fetch(chrome.runtime.getURL("state.json")).then((r) => r.json()).then((t) => t.rows || [])
    .catch((e) => { console.error("[radar] state.json failed to load", e); return []; });
  return stateReady;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "pb-state") {
    stateRows().then((rows) => {
      const want = (msg.domains || []).map((d) => d.toLowerCase()), handles = new Set((msg.handles || []).map((h) => h.toLowerCase()));
      sendResponse(rows.filter((r) => (r.x && handles.has(r.x.toLowerCase())) || (r.domain && want.some((d) => d === r.domain || d.endsWith("." + r.domain)))));
    });
    return true;
  }
  if (msg && msg.type === "pb-owners") {
    owners().then((rows) => {
      const want = new Set((msg.domains || []).map((d) => d.toLowerCase())), handles = new Set((msg.handles || []).map((h) => h.toLowerCase()));
      const hit = rows.filter((r) => handles.has(r.x) || [...want].some((d) => d === r.domain || d.endsWith("." + r.domain)));
      sendResponse(hit);
    });
    return true;   // answer asynchronously
  }
  if (msg && msg.type === "pb-lookup" && sender.tab) {
    for (const h of msg.handles || []) if (!queue.some((q) => q.handle === h)) queue.push({ handle: h, replyTo: sender.tab.id });
    report(sender.tab.id);
    pump();
  }
  if (msg && msg.type === "pb-page-read" && worker && sender.tab && sender.tab.id === worker.tabId && current) step(msg.kind, msg.reading);
});

function report(tabId) {
  const left = queue.filter((q) => q.replyTo === tabId).length + (current && current.replyTo === tabId ? 1 : 0);
  chrome.tabs.sendMessage(tabId, { type: "pb-progress", left }).catch(() => {});
}

// Each account is two page reads: the profile header, then the About page.
function step(kind, reading) {
  clearTimeout(timeoutTimer);
  if (reading) current.reading = { ...(current.reading || {}), ...reading };
  if (kind === "profile") { go(`https://x.com/${encodeURIComponent(current.handle)}/about#pb-lookup`); return; }
  finish(current.reading || null, current.reading ? null : "nothing readable");
}

function go(url) {
  chrome.tabs.update(worker.tabId, { url }).catch((e) => finish(current && current.reading || null, String(e)));
  timeoutTimer = setTimeout(() => (current && current.page === url ? step(url.includes("/about") ? "about" : "profile", null) : null), TIMEOUT_MS);
  if (current) current.page = url;
}

function finish(reading, error) {
  clearTimeout(timeoutTimer);
  const job = current;
  current = null;
  busy = false;
  if (job) {
    chrome.tabs.sendMessage(job.replyTo, { type: "pb-about-result", handle: job.handle, reading, error }).catch(() => {});
    report(job.replyTo);
  }
  pump();
}

async function ensureWorker() {
  if (worker) {
    try { await chrome.tabs.get(worker.tabId); return worker; } catch { worker = null; }
  }
  const win = await chrome.windows.create({ url: "about:blank", state: "minimized", focused: false });
  worker = { windowId: win.id, tabId: win.tabs[0].id };
  return worker;
}

function scheduleClose() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (queue.length || busy || !worker) return;
    chrome.windows.remove(worker.windowId).catch(() => {});
    worker = null;
  }, IDLE_CLOSE_MS);
}

async function pump() {
  if (busy) return;
  if (!queue.length) { scheduleClose(); return; }
  const wait = Math.max(0, lastAt + GAP_MS - Date.now());
  if (wait) { setTimeout(pump, wait); return; }
  busy = true;
  current = queue.shift();
  lastAt = Date.now();
  clearTimeout(idleTimer);
  try {
    await ensureWorker();
    go(`https://x.com/${encodeURIComponent(current.handle)}#pb-lookup`);
  } catch (e) {
    console.error("[radar] lookup failed for", current && current.handle, e);
    finish(null, String(e));
  }
}
