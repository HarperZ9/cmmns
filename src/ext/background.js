// Account lookups. The user clicks "Look up" on a reply; this worker opens that account's
// "About this account" page in a background tab, the about-page script reads what X renders
// there, and the tab closes. One lookup at a time, at least GAP_MS apart, so the extension
// never reads faster than a person clicking through profiles.
const GAP_MS = 4000, TIMEOUT_MS = 20000;
const queue = [];
let busy = false, lastAt = 0;
const pending = new Map();   // tabId -> { handle, replyTo }

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg && msg.type === "pb-lookup" && sender.tab) {
    for (const h of msg.handles || []) if (!queue.some((q) => q.handle === h)) queue.push({ handle: h, replyTo: sender.tab.id });
    pump();
  }
  if (msg && msg.type === "pb-about-read" && sender.tab && pending.has(sender.tab.id)) {
    const job = pending.get(sender.tab.id);
    pending.delete(sender.tab.id);
    chrome.tabs.sendMessage(job.replyTo, { type: "pb-about-result", handle: job.handle, reading: msg.reading }).catch(() => {});
    chrome.tabs.remove(sender.tab.id).catch(() => {});
    busy = false;
    pump();
  }
});

function pump() {
  if (busy || !queue.length) return;
  const wait = Math.max(0, lastAt + GAP_MS - Date.now());
  if (wait) { setTimeout(pump, wait); return; }
  const job = queue.shift();
  busy = true;
  lastAt = Date.now();
  chrome.tabs.create({ url: `https://x.com/${encodeURIComponent(job.handle)}/about#pb-lookup`, active: false }).then((tab) => {
    pending.set(tab.id, job);
    setTimeout(() => {
      if (!pending.has(tab.id)) return;
      pending.delete(tab.id);
      chrome.tabs.sendMessage(job.replyTo, { type: "pb-about-result", handle: job.handle, reading: null, error: "timed out" }).catch(() => {});
      chrome.tabs.remove(tab.id).catch(() => {});
      busy = false;
      pump();
    }, TIMEOUT_MS);
  }).catch((e) => {
    console.error("[provenance-badges] could not open lookup tab for", job.handle, e);
    busy = false;
    pump();
  });
}
