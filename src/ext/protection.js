// The source-protection page (protection.html): the one switch, its state, and the screen of what
// it cannot protect against, which the popup opens the first time the mode is turned on.
(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  await PBSettings.ready;
  const show = (s) => {
    $("protection").checked = s.protection;
    $("state").textContent = s.protection ? "Source protection is on. CMMNS makes no request, and the toolbar button shows a P." : "Source protection is off.";
  };
  show(PBSettings.get());
  PBSettings.onChange(show);
  $("protection").addEventListener("change", () => PBSettings.save({ protection: $("protection").checked }).catch((e) => console.error("[cmmns] could not save source protection", e)));
})().catch((e) => console.error("[cmmns] protection page failed", e));
