// The collections page, readings due (project-docs/ENGAGEMENT-SERIES.md, Part 2): the saved posts
// that have reached a target age with no reading yet. Next opens the first one in this tab; the
// reading itself is taken by track.js from the page's own data when the post loads. The list shows
// only while the reminder is on, and this page loads nothing by itself.
(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const { el } = PBPages, store = globalThis.PBTrackStore;
  await PBSettings.ready;
  const s = PBSettings.get();
  if (!store || !s.trackSeries || !s.trackRemind) return;
  const where = { x: "X", reddit: "Reddit", youtube: "YouTube" };
  const r = await store.refresh(Date.now());
  $("due-box").hidden = false;
  $("due-line").textContent = r.count ? `${r.count} reading${r.count === 1 ? "" : "s"} due. Next opens the first one here; CMMNS reads its counts when the post loads.` : "No readings are due.";
  $("due-list").replaceChildren(...r.due.slice(0, 50).map((d) => {
    const li = el("li"), a = el("a", { href: d.url }, `${d.handle ? (d.platform === "reddit" ? "u/" : d.platform === "x" ? "@" : "") + d.handle : d.key}, day ${d.day}`);
    li.append(a, document.createTextNode(` on ${where[d.platform] || d.platform}`));
    return li;
  }));
  $("due-next").disabled = !r.count;
  $("due-next").addEventListener("click", () => { if (r.due[0]) location.assign(r.due[0].url); });
})().catch((e) => console.error("[cmmns] the readings due list failed", e));
