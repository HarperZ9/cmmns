// The site card for the page being read. Injected only when the user presses "Site card for this
// page" in Radar's toolbar popup (src/ext/sources-bg.js); Radar runs on no news site by default.
// The card shows the site's owner, owner type, founding date, country, state links and fact-check
// record from Radar's bundled tables. "Other coverage" is the one part that can send anything, and
// only when the user turned it on, read what it sends, and clicks.
(() => {
  "use strict";
  const el = PBPop.el;
  const domain = PB.hostOf(location.href);
  const meta = (p) => { const m = document.querySelector(`meta[property="${p}"], meta[name="${p}"]`); return m && m.content ? m.content.trim() : null; };
  const title = () => meta("og:title") || meta("twitter:title") || document.title || "";
  let anchor = document.getElementById("pb-sitepage-anchor");
  if (!anchor) {
    anchor = el("div");
    anchor.id = "pb-sitepage-anchor";
    anchor.style.cssText = "position:fixed;top:12px;right:12px;width:1px;height:1px;pointer-events:none;";
    document.documentElement.append(anchor);
  }

  const send = (msg) => chrome.runtime.sendMessage(msg);
  const save = (patch) => PBSettings.save(patch).catch((e) => console.error("[radar] could not save settings", e));

  function open(sections) {
    PBPop.close(true);
    const p = PBPop.show(anchor, sections);
    if (p) p.focus({ preventScroll: true });   // focus pins the window until Escape or a click outside
  }

  // The Other coverage section, in the state the user's settings put it in.
  function coverageSection(info, state) {
    const s = PBSettings.get(), rows = [];
    if (state && state.list) {
      if (!state.list.length) rows.push([null, { note: `GDELT found no other outlets for "${state.query}" in the last week.` }]);
      for (const g of state.groups) rows.push([g.type, state.list.filter((x) => x.type === g.type).map((x) => `${x.name || x.site}${x.country ? ` (${x.country})` : ""}`).join(", ")]);
      for (const x of state.list.slice(0, 12)) rows.push([x.type, { links: [[`${x.site}: ${x.title || "article"}`.slice(0, 90), x.url]] }]);
      rows.push(["Sent", `"${state.query}" to api.gdeltproject.org, ${state.ms} ms`], ["Does not prove", PB.COVERAGE_DOES_NOT_PROVE]);
    } else if (state && state.error) {
      rows.push([null, { note: state.error === "short-title" ? "The title has too few words to search for." : state.error === "no-permission" ? "The browser has not granted access to api.gdeltproject.org. Turn Other coverage on again in Radar's options." : /^Please limit/.test(state.detail || "") ? "GDELT is busy and did not answer. Try again in a minute." : "GDELT did not answer with a list. Try again later." }]);
    } else if (!s.coverage) {
      rows.push([null, { note: "Other coverage is off. Radar's options explain what it sends and to whom before you turn it on." }]);
      rows.push([null, { action: ["Open Radar's options", () => send({ type: "pb-open-options" }), "Opened"] }]);
    } else if (!s.coverageConsent) {
      rows.push([null, { note: PB.COVERAGE_PRIVACY }], ["Would send", `"${PB.coverageTerms(title()) || "(title too short)"}"`]);
      rows.push([null, { action: ["Send these words to GDELT", () => save({ coverageConsent: true }).then(() => run(info)), "Asking GDELT…"] }]);
    } else {
      rows.push(["Will send", `"${PB.coverageTerms(title()) || "(title too short)"}" to api.gdeltproject.org`]);
      rows.push([null, { action: ["Find other coverage", () => run(info), "Asking GDELT…"] }]);
    }
    return { tab: "overview", title: "Other coverage", rows, foot: "Outlets are labelled by owner type as Wikidata and Radar's cited state tables state it. Radar gives no left or right score." };
  }

  async function run(info) {
    let state;
    try { state = await send({ type: "pb-coverage", title: title(), domain }); } catch (e) { state = { error: "gdelt", detail: String(e.message || e) }; }
    open(PBLinkCard.sections(info, [coverageSection(info, state || { error: "gdelt" })]));
  }

  async function show() {
    await PBSettings.ready;
    PBLinkCard.theme();
    let info;
    try { info = (await send({ type: "pb-sites", domains: [domain] }))[domain]; } catch (e) { console.error("[radar] site lookup failed", e); }
    info = info || { domain, owner: null, state: [], facts: null, record: null };
    open(PBLinkCard.sections(info, [coverageSection(info, null)]));
  }

  globalThis.PBSitePage = Object.freeze({ show });
  show().catch((e) => console.error("[radar] site card failed", e));
})();
