// Options for site context: search-result cards per engine, and the opt-in Other coverage lookup.
// Each switch asks the browser for the access it needs at the moment the user turns it on, next to
// the text that says what it reads or requests. Turning a switch off gives the access back. Other
// coverage asks for one feed host per outlet the user chooses, never for all sites.
(async () => {
  "use strict";
  const { switchRow } = PBPages;
  const $ = (id) => document.getElementById(id);
  await PBSettings.ready;
  const s = () => PBSettings.get();
  const save = (patch) => PBSettings.save(patch).catch((e) => console.error("[cmmns] could not save settings", e));
  const say = (t) => { $("coverageStatus").textContent = t; };
  const asked = (e) => { console.error("[cmmns] permission request failed", e); say("Could not ask the browser: " + e.message); return false; };

  // Called from a change or click event, so the browser sees a user gesture.
  function grant(on, input, perms, patch, status) {
    if (!on) { chrome.permissions.remove(perms).catch(() => {}); save(patch(false)); if (status) status(""); return; }
    chrome.permissions.request(perms).then((ok) => {
      if (!ok) { input.checked = false; if (status) status("This needs the browser's access. Turn it on again and choose Allow."); return; }
      save(patch(true)); if (status) status("");
    }).catch((e) => { asked(e); input.checked = false; });
  }

  for (const [id, name, , origin] of PB.SEARCH_ENGINES) {
    $("search").append(switchRow(name, `Labels under ${name} results. Needs access to ${origin.replace(/\/\*$/, "")}.`, PB.searchOn({ ...s(), paused: false }, id), (on, input) =>
      grant(on, input, { origins: [origin] }, (v) => ({ search: { ...s().search, [id]: v } }))));
  }

  // A feed host's access goes back only when no other chosen feed still uses it.
  function release(settings, url) {
    const origin = PB.feedOrigin(url);
    if (origin && !PB.feedOrigins(PB.chosenFeeds(settings)).includes(origin)) chrome.permissions.remove({ origins: [origin] }).catch(() => {});
  }

  // What the bundled tables say about each suggested outlet, for its hint line.
  const outletInfo = chrome.runtime.sendMessage({ type: "pb-sites", domains: PB.FEED_OUTLETS.map((o) => o[3]) }).catch(() => ({}));
  async function outlets() {
    const info = (await outletInfo) || {};
    const box = $("outlets");
    box.replaceChildren();
    for (const [id, name, url, site, country] of PB.FEED_OUTLETS) {
      const i = info[site] || {}, owner = i.owner && i.owner.owner;
      const hint = `${country}. ${owner ? "Owned by " + owner + ". " : ""}Owner type: ${PB.ownerType(i)}. Feed: ${new URL(url).hostname}.`;
      box.append(switchRow(name, hint, s().outlets[id] === true, (on, input) => {
        if (!on) { const next = { ...s(), outlets: { ...s().outlets, [id]: false } }; save({ outlets: next.outlets }); release(next, url); return; }
        grant(true, input, { origins: [PB.feedOrigin(url)] }, () => ({ outlets: { ...s().outlets, [id]: true }, feedConsent: false }), say);
      }));
    }
  }

  function custom() {
    const ul = $("custom");
    ul.replaceChildren();
    if (!s().customFeeds.length) { ul.append(PBPages.el("li", { class: "hint" }, "None yet.")); return; }
    for (const url of s().customFeeds) {
      const li = PBPages.el("li", {}, url + " ");
      const b = PBPages.el("button", { type: "button", class: "btn" }, "Remove");
      b.addEventListener("click", async () => { const next = { ...s(), customFeeds: s().customFeeds.filter((u) => u !== url) }; await save({ customFeeds: next.customFeeds }); release(next, url); custom(); });
      li.append(b);
      ul.append(li);
    }
  }

  $("customAdd").addEventListener("click", () => {
    const url = PB.cleanFeedUrl($("customUrl").value);
    if (!url) { say("Enter an https feed address, such as https://example.org/feed.xml."); return; }
    if (s().customFeeds.includes(url)) { say("That feed is already on the list."); return; }
    if (s().customFeeds.length >= PB.MAX_CUSTOM_FEEDS) { say(`CMMNS keeps at most ${PB.MAX_CUSTOM_FEEDS} of your own feeds.`); return; }
    chrome.permissions.request({ origins: [PB.feedOrigin(url)] }).then(async (ok) => {
      if (!ok) { say("The feed needs the browser's access to its host. Add it again and choose Allow."); return; }
      await save({ customFeeds: [...s().customFeeds, url], feedConsent: false });
      $("customUrl").value = ""; say(""); custom();
    }, asked);
  });

  $("outletsAll").addEventListener("click", () => {
    const origins = PB.feedOrigins(PB.FEED_OUTLETS.map((o) => ({ url: o[2] })));
    chrome.permissions.request({ origins }).then(async (ok) => {
      if (!ok) { say("The outlets need the browser's access to their hosts. Press the button again and choose Allow."); return; }
      await save({ outlets: Object.fromEntries(PB.FEED_OUTLETS.map((o) => [o[0], true])), feedConsent: false });
      say(""); outlets();
    }, asked);
  });

  // Turning Other coverage off takes back every feed host and forgets the choices.
  function switched(on) {
    if (on) { save({ coverage: true, feedConsent: false }).then(show); return; }
    const origins = PB.feedOrigins(PB.chosenFeeds(s()));
    if (origins.length) chrome.permissions.remove({ origins }).catch(() => {});
    save({ coverage: false, feedConsent: false, outlets: {}, customFeeds: [] }).then(show);
  }
  function show() { $("feeds").hidden = !s().coverage; if (s().coverage) { outlets(); custom(); } }

  $("coverageText").textContent = PB.COVERAGE_PRIVACY;
  $("outletsText").textContent = `Suggested outlets publish their own feed on their own host, have an owner on record in CMMNS' tables, and together span several countries, owner types and editorial positions. Each one starts off, and you choose which to use. Feeds checked ${PB.OUTLETS_CHECKED}.`;
  $("coverage").append(switchRow("Find other coverage on click", "When you click on a page where you opened the site card, CMMNS downloads the public feeds of the outlets you choose. Each request is a plain download of the feed address.", s().coverage, (on) => switched(on)));
  show();
})().catch((e) => console.error("[cmmns] site options failed", e));
