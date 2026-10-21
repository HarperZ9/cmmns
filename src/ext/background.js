// Account lookups and the one-click scan.
// - Radar's toolbar popup (popup.js) asks the current tab to scan its thread.
// - A scan asks for every account on screen. This worker reads each account's profile header and
//   its "About this account" page in ONE reused tab inside a minimised window, so no tabs flicker open and closed.
//   One account at a time, at least GAP_MS apart, never faster than a person clicking through
//   profiles. The window closes itself when the queue has been empty for IDLE_CLOSE_MS.
// Chrome runs this file as a service worker and loads the core bundle and the housekeeping here;
// Firefox lists them before this file in the manifest's background scripts.
if (typeof importScripts === "function" && !globalThis.PB) importScripts("core.bundle.js", "lifecycle.js", "instances.js");
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

// Fact-checked claims (claims.json and the parts it names, src/core/claims.js, about 6 MB): indexed once here. Pages send
// the text of the posts they show and get back only the matches. Nothing leaves the browser.
let claimsReady = null;
function claimIndex() {
  const get = (name) => fetch(chrome.runtime.getURL(name)).then((r) => r.json());
  if (!claimsReady) claimsReady = get("claims.json").then(async (main) => PB.buildClaimIndex(PB.joinClaims(main, await Promise.all((main.parts || []).map(get)))))
    .catch((e) => { console.error("[radar] claims.json failed to load", e); return null; });
  return claimsReady;
}

// The window's two faces (fonts.js) as bytes: the page never loads an extension URL, so the
// fonts need no web-accessible resource and pass any font policy the site sets.
let fontsReady = null;
function fontBytes() {
  const b64 = (buf) => { const u = new Uint8Array(buf); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
  const get = ([family, file, weight]) => fetch(chrome.runtime.getURL("fonts/" + file)).then((r) => r.arrayBuffer()).then((b) => ({ family, weight, data: b64(b) }));
  if (!fontsReady) fontsReady = Promise.all([["Radar Hanken", "hanken-grotesk.woff2", "100 900"], ["Radar Conso", "conso-regular.woff2", "400"]].map(get))
    .catch((e) => { console.error("[radar] the window's fonts failed to load", e); fontsReady = null; return []; });
  return fontsReady;
}

const cards = {};   // fallback where storage.session is missing
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "pb-fonts") { fontBytes().then(sendResponse); return true; }
  if (msg && msg.type === "pb-claims") {
    claimIndex().then((index) => {
      const out = {};
      for (const p of msg.posts || []) { const hits = PB.matchClaims(index, p.text); if (hits.length) out[p.id] = hits; }
      sendResponse(out);
    });
    return true;
  }
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
  // A thread card from a content script: kept for this session only, then shown on evidence-card.html.
  if (msg && msg.type === "pb-card-open") {
    const id = String(Date.now());
    const put = chrome.storage.session ? chrome.storage.session.set({ ["pb.card." + id]: msg.built }) : Promise.resolve((cards[id] = msg.built));
    put.then(() => chrome.tabs.create({ url: chrome.runtime.getURL("evidence-card.html#" + id) })).catch((e) => console.error("[radar] could not open the card", e));
  }
  if (msg && msg.type === "pb-card-get") {
    const key = "pb.card." + msg.id;
    (chrome.storage.session ? chrome.storage.session.get(key).then((g) => g[key]) : Promise.resolve(cards[msg.id])).then((c) => sendResponse(c || null));
    return true;
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
  // Firefox for Android has no windows: a background tab does the reading there.
  if (!chrome.windows) { const tab = await chrome.tabs.create({ url: "about:blank", active: false }); worker = { windowId: null, tabId: tab.id }; return worker; }
  const win = await chrome.windows.create({ url: "about:blank", state: "minimized", focused: false });
  worker = { windowId: win.id, tabId: win.tabs[0].id };
  return worker;
}

function scheduleClose() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (queue.length || busy || !worker) return;
    (worker.windowId == null ? chrome.tabs.remove(worker.tabId) : chrome.windows.remove(worker.windowId)).catch(() => {});
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
