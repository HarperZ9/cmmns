// Site context in the background worker: the site table (sites.json, src/core/sites.js), the owner
// and state tables, the review list page, the site card for the page being read (on the toolbar
// button only), search-result cards (registered only for engines the user turned on) and the
// opt-in "Other coverage" lookup, the only request Radar makes off the machine.
(() => {
  "use strict";
  const get = (f) => fetch(chrome.runtime.getURL(f)).then((r) => r.json());
  let ready = null;
  function tables() {
    if (!ready) ready = Promise.all([get("sites.json"), get("owners.json"), get("state.json")]).then(([sites, owners, state]) => {
      PB.setSiteTable(sites); PB.setOwnerRows(owners.rows); PB.setStateRows(state.rows);
      return true;
    }).catch((e) => { console.error("[radar] site tables failed to load", e); ready = null; return false; });
    return ready;
  }
  const settings = async () => PB.normalizeSettings((await chrome.storage.local.get(PB.SETTINGS_KEY))[PB.SETTINGS_KEY]);

  // Everything Radar knows about one site, from the bundled tables only.
  function infoOf(domain, full) {
    const host = PB.hostOf("https://" + String(domain).replace(/^https?:\/\//, "")) || String(domain);
    const rec = PB.siteRecord(host);
    return { domain: host, owner: PB.ownerOfDomain(host), state: PB.stateLinksOfDomain(host), facts: PB.siteFacts(host), record: full ? rec : PB.recordSummary(rec) };
  }

  // Other coverage: at most one request every 5 seconds, as GDELT asks.
  let lastCall = 0;
  async function coverage(msg) {
    const s = await settings();
    if (!s.coverage || !s.coverageConsent) return { error: "off" };
    if (!(await chrome.permissions.contains({ origins: [PB.COVERAGE_ORIGIN] }))) return { error: "no-permission" };
    const url = PB.coverageUrl(msg.title);
    if (!url) return { error: "short-title" };
    const wait = Math.max(0, lastCall + 5000 - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    const t0 = Date.now();
    const res = await fetch(url, { credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store" });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { return { error: "gdelt", detail: text.slice(0, 160), ms: Date.now() - t0 }; }
    await tables();
    const list = PB.coverageList(json, { self: msg.domain, infoOf: (d) => infoOf(d) });
    return { list, groups: PB.coverageGroups(list), query: PB.coverageTerms(msg.title), ms: Date.now() - t0 };
  }

  // The site card for the tab being read, injected only when the user presses the button.
  async function sitePage(tabId) {
    const [probe] = await chrome.scripting.executeScript({ target: { tabId }, func: () => !!globalThis.PBSitePage });
    if (probe && probe.result) { await chrome.scripting.executeScript({ target: { tabId }, func: () => globalThis.PBSitePage.show() }); return; }
    await chrome.scripting.insertCSS({ target: { tabId }, files: ["badges.css"] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ["core.bundle.js", "settings.js", "pop.js", "linkcard.js", "sitepage.js"] });
  }

  // Search-result cards: one registered script per engine the user turned on and granted.
  async function syncSearch() {
    if (!chrome.scripting || !chrome.scripting.registerContentScripts) return;
    const s = await settings();
    const have = new Set((await chrome.scripting.getRegisteredContentScripts()).map((x) => x.id));
    for (const [id, , matches, origin] of PB.SEARCH_ENGINES) {
      const sid = "radar-search-" + id;
      const want = PB.searchOn(s, id) && (await chrome.permissions.contains({ origins: [origin] }));
      if (want && !have.has(sid)) await chrome.scripting.registerContentScripts([{ id: sid, matches, js: ["core.bundle.js", "settings.js", "pop.js", "linkcard.js", "search.js"], css: ["badges.css"], runAt: "document_idle", persistAcrossSessions: true }]);
      if (!want && have.has(sid)) await chrome.scripting.unregisterContentScripts({ ids: [sid] });
    }
  }
  const sync = () => syncSearch().catch((e) => console.error("[radar] could not update search-result scripts", e));
  chrome.storage.onChanged.addListener((ch, area) => { if (area === "local" && ch[PB.SETTINGS_KEY]) sync(); });
  if (chrome.permissions.onRemoved) chrome.permissions.onRemoved.addListener(sync);
  if (chrome.permissions.onAdded) chrome.permissions.onAdded.addListener(sync);
  sync();

  const answer = (p, sendResponse) => { p.then(sendResponse, (e) => { console.error("[radar] site request failed", e); sendResponse({ error: String(e && e.message || e) }); }); return true; };
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || typeof msg.type !== "string") return undefined;
    if (msg.type === "pb-sites") return answer(tables().then(() => Object.fromEntries((msg.domains || []).slice(0, 60).map((d) => [d, infoOf(d)]))), sendResponse);
    if (msg.type === "pb-site-list") return answer(tables().then(() => infoOf(msg.domain, true)), sendResponse);
    if (msg.type === "pb-open-sites") { chrome.tabs.create({ url: chrome.runtime.getURL("sites.html") + "#" + encodeURIComponent(msg.domain || "") }); return undefined; }
    if (msg.type === "pb-coverage") return answer(coverage(msg), sendResponse);
    if (msg.type === "pb-open-options") { chrome.runtime.openOptionsPage(); return undefined; }
    // From the toolbar popup only: an extension page has no sender tab.
    if (msg.type === "pb-site-page" && !sender.tab && Number.isInteger(msg.tabId)) return answer(sitePage(msg.tabId).then(() => ({ ok: true })), sendResponse);
    return undefined;
  });
})();
