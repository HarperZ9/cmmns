// Automatic About data for every reply author, in the page, with no second page.
// The page-world script (sniff.js) learns X's own AboutAccountQuery request the first time X
// makes it and repeats it for each handle this script asks about. The learned request shape is
// kept in chrome.storage.local (no CSRF token; that is read fresh from X's cookie each time).
// If Radar has never seen X make that request, it opens the About page of ONE account once in the
// minimised worker window so X makes it; after that everything happens in the page.
// Pace: one account every GAP_MS. A 429 (rate limit) pauses for PAUSE_MS. A 400/404 means X
// changed the request, so the shape is forgotten and learned again.
(() => {
  "use strict";
  const KEY = "pb.tpl", GAP_MS = 1500, PAUSE_MS = 5 * 60000;
  const queue = [], asked = new Set();
  let template = null, busy = false, pausedUntil = 0, bootstrapping = false, onChange = () => {};
  const api = (globalThis.chrome && chrome.storage && chrome.storage.local) || null;

  const toPage = (msg) => window.postMessage(msg, location.origin);
  function setTemplate(t) { template = t; if (t) toPage({ source: "radar-template-set", template: t }); pump(); }

  if (api) api.get(KEY).then((g) => g[KEY] && setTemplate(g[KEY])).catch(() => {});
  if (globalThis.chrome && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((ch, area) => { if (area === "local" && ch[KEY] && ch[KEY].newValue) setTemplate(ch[KEY].newValue); });
  }

  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data) return;
    if (e.data.source === "radar-template" && e.data.template) {
      if (api) api.set({ [KEY]: e.data.template }).catch(() => {});
      bootstrapping = false;
      setTemplate(e.data.template);
    }
    if (e.data.source === "radar-about-done") done(e.data.handle, e.data.status);
  });

  function done(handle, status) {
    busy = false;
    if (status === 429) pausedUntil = Date.now() + PAUSE_MS;
    if (status === 400 || status === 404 || status === "no-template") {
      template = null;
      if (api) api.remove(KEY).catch(() => {});
      asked.delete(handle);
      queue.unshift(handle);
    }
    onChange();
    setTimeout(pump, GAP_MS);
  }

  function bootstrap() {
    if (bootstrapping || !queue.length) return;
    bootstrapping = true;
    chrome.runtime.sendMessage({ type: "pb-lookup", handles: [queue[0]] }).catch(() => { bootstrapping = false; });
    setTimeout(() => { bootstrapping = false; pump(); }, 30000);   // try again if X never made the request
  }

  function pump() {
    if (busy || !queue.length) return;
    if (Date.now() < pausedUntil) { setTimeout(pump, pausedUntil - Date.now()); return; }
    if (!template) { bootstrap(); return; }
    busy = true;
    const handle = queue.shift();
    toPage({ source: "radar-ask-about", handle });
    setTimeout(() => { if (busy) done(handle, "timeout"); }, 15000);
  }

  // handles: accounts on screen with no About data yet. Each is asked once per page session.
  function want(handles, cb) {
    if (cb) onChange = cb;
    for (const h of handles) if (!asked.has(h)) { asked.add(h); queue.push(h); }
    pump();
  }

  globalThis.PBAuto = Object.freeze({ want, left: () => queue.length + (busy ? 1 : 0), paused: () => Date.now() < pausedUntil });
})();
