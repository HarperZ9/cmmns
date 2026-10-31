// Runs in the page's own context on Instagram (manifest: world MAIN, document_start). Copies the JSON
// answers Instagram's web app already receives for the page (its /graphql and /api/v1 requests) and
// posts them to CMMNS' content script (quick-instagram.js), which keeps each post's caption, files,
// alt text, counts and comments for a save. CMMNS makes no request of its own. The last few answers
// are kept, so a content script that starts late still gets them. Errors are swallowed so Instagram
// itself never breaks.
(() => {
  "use strict";
  const want = (url) => /\/(graphql\/query|api\/graphql|api\/v1\/(media|feed|clips|discover)\/)/.test(String(url || ""));
  const kept = [];
  const post = (json) => {
    try {
      if (!json || typeof json !== "object") return;
      kept.push(json); while (kept.length > 12) kept.shift();
      window.postMessage({ source: "radar-ig", json }, location.origin);
    } catch (_) { /* ignore */ }
  };
  const parse = (text) => { try { return JSON.parse(String(text).replace(/^for \(;;\);/, "")); } catch (_) { return null; } };

  const origFetch = window.fetch;
  window.fetch = function (input) {
    const p = origFetch.apply(this, arguments);
    try {
      const url = typeof input === "string" ? input : input && input.url;
      if (want(url)) p.then((res) => res.clone().text().then((t) => post(parse(t))).catch(() => {})).catch(() => {});
    } catch (_) { /* ignore */ }
    return p;
  };

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    if (want(url)) this.addEventListener("load", () => {
      try { post(this.responseType === "json" ? this.response : parse(this.responseText)); } catch (_) { /* ignore */ }
    });
    return origOpen.apply(this, arguments);
  };

  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data || e.data.source !== "radar-ig-ask") return;
    for (const json of kept) { try { window.postMessage({ source: "radar-ig", json }, location.origin); } catch (_) { /* ignore */ } }
  });
})();
