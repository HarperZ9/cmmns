// Site cards on links. Resting the pointer on an outbound link (or focusing it) opens Daylight Commons'
// window for the linked site: owner, owner type, founding date, country, state links and the site's
// fact-check record, each sourced. Lookups go to Daylight Commons' background worker and its bundled tables;
// nothing leaves the browser. Links to the page's own site and to platforms are skipped.
(() => {
  "use strict";
  if (globalThis.PBLinkCard) return;
  const OPEN_MS = 450;
  const cache = new Map();   // domain -> info | Promise
  const pageSite = PB.siteKey(PB.hostOf(location.href));
  let enabled = () => true;

  // The linked site, or null when there is nothing to show for this link.
  function siteOfLink(a) {
    if (!a || !a.href || a.closest(".pb-pop")) return null;
    const real = PB.realLink(a.href, a.textContent);
    const host = real && PB.hostOf(real);
    if (!host || PB.hostedKind(host)) return null;
    const key = PB.siteKey(host);
    return key && key !== pageSite ? host : null;
  }

  // Batched: every link domain asked for in one tick goes in one message.
  let batch = null;
  function info(domain) {
    if (cache.has(domain)) return Promise.resolve(cache.get(domain));
    if (!batch) {
      batch = { domains: new Set(), promise: null };
      batch.promise = new Promise((resolve) => setTimeout(async () => {
        const b = batch; batch = null;
        let got = {};
        try { got = (await chrome.runtime.sendMessage({ type: "pb-sites", domains: [...b.domains] })) || {}; } catch (e) { console.error("[daylight-commons] site lookup failed", e); }
        for (const d of b.domains) cache.set(d, got[d] || { domain: d, owner: null, state: [], facts: null, record: null });
        resolve();
      }, 30));
    }
    batch.domains.add(domain);
    return batch.promise.then(() => cache.get(domain));
  }

  const openList = (domain) => () => chrome.runtime.sendMessage({ type: "pb-open-sites", domain }).catch((e) => console.error("[daylight-commons] could not open the review list", e));
  function sections(i, extra = []) {
    return [{ glance: PB.siteGlance(i) }, { tab: "overview", title: "Site", rows: PB.siteInfoRows(i, { onList: openList(i.domain) }) }, ...extra];
  }

  // Dark pages get Daylight Commons' dark palette, read from the page's own background. The social sites set
  // it themselves (src/ext/ui.js).
  function theme() {
    const bg = getComputedStyle(document.body || document.documentElement).backgroundColor.match(/\d+/g);
    const dark = bg && bg.length >= 3 && (Number(bg[3] ?? 1) > 0) ? (0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2]) < 110 : matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("pb-dark", !!dark);
  }

  function wire(a) {
    if (a.__pbLink !== undefined) return a.__pbLink;
    const domain = siteOfLink(a);
    a.__pbLink = domain;
    if (!domain) return null;
    info(domain).then((i) => {
      PBPop.hover(a, () => (enabled() ? sections(i) : null));
      if (a.matches(":hover") || document.activeElement === a) setTimeout(() => { if (enabled() && (a.matches(":hover") || document.activeElement === a)) PBPop.show(a, () => sections(i)); }, OPEN_MS);
    });
    return domain;
  }

  function start(isOn, root = document) {
    enabled = isOn || enabled;
    const on = (e) => { const a = e.target && e.target.closest && e.target.closest("a[href]"); if (a && enabled()) { if (!globalThis.PBSites) theme(); wire(a); } };
    root.addEventListener("pointerover", on, { capture: true, passive: true });
    root.addEventListener("focusin", on, true);
  }

  const cached = (domain) => { const v = cache.get(domain); return v && !(v instanceof Promise) ? v : null; };
  globalThis.PBLinkCard = Object.freeze({ start, siteOfLink, info, cached, sections, theme, openList });

  // On the social sites Daylight Commons reads, cards follow the site switch and the Sources area switch.
  if (globalThis.PBSites && globalThis.PBSettings) start(() => { const s = PBSites.current(), set = PBSettings.get(); return !!s && PB.siteOn(set, s.id) && PB.areaOn(set, "sources"); });
})();
