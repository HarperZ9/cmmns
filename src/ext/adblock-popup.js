// The toolbar popup's ad-blocking switches: one for everywhere (off until the user turns it on)
// and one to allow ads on the site of the current tab. Both are settings (src/core/settings.js);
// adblock-bg.js applies them to the browser's blocking engine.
globalThis.PBAdblockPopup = (() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const save = (patch) => PBSettings.save(patch).catch((e) => console.error("[cmmns] could not save settings", e));

  function wire(tab) {
    const s = PBSettings.get(), site = PB.adblockSite(tab && tab.url);
    $("adblock").checked = s.adblock;
    $("adblock").addEventListener("change", () => { save({ adblock: $("adblock").checked }); $("adblock-site").disabled = !$("adblock").checked || !site; });
    $("adblock-site").disabled = !s.adblock || !site;
    $("adblock-site").checked = !!site && PB.adblockAllowed(s.adblockAllow, site);
    $("adblock-site-text").textContent = site ? `Allow ads on ${site}` : "Allow ads on this site";
    $("adblock-site").addEventListener("change", () => save({ adblockAllow: PB.adblockToggle(PBSettings.get().adblockAllow, site, $("adblock-site").checked) }));
  }

  return Object.freeze({ wire });
})();
