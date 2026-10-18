// Account lookups and the one-click scan.
// - Clicking Radar's toolbar button tells the current tab to scan its thread.
// - A scan asks for every account on screen. This worker reads each account's profile header and
//   its "About this account" page in ONE reused tab inside a minimised window, so no tabs flicker open and closed.
//   One account at a time, at least GAP_MS apart, never faster than a person clicking through
//   profiles. The window closes itself when the queue has been empty for IDLE_CLOSE_MS.
const GAP_MS = 2500, TIMEOUT_MS = 12000, IDLE_CLOSE_MS = 15000;
const queue = [];
let busy = false, lastAt = 0, current = null, worker = null, idleTimer = 0, timeoutTimer = 0;

chrome.action.onClicked.addListener((tab) => {
  if (tab && tab.id != null) chrome.tabs.sendMessage(tab.id, { type: "pb-scan" }).catch(() => {});
});

chrome.runtime.onMessage.addListener((msg, sender) => {
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
