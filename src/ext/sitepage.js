// The site card for the page being read. Injected only when the user presses "Site card for this
// page" in Daylight Commons' toolbar popup (src/ext/sources-bg.js); Daylight Commons runs on no news site by default.
// The card shows the site's owner, owner type, founding date, country, state links and fact-check
// record from Daylight Commons' bundled tables. "Other coverage" is the one part that makes a request: to the
// feeds of the outlets the user chose, only after the user turned it on, read which hosts it asks,
// and clicked. On sites Daylight Commons has no reader for, the card adds text checks from the generic reader.
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
  const save = (patch) => PBSettings.save(patch).catch((e) => console.error("[daylight-commons] could not save settings", e));

  function open(sections) {
    PBPop.close(true);
    const p = PBPop.show(anchor, sections);
    if (p) p.focus({ preventScroll: true });   // focus pins the window until Escape or a click outside
  }

  // The Other coverage section, in the state the user's settings put it in.
  const hostsLine = (hosts) => (hosts.length ? hosts.join(", ") : "none");
  function results(state, rows) {
    if (!state.list.length) rows.push([null, { note: `None of the ${state.status.length} feeds asked has a headline sharing enough words with this one.` }]);
    for (const g of state.groups) rows.push([g.type, state.list.filter((x) => x.type === g.type).map((x) => `${x.outlet}${x.owner ? `, owned by ${x.owner}` : ""}${x.country ? ` (${x.country})` : ""}`).join("; ")]);
    for (const x of state.list.slice(0, 12)) rows.push([x.type, { links: [[`${x.outlet}: ${x.title}`.slice(0, 90), x.url]] }], ["Shared words", x.shared.join(", ")]);
    for (const f of state.status.filter((f) => f.state !== "ok")) rows.push([f.name, f.state === "empty" ? "The feed had no entries." : PB.FEED_ERRORS[f.state] || f.state]);
    rows.push(["Asked", `${state.hosts.length} feed host${state.hosts.length === 1 ? "" : "s"}, nothing from this page sent, ${state.ms} ms`], ["Does not prove", PB.COVERAGE_DOES_NOT_PROVE]);
  }
  const ERR = { "short-title": "The title has too few words to match.", "no-outlets": "No outlets are chosen. Choose them in Daylight Commons' options.", off: "Other coverage is off." };
  function coverageSection(info, state) {
    const s = PBSettings.get(), rows = [], hosts = PB.coveragePlan(PB.chosenFeeds(s));
    const options = [null, { action: ["Open Daylight Commons' options", () => send({ type: "pb-open-options" }), "Opened"] }];
    if (state && state.list) results(state, rows);
    else if (state && state.error) rows.push([null, { note: ERR[state.error] || "The lookup failed. Try again later." }]);
    else if (!s.coverage) rows.push([null, { note: "Other coverage is off. Daylight Commons' options explain what it requests and from whom before you turn it on." }], options);
    else if (!hosts.length) rows.push([null, { note: "Other coverage is on, but no outlets are chosen yet." }], options);
    else if (!s.feedConsent) {
      rows.push([null, { note: PB.COVERAGE_PRIVACY }], ["Would ask", hostsLine(hosts)]);
      rows.push([null, { action: ["Ask these outlets", () => save({ feedConsent: true }).then(() => run(info)), "Asking the feeds…"] }]);
    } else {
      rows.push(["Will ask", hostsLine(hosts)]);
      rows.push([null, { action: ["Find other coverage", () => run(info), "Asking the feeds…"] }]);
    }
    return { tab: "overview", title: "Other coverage", rows, foot: "Outlets are labelled by owner and owner type as Wikidata and Daylight Commons' cited state tables state them. Daylight Commons gives no left or right score." };
  }

  // On a site Daylight Commons has no reader for, the generic reader's text checks (src/ext/generic-page.js).
  const extra = (info, state) => [coverageSection(info, state), ...(globalThis.PBGenericPage && !(globalThis.PBSites && PBSites.current()) ? [PBGenericPage.section()].filter(Boolean) : [])];

  async function run(info) {
    let state;
    try { state = await send({ type: "pb-coverage", title: title(), domain }); } catch (e) { state = { error: "failed", detail: String(e.message || e) }; }
    open(PBLinkCard.sections(info, extra(info, state || { error: "failed" })));
  }

  async function show() {
    await PBSettings.ready;
    PBLinkCard.theme();
    let info;
    try { info = (await send({ type: "pb-sites", domains: [domain] }))[domain]; } catch (e) { console.error("[daylight-commons] site lookup failed", e); }
    info = info || { domain, owner: null, state: [], facts: null, record: null };
    open(PBLinkCard.sections(info, extra(info, null)));
  }

  globalThis.PBSitePage = Object.freeze({ show });
  show().catch((e) => console.error("[daylight-commons] site card failed", e));
})();
