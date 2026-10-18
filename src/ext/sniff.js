// Runs in the page's own context on X (manifest: world MAIN, document_start). Two jobs:
// 1. Copies the JSON of GraphQL responses X's web app already requested and posts it to Radar's
//    content script (account data for every reply, with no request of Radar's own).
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

  function learn(url, headers) {
    if (!isAbout(url)) return;
    const h = {};
    for (const [k, v] of Object.entries(headers || {})) if (!/^x-csrf-token$|^cookie$/i.test(k)) h[k.toLowerCase()] = v;
    if (!h.authorization) return;
    template = { url: String(url), headers: h };
    post({ source: "radar-template", template });
  }

  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    const p = origFetch.apply(this, arguments);
    try {
      const url = typeof input === "string" ? input : input && input.url;
      if (isGraph(url)) {
        const hd = init && init.headers ? (init.headers instanceof Headers ? Object.fromEntries(init.headers) : init.headers) : {};
        learn(url, hd);
        p.then((res) => res.clone().json().then((json) => post({ source: "radar-sniff", json })).catch(() => {})).catch(() => {});
      }
    } catch (_) { /* ignore */ }
    return p;
  };

  const origOpen = XMLHttpRequest.prototype.open, origSet = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__radar = isGraph(url) ? { url, headers: {} } : null;
    if (this.__radar) this.addEventListener("load", () => {
      try {
        learn(this.__radar.url, this.__radar.headers);
        const json = this.responseType === "json" ? this.response : JSON.parse(this.responseText);
        post({ source: "radar-sniff", json });
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
      const res = await origFetch.call(window, u.toString(), { credentials: "include", headers: { ...template.headers, ...(csrf ? { "x-csrf-token": csrf } : {}) } });
      if (res.ok) post({ source: "radar-sniff", json: await res.json(), about: handle });
      post({ source: "radar-about-done", handle, status: res.status });
    } catch (err) {
      post({ source: "radar-about-done", handle, status: "error" });
    }
  });
})();
