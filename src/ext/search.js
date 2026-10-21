// Site labels on search results. Runs only on the engines the user turned on in the options page
// (registered by src/ext/sources-bg.js after the browser grants access). Each result link gets a
// short line of labels from Radar's bundled tables, such as the owner and any state link, and the
// full site card on hover. Nothing is sent anywhere: lookups go to Radar's background worker.
(() => {
  "use strict";
  if (globalThis.PBSearch) return;
  const ENGINES = {
    google: { host: /(^|\.)google\.[a-z.]+$/, links: "#rso a:has(> h3), #search a:has(> h3)", engine: "google" },
    bing: { host: /(^|\.)bing\.com$/, links: "#b_results li.b_algo h2 a", engine: "bing" },
    duckduckgo: { host: /(^|\.)duckduckgo\.com$/, links: 'a[data-testid="result-title-a"], article h2 a[href^="http"]', engine: "duckduckgo" },
  };
  const E = Object.values(ENGINES).find((e) => e.host.test(location.hostname));
  if (!E) return;
  const on = () => PB.searchOn(PBSettings.get(), E.engine);

  async function label() {
    if (!on()) { document.querySelectorAll(".pb-site-line").forEach((n) => n.remove()); return; }
    const links = [...document.querySelectorAll(E.links)].filter((a) => !a.__pbLabelled);
    for (const a of links) {
      a.__pbLabelled = true;
      const domain = PBLinkCard.siteOfLink(a);
      if (!domain) continue;
      PBLinkCard.info(domain).then((i) => {
        const chips = PB.siteChips(i);
        if (!chips.length || !a.isConnected) return;
        const line = document.createElement("div");
        line.className = "pb-site-line";
        line.textContent = "Radar: " + chips.join(" · ");
        line.tabIndex = 0;
        line.setAttribute("role", "note");
        const block = a.closest("h2, h3") || a;
        (block.parentElement === a ? a : block).after(line);
        PBPop.hover(line, () => (on() ? PBLinkCard.sections(i) : null));
      });
    }
  }

  let timer = 0;
  const schedule = () => { clearTimeout(timer); timer = setTimeout(label, 250); };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  PBSettings.onChange(schedule);
  PBSettings.ready.then(() => { PBLinkCard.theme(); PBLinkCard.start(on); label(); });
  globalThis.PBSearch = Object.freeze({ label });
})();
