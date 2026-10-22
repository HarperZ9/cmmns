// The offline analyser: the user chooses a file, Daylight Commons reads it on this device with radar-core
// (src/core/api.js and src/core/imports.js) and shows the evidence. A signed bundle of it can be
// saved, and any bundle can be checked. No request leaves the browser: the data tables come from
// Daylight Commons' own package and the file never leaves the page.
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const MEDIA = /\.(jpe?g|png|webp|gif|heic|heif|avif|tiff?|mp4|mov|m4v|webm)$/i;
  let last = null;   // { result, imp } for the bundle

  const say = (t) => { $("status").textContent = t; };

  async function analyse(file) {
    say(`Reading ${file.name}…`);
    $("result").hidden = true; $("bundle").hidden = true; last = null;
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (MEDIA.test(file.name) || /^(image|video)\//.test(file.type)) {
      const result = await PB.checkMedia(bytes);
      PBAnalyzeView.show(document, result, [`Read ${file.name} as a media file.`]);
      say("");
      return;
    }
    const imp = PB.importFile(file.name, bytes);
    if (!imp.ok) { say(imp.reason); return; }
    say("Loading Daylight Commons' tables…");
    await PBSign.loadTables();
    const result = imp.source === "page" ? PB.analyzeText(imp.input.replies[0].text, { id: "page", links: imp.input.replies[0].links }) : PB.analyzeThread(imp.input);
    PBAnalyzeView.show(document, result, [`Read as ${imp.format}${imp.site ? ` from ${imp.site}` : ""}.`, ...imp.notes]);
    last = { result, imp };
    $("bundle").hidden = false; $("saved").textContent = "";
    say("");
  }

  function texts(imp) {
    const out = {};
    [imp.input.root, ...imp.input.replies].filter(Boolean).forEach((p, i) => { out[p.id != null ? String(p.id) : "p" + i] = p.text; });
    return out;
  }

  async function saveBundle() {
    if (!last) return;
    const { result, imp } = last;
    const built = PB.makeBundle(result, { tool: PBSign.tool(), dataLock: await PBSign.dataLock(), source: imp.source === "export" ? "export" : "thread", includeText: $("text").checked, texts: texts(imp) });
    if (!built.ok) { $("saved").textContent = built.reason; return; }
    const signed = await PBSign.sign(built.bundle);
    const name = `radar-bundle-${(result.site || imp.format).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${signed.signature.value.slice(0, 10)}.json`;
    PBSign.download(name, JSON.stringify(signed, null, 2) + "\n");
    showKey();
    $("saved").textContent = `Saved ${name}${signed.textIncluded ? ", with the posts' full text" : ", without full post text"}.`;
  }

  async function check(file) {
    let bundle;
    try { bundle = JSON.parse(await file.text()); } catch { $("checks").replaceChildren(Object.assign(document.createElement("li"), { textContent: `${file.name} is not valid JSON.` })); return; }
    PBAnalyzeView.checks($("checks"), await PB.verifyBundle(bundle));
  }

  const fail = (where) => (e) => { console.error(`[daylight-commons] ${where} failed`, e); say(`Could not ${where}: ${e.message}`); };
  $("file").addEventListener("change", () => { const f = $("file").files[0]; if (f) analyse(f).catch(fail("read the file")); });
  $("check").addEventListener("change", () => { const f = $("check").files[0]; if (f) check(f).catch(fail("check the bundle")); });
  $("save").addEventListener("click", () => saveBundle().catch(fail("save the bundle")));
  const drop = $("drop");
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); const f = e.dataTransfer.files[0]; if (f) analyse(f).catch(fail("read the file")); });
  const showKey = () => PBSign.keyId().then((id) => { $("key").textContent = id || "none yet; Daylight Commons makes one the first time you save a bundle"; }, fail("read this browser's Daylight Commons key"));
  showKey();
})();
