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
  seenLog().catch((e) => console.error("[cmmns] could not read the seen log", e));
  PBSettings.onChange(() => seenLog().catch((e) => console.error("[cmmns] could not read the seen log", e)));
  $("protection").addEventListener("change", () => PBSettings.save({ protection: $("protection").checked }).catch((e) => console.error("[cmmns] could not save source protection", e)));
})().catch((e) => console.error("[cmmns] protection page failed", e));

// With the mode on, the seen-post log writes nothing more. What it already holds stays until the user
// deletes it: protection mode holds features off and deletes nothing by itself, so it offers the
// delete here, in two steps like every delete in CMMNS.
async function seenLog() {
  const $ = (id) => document.getElementById(id), store = globalThis.PBTrackStore;
  const n = store ? (await store.counts()).seen : 0;
  $("seen-box").hidden = !(PBSettings.get().protection && n);
  $("seen-line").textContent = `The seen-post log still holds ${n} entr${n === 1 ? "y" : "ies"} from before. It writes nothing more while protection is on.`;
  const b = $("seen-clear");
  if (b.dataset.wired) return;
  b.dataset.wired = "1";
  let armed = false;
  const disarm = () => { armed = false; b.textContent = "Delete seen log"; b.classList.remove("hot"); };
  b.addEventListener("click", async () => {
    if (!armed) { armed = true; b.textContent = "Click again to delete the seen log"; b.classList.add("hot"); return; }
    try { await store.clearSeen(); $("seen-line").textContent = "The seen log is deleted."; } catch (e) { console.error("[cmmns] could not delete the seen log", e); $("seen-line").textContent = "Could not delete: " + e.message; }
    disarm();
  });
  b.addEventListener("blur", () => { if (armed) disarm(); });
}
