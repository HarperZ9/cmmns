// Runs in the page's own context on Bluesky (manifest: world MAIN, document_start). Copies the JSON
// of the thread, profile and feed responses Bluesky's web app already requested and posts it to
// CMMNS' content scripts. CMMNS makes no request of its own. Errors are swallowed so Bluesky
// itself never breaks.
(() => {
  "use strict";
  const want = (url) => /\/xrpc\/app\.bsky\.(?:unspecced\.getPostThread(?:V2|OtherV2)?|feed\.(?:getPostThread|getAuthorFeed|getTimeline|getFeed|getPosts)|actor\.getProfiles?)\b/.test(String(url || ""));
  const post = (json) => { try { if (json) window.postMessage({ source: "radar-bsky", json }, location.origin); } catch (_) { /* ignore */ } };
  const origFetch = window.fetch;
  window.fetch = function (input) {
    const p = origFetch.apply(this, arguments);
    try {
      const url = typeof input === "string" ? input : input && input.url;
      if (want(url)) p.then((res) => res.clone().json().then(post).catch(() => {})).catch(() => {});
    } catch (_) { /* ignore */ }
    return p;
  };
})();
