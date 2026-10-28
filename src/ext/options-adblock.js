// The options page's ad-blocking section: the switch for everywhere (off until the user turns it
// on) and the sites where the user allowed ads, each with a Remove button. adblock-bg.js applies
// both to the browser's blocking engine whenever the settings change.
(async () => {
  "use strict";
  const { el, switchRow } = PBPages;
  const $ = (id) => document.getElementById(id);
  await PBSettings.ready;
  const save = (patch) => PBSettings.save(patch).catch((e) => console.error("[cmmns] could not save settings", e));
  $("adblock").append(switchRow("Block ads and trackers", "Off by default. The toolbar menu can allow ads on the site you are on.", PBSettings.get().adblock, (on) => save({ adblock: on })));

  function list() {
    const hosts = PBSettings.get().adblockAllow;
    $("adblock-allow").replaceChildren(...(hosts.length ? hosts.map((h) => {
      const li = el("li", {}, h + " ");
      const b = el("button", { type: "button", class: "btn" }, "Remove");
      b.addEventListener("click", () => save({ adblockAllow: PB.adblockToggle(PBSettings.get().adblockAllow, h, false) }));
      li.append(b);
      return li;
    }) : [el("li", { class: "hint" }, "None.")]));
  }
  PBSettings.onChange(list);
  list();
})().catch((e) => console.error("[cmmns] ad blocking options failed", e));
