// Toolbar popup: what Daylight Commons sees on the current page, the main actions, pause and two settings.
(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  await PBSettings.ready;
  for (const k of ["paused", "feeds", "auto"]) {
    $(k).checked = PBSettings.get()[k];
    $(k).addEventListener("change", () => PBSettings.save({ [k]: $(k).checked }).catch((e) => console.error("[daylight-commons] could not save settings", e)));
  }
  // How old the catalogue is: always shown, calm wording, never an alarm (src/ext/freshness.js).
  PBFreshness.ready.then((v) => { if (v) $("freshness").textContent = `Catalogue: ${v.label}. ${v.line}`; });
  $("options").addEventListener("click", () => { chrome.runtime.openOptionsPage(); window.close(); });

  $("dashboard").addEventListener("click", () => { chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") }); window.close(); });
  document.getElementById("history").addEventListener("click", () => { chrome.tabs.create({ url: chrome.runtime.getURL("history.html") }); window.close(); });
  document.getElementById("analyze").addEventListener("click", () => { chrome.tabs.create({ url: chrome.runtime.getURL("analyze.html") }); window.close(); });
  document.getElementById("transparency").addEventListener("click", () => { chrome.tabs.create({ url: chrome.runtime.getURL("transparency.html") }); window.close(); });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  // Source protection (protection.html) and "What Daylight shows about you" (selfaudit.html, which
  // reads this tab only when it is your own profile).
  const protectedMode = PBSettings.get().protection;
  $("protection-on").hidden = !protectedMode;
  $("protect").addEventListener("click", () => { chrome.tabs.create({ url: chrome.runtime.getURL("protection.html") }); window.close(); });
  $("selfaudit").addEventListener("click", () => { chrome.tabs.create({ url: chrome.runtime.getURL(`selfaudit.html${tab && tab.id != null ? `?tab=${tab.id}` : ""}`) }); window.close(); });
  // Add to case (src/ext/case-inbox.js): this tab's address and title, kept in this browser only.
  const caseCount = (n) => { $("case-save").textContent = n ? `Save case list (${n})` : "Save case list"; $("case-save").disabled = !n; };
  $("case-add").disabled = !PBCaseInbox.row(tab);
  PBCaseInbox.load().then((l) => caseCount(l.length)).catch((e) => console.error("[daylight-commons] could not read the case list", e));
  $("case-add").addEventListener("click", () => PBCaseInbox.add(tab).then((l) => { caseCount(l.length); $("case-add").textContent = "Added to case"; $("case-add").disabled = true; })
    .catch((e) => console.error("[daylight-commons] could not add to the case list", e)));
  // Save media (src/ext/media-bg.js): this click lets Daylight Commons read this tab once.
  $("media-save").disabled = !(tab && /^https?:/.test(tab.url || ""));
  $("media-save").addEventListener("click", () => chrome.runtime.sendMessage({ type: "pb-media-scan", tab }).then(() => window.close()).catch((e) => console.error("[daylight-commons] could not read the page's media", e)));
  for (const page of ["collections", "convert"]) $(page).addEventListener("click", () => { chrome.tabs.create({ url: chrome.runtime.getURL(page + ".html") }); window.close(); });
  PBAdblockPopup.wire(tab);
  $("case-save").addEventListener("click", () => PBCaseInbox.load().then((l) => PBCaseInbox.save(l)).catch((e) => console.error("[daylight-commons] could not save the case list", e)));
  const send = (msg) => (tab && tab.id != null ? chrome.tabs.sendMessage(tab.id, msg).catch(() => null) : Promise.resolve(null));
  // The site card for the page being read: injected into this tab only, only on this click.
  const web = tab && /^https?:\/\//.test(tab.url || "") || (tab && !tab.url);
  $("sitecard").disabled = !web;
  $("sitecard").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "pb-site-page", tabId: tab.id }).then((r) => { if (r && r.error) console.error("[daylight-commons] site card failed", r.error); window.close(); })
      .catch((e) => console.error("[daylight-commons] site card failed", e));
  });
  // Adapter health on demand (src/ext/health.js): counts what Daylight Commons' reader finds here now.
  $("selftest-run").disabled = !web;
  $("selftest-run").addEventListener("click", async () => {
    const box = $("selftest");
    box.replaceChildren();
    for (const [k, v] of PB.selfTestLines(await send({ type: "pb-selftest" }))) {
      const dt = document.createElement("dt"); dt.textContent = k;
      const dd = document.createElement("dd"); dd.textContent = v;
      box.append(dt, dd);
    }
    box.hidden = false;
  });
  const s = await send({ type: "pb-summary" });
  const buttons = ["scan", "panel", "export"];
  if (!s) { buttons.forEach((b) => ($(b).disabled = true)); await PBServer.offer(tab); return; }

  $("site").textContent = s.site + (s.feed ? " feed" : " thread");
  $("sentence").textContent = s.sentence || (s.feed ? "Rest the pointer on any post to see what Daylight Commons knows about it." : "Reading the thread…");
  const facts = [
    ["Posts on screen", s.posts],
    ["Accounts read", `${s.lookedUp} of ${s.lookedUp + s.pending}`],
    ["Flagged accounts", s.flagged, s.flagged > 0],
    ["Coordination signs", s.signs, s.signs > 0],
    ["Top origins", (s.origins || []).slice(0, 3).map((o) => `${o.place} ${o.n}`).join(", ") || "none read yet"],
    s.scanning ? ["Reading now", `${s.scanning} left`] : null,
  ].filter((f) => f && f[1] != null);
  for (const [k, v, hot] of facts) {
    const dt = document.createElement("dt"); dt.textContent = k;
    const dd = document.createElement("dd"); dd.textContent = String(v); if (hot) dd.className = "hot";
    $("facts").append(dt, dd);
  }
  $("scan").disabled = !s.pending || !!s.scanning || protectedMode;
  $("scan").textContent = s.pending ? `Read ${Math.min(s.pending, 200)} more accounts` : "All accounts read";
  $("panel").disabled = !!s.feed;
  $("export").disabled = !!s.feed;
  $("scan").addEventListener("click", () => { send({ type: "pb-scan" }); window.close(); });
  $("panel").addEventListener("click", () => { send({ type: "pb-panel" }); window.close(); });
  $("export").addEventListener("click", () => { send({ type: "pb-export" }); window.close(); });
})().catch((e) => console.error("[daylight-commons] popup failed", e));
