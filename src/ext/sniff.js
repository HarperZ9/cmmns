// Runs in the page's own context on X (manifest: world MAIN, document_start). Three jobs:
// 1. Copies the JSON of GraphQL responses X's web app already requested and posts it to CMMNS'
//    content script (account data for every reply, with no request of CMMNS' own).
// 2. Learns the shape of X's own "About this account" request (AboutAccountQuery) the first time
//    X makes it, then, when the content script asks, makes that same request for other accounts,
//    exactly as X does when you open their About page. The CSRF token is read fresh from X's own
//    cookie on each request and never stored. Errors are swallowed so X itself never breaks.
(() => {
  "use strict";
  const isGraph = (url) => /\/i\/api\/graphql\//.test(String(url || ""));
  const isAbout = (url) => /\/AboutAccountQuery\b/.test(String(url || ""));
  const post = (msg) => { try { window.postMessage(msg, location.origin); } catch (_) { /* ignore */ } };
  let template = null;   // { url, headers } of X's own AboutAccountQuery, csrf removed
  // The last few responses, kept in this tab only, for the download button (quick-sites.js), which
  // starts after X has already loaded the post it shows. Sent again only when that script asks.
  const recent = [];
  const sniffed = (json) => { recent.push(json); if (recent.length > 8) recent.shift(); post({ source: "radar-sniff", json }); };

  function learn(url, headers) {
    if (!isAbout(url)) return;
    const h = {};
    for (const [k, v] of Object.entries(headers || {})) if (!/^x-csrf-token$|^cookie$/i.test(k)) h[k.toLowerCase()] = v;
    if (!h.authorization) return;
    template = { url: String(url), headers: h };
    post({ source: "radar-template", template });
  }

  // 3. Notes the HLS and DASH playlist addresses X's player asks for, so the download button can find
  //    a video's stream. X empties the browser's resource timing list, which held them before.
  const STREAM = /\.(m3u8|mpd)(?:$|[?#])/i;
  const streams = [];
  const stream = (url) => {
    const u = String(url || "");
    if (!/^https:/i.test(u) || !STREAM.test(u) || streams.includes(u)) return;
    streams.push(u); if (streams.length > 400) streams.shift();
    post({ source: "radar-stream", url: u });
  };
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) stream(e.name); }).observe({ type: "resource", buffered: true }); } catch (_) { /* no observer here */ }

  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    const p = origFetch.apply(this, arguments);
    try {
      const url = typeof input === "string" ? input : input && input.url;
      stream(url);
      if (isGraph(url)) {
        const hd = init && init.headers ? (init.headers instanceof Headers ? Object.fromEntries(init.headers) : init.headers) : {};
        learn(url, hd);
        p.then((res) => res.clone().json().then(sniffed).catch(() => {})).catch(() => {});
      }
    } catch (_) { /* ignore */ }
    return p;
  };

  const origOpen = XMLHttpRequest.prototype.open, origSet = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function (method, url) {
    try { stream(url); } catch (_) { /* ignore */ }
    this.__radar = isGraph(url) ? { url, headers: {} } : null;
    if (this.__radar) this.addEventListener("load", () => {
      try {
        learn(this.__radar.url, this.__radar.headers);
        sniffed(this.responseType === "json" ? this.response : JSON.parse(this.responseText));
      } catch (_) { /* ignore */ }
    });
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.setRequestHeader = function (k, v) {
    if (this.__radar) this.__radar.headers[k] = v;
    return origSet.apply(this, arguments);
  };

  // Requests from the content script.
  window.addEventListener("message", async (e) => {
    if (e.source !== window || !e.data) return;
    if (e.data.source === "radar-template-set" && e.data.template && !template) template = e.data.template;
    if (e.data.source === "radar-sniff-replay-ask") { for (const json of recent) post({ source: "radar-sniff-replay", json }); for (const url of streams) post({ source: "radar-stream", url }); return; }
    if (e.data.source !== "radar-ask-about") return;
    const handle = e.data.handle;
    if (!template) { post({ source: "radar-about-done", handle, status: "no-template" }); return; }
    try {
      const u = new URL(template.url, location.origin);
      const vars = JSON.parse(u.searchParams.get("variables") || "{}");
      for (const k of Object.keys(vars)) if (/screen_?name|username/i.test(k)) vars[k] = handle;
      if (!Object.keys(vars).some((k) => /screen_?name|username/i.test(k))) vars.screenName = handle;
      u.searchParams.set("variables", JSON.stringify(vars));
      const csrf = (document.cookie.match(/(?:^|;\s*)ct0=([^;]+)/) || [])[1];
      const res = await origFetch.call(window, u.toString(), { credentials: "include", headers: { ...template.headers, ...(csrf ? { "x-csrf-token": csrf } : {}) }, signal: AbortSignal.timeout(15000) });
      if (res.ok) post({ source: "radar-sniff", json: await res.json(), about: handle });
      const num = (h) => { const v = res.headers.get(h); return v == null ? undefined : Number(v); };
      post({ source: "radar-about-done", handle, status: res.status,
        remaining: num("x-rate-limit-remaining"), reset: num("x-rate-limit-reset") });
    } catch (err) {
      post({ source: "radar-about-done", handle, status: "error" });
    }
  });
})();
