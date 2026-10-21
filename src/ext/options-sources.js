// Options for site context: search-result cards per engine, and the opt-in Other coverage lookup.
// Each switch asks the browser for the access it needs at the moment the user turns it on, next to
// the text that says what it reads or sends. Turning a switch off gives the access back.
(async () => {
  "use strict";
  const { switchRow } = PBPages;
  const $ = (id) => document.getElementById(id);
  await PBSettings.ready;
  const s = () => PBSettings.get();
  const save = (patch) => PBSettings.save(patch).catch((e) => console.error("[radar] could not save settings", e));
  const firefox = typeof globalThis.browser !== "undefined";

  // Called from the switch's change event, so the browser sees a user gesture.
  function grant(on, input, perms, patch, status) {
    if (!on) { chrome.permissions.remove(perms).catch(() => {}); save(patch(false)); if (status) status(""); return; }
    chrome.permissions.request(perms).then((ok) => {
      if (!ok) { input.checked = false; if (status) status("The browser did not grant access, so this stays off."); return; }
      save(patch(true)); if (status) status("");
    }).catch((e) => { console.error("[radar] permission request failed", e); input.checked = false; if (status) status("Could not ask the browser: " + e.message); });
  }

  for (const [id, name, , origin] of PB.SEARCH_ENGINES) {
    $("search").append(switchRow(name, `Labels under ${name} results. Needs access to ${origin.replace(/\/\*$/, "")}.`, PB.searchOn({ ...s(), paused: false }, id), (on, input) =>
      grant(on, input, { origins: [origin] }, (v) => ({ search: { ...s().search, [id]: v } }))));
  }

  $("coverageText").textContent = PB.COVERAGE_PRIVACY;
  const say = (t) => { $("coverageStatus").textContent = t; };
  // Firefox asks the user to allow the data type too ("website content": the title's words).
  const perms = { origins: [PB.COVERAGE_ORIGIN], ...(firefox ? { data_collection: ["websiteContent"] } : {}) };
  $("coverage").append(switchRow("Find other coverage on click", "Sends the main words of an article's title to api.gdeltproject.org, only when you click, on a page where you opened Radar's site card.", s().coverage, (on, input) =>
    grant(on, input, perms, (v) => ({ coverage: v, coverageConsent: false }), say)));
})().catch((e) => console.error("[radar] site options failed", e));
