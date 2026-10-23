// Options page, feedback section: counts of the user's marks per sign, the opt-in export to a file,
// and clearing the marks. The export is a download the user starts; nothing is sent anywhere.
(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const KEY = PB.FEEDBACK_KEY;
  const read = async () => (await chrome.storage.local.get(KEY))[KEY] || {};
  const name = (fam) => (PB.FAMILIES.find((f) => f.id === fam) || { name: fam }).name;
  $("fbRule").textContent = `After ${PB.CALIBRATION_MIN} marks on one kind of sign, the window shows "Your feedback: N of M right" under that sign's measured figure. It is your own count, shown beside the measured figure.`;

  async function paint() {
    const store = await read();
    const by = PB.buildExport(store).byFamily;
    const fams = Object.keys(by).sort((a, b) => name(a).localeCompare(name(b)));
    const n = fams.reduce((a, f) => a + by[f].right + by[f].wrong, 0);
    $("fbCount").textContent = n ? `${n} mark${n === 1 ? "" : "s"} on ${fams.length} kind${fams.length === 1 ? "" : "s"} of sign.` : "No marks yet.";
    const body = $("fbFamilies");
    body.replaceChildren();
    for (const f of fams) {
      const tr = document.createElement("tr");
      for (const [t, cls] of [[name(f), ""], [String(by[f].right), "mono"], [String(by[f].wrong), "mono"]]) { const td = document.createElement("td"); td.textContent = t; if (cls) td.className = cls; tr.append(td); }
      body.append(tr);
    }
    $("fbExport").disabled = !n;
  }

  $("fbExport").addEventListener("click", async () => {
    try {
      const data = PB.buildExport(await read(), { version: chrome.runtime.getManifest().version });
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1) + "\n"], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url; a.download = `radar-feedback-${data.exported.slice(0, 10)}.json`;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      $("fbStatus").textContent = "Saved to your downloads. Nothing was sent.";
    } catch (e) { console.error("[daylight-commons] feedback export failed", e); $("fbStatus").textContent = "Could not save: " + e.message; }
  });

  // Two steps, as with clearing all data.
  let armed = false;
  const b = $("fbClear");
  const disarm = () => { armed = false; b.textContent = "Clear feedback"; b.classList.remove("hot"); };
  b.addEventListener("click", async () => {
    if (!armed) { armed = true; b.textContent = "Click again to delete your marks"; b.classList.add("hot"); return; }
    try { await chrome.storage.local.remove(KEY); $("fbStatus").textContent = "Your marks are deleted."; } catch (e) { console.error("[daylight-commons] could not clear feedback", e); $("fbStatus").textContent = "Could not clear: " + e.message; }
    disarm(); paint();
  });
  b.addEventListener("blur", () => { if (armed) disarm(); });
  chrome.storage.onChanged.addListener((ch, area) => { if (area === "local" && ch[KEY]) paint(); });
  await paint();
})().catch((e) => console.error("[daylight-commons] feedback options failed", e));
