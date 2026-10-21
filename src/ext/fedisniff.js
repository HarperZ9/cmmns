// Runs in the page's own context on TikTok and on Mastodon servers the user turned Radar on for
// (world MAIN, document_start). Copies the JSON of the comment, thread and timeline responses the
// site's web app already requested and posts it to Radar's content scripts. Radar makes no request
// of its own, and never reads request headers or tokens. Errors are swallowed so the site never breaks.
(() => {
  "use strict";
  const TIKTOK = /(^|\.)tiktok\.com$/.test(location.hostname);
  const want = TIKTOK
    ? (url) => /\/api\/comment\/list(?:\/reply)?\//.test(url)
    : (url) => /\/api\/v[12]\/(?:statuses\/[^/?]+(?:\/context)?|timelines\/[^?]+|accounts\/[^/?]+(?:\/statuses)?|trends\/statuses)(?:\?|$)/.test(url);
  const source = TIKTOK ? "radar-tiktok" : "radar-masto";
  const post = (json) => { try { if (json) window.postMessage({ source, json }, location.origin); } catch (_) { /* ignore */ } };
  const urlOf = (input) => String(typeof input === "string" ? input : (input && input.url) || "");

  const origFetch = window.fetch;
  window.fetch = function (input) {
    const p = origFetch.apply(this, arguments);
    try { if (want(urlOf(input))) p.then((res) => res.clone().json().then(post).catch(() => {})).catch(() => {}); } catch (_) { /* ignore */ }
    return p;
  };
  // Mastodon's web app requests through XMLHttpRequest (axios).
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    try {
      if (want(String(url))) this.addEventListener("load", () => {
        try { post(this.responseType === "json" ? this.response : JSON.parse(this.responseText)); } catch (_) { /* ignore */ }
      });
    } catch (_) { /* ignore */ }
    return origOpen.apply(this, arguments);
  };
})();
