// Site context in the background worker: the site table (sites.json, src/core/sites.js), the owner
// and state tables, the review list page, the site card for the page being read (on the toolbar
// button only), search-result cards (registered only for engines the user turned on) and the
// opt-in "Other coverage" lookup, which asks the outlets the user chose for their own feeds.
(() => {
  "use strict";
  const get = (f) => fetch(chrome.runtime.getURL(f)).then((r) => r.json());
  let ready = null;
  function tables() {
    if (!ready) ready = Promise.all([get("sites.json"), get("owners.json"), get("state.json")]).then(([sites, owners, state]) => {
      PB.setSiteTable(sites); PB.setOwnerRows(owners.rows); PB.setStateRows(state.rows);
      return true;
    }).catch((e) => { console.error("[daylight-commons] site tables failed to load", e); ready = null; return false; });
    return ready;
  }
  // Site notes from enabled data packs (packs-bg.js) are set alongside the bundled tables.
  const withPacks = () => Promise.all([tables(), globalThis.PBPacks ? PBPacks.enabled() : null]);
  const settings = async () => PB.normalizeSettings((await chrome.storage.local.get(PB.SETTINGS_KEY))[PB.SETTINGS_KEY]);

  // Everything Daylight Commons knows about one site, from the bundled tables only.
  function infoOf(domain, full) {
    const host = PB.hostOf("https://" + String(domain).replace(/^https?:\/\//, "")) || String(domain);
    const rec = PB.siteRecord(host);
    return { domain: host, owner: PB.ownerOfDomain(host), state: PB.stateLinksOfDomain(host), facts: PB.siteFacts(host), record: full ? rec : PB.recordSummary(rec), notes: PB.siteNotesOf(host) };
  }

  // Other coverage: on the user's click, each chosen outlet's feed from its own host, in parallel,
  // and only hosts the browser allowed (src/core/feedfetch.js). The title is matched on this device.
  const feeds = PB.feedFetcher({ fetch: (u, o) => fetch(u, o), allowed: (origin) => chrome.permissions.contains({ origins: [origin] }) });
  async function coverage(msg) {
    const s = await settings();
    if (!s.coverage || !s.feedConsent) return { error: "off" };
    const chosen = PB.chosenFeeds(s);
    if (!chosen.length) return { error: "no-outlets" };
    if (PB.titleWords(msg.title).length < 2) return { error: "short-title" };
    const t0 = Date.now();
    const [results] = await Promise.all([feeds.fetchAll(chosen), withPacks()]);
    const { words, list } = PB.coverageFromFeeds(msg.title, results, { self: msg.domain, infoOf: (d) => infoOf(d) });
    return { list, groups: PB.coverageGroups(list), words, status: PB.feedStatus(results), hosts: PB.coveragePlan(chosen), ms: Date.now() - t0 };
  }

  // The site card for the tab being read, injected only when the user presses the button.
  async function sitePage(tabId) {
    const [probe] = await chrome.scripting.executeScript({ target: { tabId }, func: () => !!globalThis.PBSitePage });
    if (probe && probe.result) { await chrome.scripting.executeScript({ target: { tabId }, func: () => globalThis.PBSitePage.show() }); return; }
    await chrome.scripting.insertCSS({ target: { tabId }, files: ["badges.css"] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ["core.bundle.js", "settings.js", "pop.js", "linkcard.js", "generic-page.js", "sitepage.js"] });
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
  const sync = () => syncSearch().catch((e) => console.error("[daylight-commons] could not update search-result scripts", e));
  chrome.storage.onChanged.addListener((ch, area) => { if (area === "local" && ch[PB.SETTINGS_KEY]) sync(); });
  if (chrome.permissions.onRemoved) chrome.permissions.onRemoved.addListener(sync);
  if (chrome.permissions.onAdded) chrome.permissions.onAdded.addListener(sync);
  sync();

  const answer = (p, sendResponse) => { p.then(sendResponse, (e) => { console.error("[daylight-commons] site request failed", e); sendResponse({ error: String(e && e.message || e) }); }); return true; };
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || typeof msg.type !== "string") return undefined;
    if (msg.type === "pb-sites") return answer(withPacks().then(() => Object.fromEntries((msg.domains || []).slice(0, 60).map((d) => [d, infoOf(d)]))), sendResponse);
    if (msg.type === "pb-site-list") return answer(withPacks().then(() => infoOf(msg.domain, true)), sendResponse);
    if (msg.type === "pb-open-sites") { chrome.tabs.create({ url: chrome.runtime.getURL("sites.html") + "#" + encodeURIComponent(msg.domain || "") }); return undefined; }
    if (msg.type === "pb-coverage") return answer(coverage(msg), sendResponse);
    if (msg.type === "pb-open-options") { chrome.runtime.openOptionsPage(); return undefined; }
    // From the toolbar popup only: an extension page has no sender tab.
    if (msg.type === "pb-site-page" && !sender.tab && Number.isInteger(msg.tabId)) return answer(sitePage(msg.tabId).then(() => ({ ok: true })), sendResponse);
    return undefined;
  });
})();
