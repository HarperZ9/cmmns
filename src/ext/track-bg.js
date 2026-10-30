// Engagement over time (project-docs/ENGAGEMENT-SERIES.md), in the worker. Keeps the readings the
// pages report (track.js) in track-store.js, and once a day (chrome.alarms) works out which
// readings are due, writes down the ages that were missed, prunes the seen log to its retention and,
// when the reminder is on, shows how many readings are due on the toolbar badge. It fetches nothing:
// the user opens each due post from the collections page.
(() => {
  "use strict";
  const ALARM = "pb-track-due";
  const store = globalThis.PBTrackStore;
  if (!store) { console.error("[cmmns] the engagement series store did not load"); return; }
  let cached = null, timer = 0;
  const settings = () => cached || (cached = chrome.storage.local.get(PB.SETTINGS_KEY).then((g) => PB.normalizeSettings(g[PB.SETTINGS_KEY])));

  // Source-protection mode owns the badge (lifecycle.js shows P), so the count waits until it is off.
  async function badge(now = Date.now()) {
    const s = await settings();
    if (s.protection) return;
    const n = s.trackSeries ? (await store.refresh(now)).count : 0, show = s.trackRemind ? n : 0;
    await chrome.action.setBadgeText({ text: show ? (show > 99 ? "99+" : String(show)) : "" });
    if (show && chrome.action.setBadgeBackgroundColor) await chrome.action.setBadgeBackgroundColor({ color: "#16130f" });
    await chrome.action.setTitle({ title: show ? `CMMNS: ${show} reading${show === 1 ? "" : "s"} due` : "CMMNS" });
  }
  const soon = () => { clearTimeout(timer); timer = setTimeout(() => badge().catch((e) => console.error("[cmmns] could not count due readings", e)), 5000); };

  async function daily() {
    const s = await settings();
    await store.pruneSeen(Date.now(), s.seenDays);
    await badge();
  }

  // One write at a time: two pages reporting the same post at once must not both pass the 6-hour check.
  let chain = Promise.resolve();
  const queued = (job, what) => { chain = chain.then(job).catch((e) => console.error(`[cmmns] ${what}`, e)); return chain; };

  chrome.storage.onChanged.addListener((ch, area) => { if (area === "local" && ch[PB.SETTINGS_KEY]) { cached = null; soon(); } });
  chrome.runtime.onMessage.addListener((msg, sender) => {
    if (!msg || !sender.tab) return;
    if (msg.type === "pb-track-add") queued(async () => { await store.addTracked(msg.meta, await settings()); soon(); }, "could not track the saved post");
    if (msg.type === "pb-track-sightings") queued(async () => { const r = await store.sightings(msg.sightings, await settings()); if (r.readings) soon(); }, "could not keep the readings");
  });
  if (chrome.alarms) {
    chrome.alarms.onAlarm.addListener((a) => { if (a.name === ALARM) daily().catch((e) => console.error("[cmmns] the daily engagement check failed", e)); });
    chrome.alarms.get(ALARM).then((a) => { if (!a) chrome.alarms.create(ALARM, { delayInMinutes: 1, periodInMinutes: 1440 }); })
      .catch((e) => console.error("[cmmns] could not set the daily engagement check", e));
  }
  globalThis.PBTrackBg = Object.freeze({ badge, daily });
})();
