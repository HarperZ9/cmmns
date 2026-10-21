// Toolbar popup: what Radar sees on the current page, the main actions, pause and two settings.
(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  await PBSettings.ready;
  for (const k of ["paused", "feeds", "auto"]) {
    $(k).checked = PBSettings.get()[k];
    $(k).addEventListener("change", () => PBSettings.save({ [k]: $(k).checked }).catch((e) => console.error("[radar] could not save settings", e)));
  }
  $("options").addEventListener("click", () => { chrome.runtime.openOptionsPage(); window.close(); });

  $("dashboard").addEventListener("click", () => { chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") }); window.close(); });
  document.getElementById("history").addEventListener("click", () => { chrome.tabs.create({ url: chrome.runtime.getURL("history.html") }); window.close(); });
  document.getElementById("transparency").addEventListener("click", () => { chrome.tabs.create({ url: chrome.runtime.getURL("transparency.html") }); window.close(); });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const send = (msg) => (tab && tab.id != null ? chrome.tabs.sendMessage(tab.id, msg).catch(() => null) : Promise.resolve(null));
  const s = await send({ type: "pb-summary" });
  const buttons = ["scan", "panel", "export"];
  if (!s) { buttons.forEach((b) => ($(b).disabled = true)); await PBServer.offer(tab); return; }

  $("site").textContent = s.site + (s.feed ? " feed" : " thread");
  $("sentence").textContent = s.sentence || (s.feed ? "Rest the pointer on any post to see what Radar knows about it." : "Reading the thread…");
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
  $("scan").disabled = !s.pending || !!s.scanning;
  $("scan").textContent = s.pending ? `Read ${Math.min(s.pending, 200)} more accounts` : "All accounts read";
  $("panel").disabled = !!s.feed;
  $("export").disabled = !!s.feed;
  $("scan").addEventListener("click", () => { send({ type: "pb-scan" }); window.close(); });
  $("panel").addEventListener("click", () => { send({ type: "pb-panel" }); window.close(); });
  $("export").addEventListener("click", () => { send({ type: "pb-export" }); window.close(); });
})().catch((e) => console.error("[radar] popup failed", e));
