// Options page, engagement over time (project-docs/ENGAGEMENT-SERIES.md): the three switches, the
// seen log's retention, what is kept, the export and the two deletes. The export is a download the
// user starts, into the save folder; nothing is sent anywhere.
(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const { switchRow } = PBPages, store = globalThis.PBTrackStore;
  await PBSettings.ready;
  const save = (patch) => PBSettings.save(patch).catch((e) => console.error("[cmmns] could not save settings", e));
  const s = PBSettings.get(), status = (t) => { $("seriesStatus").textContent = t; };
  $("series").append(
    switchRow("Re-read posts you save", "On by default. Keeps, for each post you save, its id, the author's handle, when it was posted and saved, and the counts the page's own data shows whenever you load it again. Nothing is sent.", s.trackSeries, (on) => save({ trackSeries: on })),
    switchRow("Remind me of due readings", "Off by default. Once a day CMMNS counts the saved posts that have reached 1, 3, 7, 14, 30 or 90 days and shows the number on its toolbar button. The collections page lists them, and Next opens one. It keeps nothing more. Nothing is sent.", s.trackRemind, (on) => save({ trackRemind: on })),
    seenSwitch(s));
  // Source protection holds the seen log off (PB.PROTECTION_FORCES): the switch shows it, locked, and says why.
  function seenSwitch(now) {
    const row = switchRow("Log every post the page loads", "Off by default. Keeps, for every post X, Reddit or YouTube loads for you: its id, the author's handle, its times and counts, its hashtags and link domains, and a hash of each media address. No post text and no pictures. Kept for the days below. Nothing is sent.", now.seenLog, (on) => save({ seenLog: on }));
    if (now.protection) {
      const box = row.querySelector("input");
      box.checked = false; box.disabled = true;
      row.querySelector(".hint").append(" Locked off while source protection is on: a log of every post you were shown would tell anyone holding this device what you read.");
    }
    return row;
  }
  const days = $("seenDays");
  days.min = PB.RETENTION.seenDays.min; days.max = PB.RETENTION.seenDays.max; days.value = s.seenDays;
  days.addEventListener("change", () => save({ seenDays: days.value }).then((n) => { if (n) days.value = n.seenDays; }));

  async function paint() {
    if (!store) { $("seriesCount").textContent = "This browser has no storage for the series."; return; }
    const c = await store.counts();
    $("seriesCount").textContent = `${c.posts} saved post${c.posts === 1 ? "" : "s"} tracked, ${c.readings} reading${c.readings === 1 ? "" : "s"}, ${c.seen} seen-log entr${c.seen === 1 ? "y" : "ies"}.`;
    $("seriesExport").disabled = !c.readings && !c.seen;
  }

  // One file through the downloads permission, into "<save folder>/engagement/".
  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const filename = PB.savePath(PBSettings.get(), "engagement") + name;
    return chrome.downloads.download({ url, filename, conflictAction: "uniquify", saveAs: false }).finally(() => setTimeout(() => URL.revokeObjectURL(url), 60000));
  }
  $("seriesExport").addEventListener("click", async () => {
    try {
      const out = await store.exportSeries(Date.now(), chrome.runtime.getManifest().version);
      await download(out.names.readings, out.jsonl, "application/x-ndjson");
      if (out.seenJsonl) await download(out.names.seen, out.seenJsonl, "application/x-ndjson");
      await download(out.names.manifest, JSON.stringify(out.manifest, null, 1) + "\n", "application/json");
      status(`Saved ${out.manifest.readings} readings with a manifest and its SHA-256 to your downloads. Nothing was sent.`);
    } catch (e) { console.error("[cmmns] engagement export failed", e); status("Could not export: " + e.message); }
  });

  // Two steps each, as with clearing all data.
  function twoStep(id, label, ask, run, done) {
    const b = $(id);
    let armed = false;
    const disarm = () => { armed = false; b.textContent = label; b.classList.remove("hot"); };
    b.addEventListener("click", async () => {
      if (!armed) { armed = true; b.textContent = ask; b.classList.add("hot"); return; }
      try { await run(); status(done); } catch (e) { console.error("[cmmns] could not delete", e); status("Could not delete: " + e.message); }
      disarm(); paint();
    });
    b.addEventListener("blur", () => { if (armed) disarm(); });
  }
  twoStep("seriesClear", "Delete engagement series", "Click again to delete every tracked post and reading", () => store.clearSeries(), "The engagement series is deleted.");
  twoStep("seenClear", "Delete seen log", "Click again to delete the seen log", () => store.clearSeen(), "The seen log is deleted.");
  await paint();
})().catch((e) => console.error("[cmmns] engagement options failed", e));
