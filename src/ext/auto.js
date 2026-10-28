// Automatic About data for every reply author, in the page, with no second page.
// The page-world script (sniff.js) learns X's own AboutAccountQuery request the first time X
// makes it and repeats it for each handle this script asks about. The learned request shape is
// kept in chrome.storage.local (no CSRF token; that is read fresh from X's cookie each time).
// If CMMNS has never seen X make that request, it opens the About page of ONE account once in the
// minimised worker window so X makes it; after that everything happens in the page.
// Pace: from X's rate-limit headers (PB.nextStep in src/core/pace.js), never faster than one
// account every 1.5 s. A 429 waits for X's reset and retries the handle. A 400/404 means X
// changed the request, so the shape is forgotten and learned again.
(() => {
  "use strict";
  const KEY = "pb.tpl", GAP_MS = 1500, LIMITED_MS = 60000;
  const queue = [], asked = new Set(), tries = new Map();
  // nextAt spaces requests; pausedUntil is set only when X is limiting (a 429 or the reserve reached).
  let template = null, current = null, nextAt = 0, pausedUntil = 0, bootstrapping = false, onChange = () => {};
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
    if (e.data.source === "radar-about-done") done(e.data.handle, e.data.status, e.data);
  });

  // Pacing comes from X's rate-limit headers (PB.nextStep); a 429 or timeout retries the handle.
  function done(handle, status, rl = {}) {
    if (handle !== current) return;   // a late reply for a handle the timeout already settled
    current = null;
    const now = Date.now();
    const step = PB.nextStep({ status, remaining: rl.remaining, reset: rl.reset, now, tries: tries.get(handle) || 0 });
    if (step.retry) { tries.set(handle, (tries.get(handle) || 0) + 1); queue.unshift(handle); }
    nextAt = now + step.delay;
    if (status === 429 || step.delay >= LIMITED_MS) pausedUntil = nextAt;
    if (status === 400 || status === 404 || status === "no-template") {
      template = null;
      if (api) api.remove(KEY).catch(() => {});
      queue.unshift(handle);
    }
    onChange();
    setTimeout(pump, step.delay);
  }

  function bootstrap() {
    if (bootstrapping || !queue.length) return;
    bootstrapping = true;
    chrome.runtime.sendMessage({ type: "pb-lookup", handles: [queue[0]] }).catch(() => { bootstrapping = false; });
    setTimeout(() => { bootstrapping = false; pump(); }, 30000);   // try again if X never made the request
  }

  function pump() {
    if (current || !queue.length) return;
    if (Date.now() < nextAt) { setTimeout(pump, nextAt - Date.now()); return; }
    if (!template) { bootstrap(); return; }
    const handle = current = queue.shift();
    toPage({ source: "radar-ask-about", handle });
    setTimeout(() => done(handle, "timeout"), 15000);
  }

  // handles: accounts on screen with no About data yet. Each is asked once per page session.
  function want(handles, cb) {
    if (cb) onChange = cb;
    if (globalThis.PBSettings && PBSettings.get().protection) return;   // source-protection mode: no lookups
    for (const h of handles) if (!asked.has(h)) { asked.add(h); queue.push(h); }
    pump();
  }

  globalThis.PBAuto = Object.freeze({ want, left: () => queue.length + (current ? 1 : 0), paused: () => Date.now() < pausedUntil });
})();
