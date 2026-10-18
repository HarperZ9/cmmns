// Runs in the page's own context on YouTube (manifest: world MAIN, document_start). Copies the data
// YouTube's web app already has for the page (ytInitialData, ytInitialPlayerResponse, and the JSON
// of its own /youtubei/v1 requests) and posts it to Radar's content script. Radar makes no request
// of its own. Errors are swallowed so YouTube itself never breaks.
(() => {
  "use strict";
  const want = (url) => /\/youtubei\/v1\/(next|player|browse)\b/.test(String(url || ""));
  const post = (json) => { try { if (json) window.postMessage({ source: "radar-yt", json }, location.origin); } catch (_) { /* ignore */ } };

  const origFetch = window.fetch;
  window.fetch = function (input) {
    const p = origFetch.apply(this, arguments);
    try {
      const url = typeof input === "string" ? input : input && input.url;
      if (want(url)) p.then((res) => res.clone().json().then(post).catch(() => {})).catch(() => {});
    } catch (_) { /* ignore */ }
    return p;
  };

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    if (want(url)) this.addEventListener("load", () => {
      try { post(this.responseType === "json" ? this.response : JSON.parse(this.responseText)); } catch (_) { /* ignore */ }
    });
    return origOpen.apply(this, arguments);
  };

  // The first page load arrives inline, not through a request.
  const initial = () => { post(window.ytInitialData); post(window.ytInitialPlayerResponse); };
  document.addEventListener("DOMContentLoaded", initial);
  // Content script asks again after it starts, in case it missed the first post.
  window.addEventListener("message", (e) => { if (e.source === window && e.data && e.data.source === "radar-yt-ask") initial(); });
})();
