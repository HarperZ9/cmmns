// The collections page: the case files and every moodboard as a grid, filtered by kind, tag and
// text; details with hash and lineage; download, convert and delete; a JSON list of a collection
// with every hash and step; and "Delete all saved media". Reads and writes media-store.js only.
(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const { el } = PBPages;
  const view = { which: "case:case", tag: null };
  const parse = (v) => { const [type, ...rest] = String(v).split(":"); return { type, id: rest.join(":") }; };

  async function fillWhich() {
    const boards = await PBMediaStore.boards();
    $("which").replaceChildren(el("option", { value: "case:case" }, "Investigation case"), ...boards.map((b) => el("option", { value: "moodboard:" + b.id }, `Moodboard: ${b.name}`)));
    const want = new URLSearchParams(location.search).get("c");
    if (want && [...$("which").options].some((o) => o.value === want)) view.which = want;
    $("which").value = view.which;
  }

  function download(name, blob) {
    const a = el("a", { download: name });
    a.href = URL.createObjectURL(blob);
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  async function act(what, rec) {
    if (what === "download") { const b = await PBMediaStore.blob(rec.sha256); if (b) download(PB.fileNameFor(rec), b); return; }
    if (what === "convert") { location.href = "convert.html#" + encodeURIComponent(rec.id); return; }
    if (what === "delete") { if (confirm("Delete this saved file from this browser?")) { await PBMediaStore.remove(rec.id); draw(); } return; }
    const all = await PBMediaStore.items();
    $("detail").replaceChildren(...PBCollectionsUi.detail(rec, PB.checkLineage(all)));
    $("detail-box").hidden = false;
    $("detail-box").scrollIntoView({ block: "nearest" });
  }

  async function draw() {
    PBCollectionsUi.revokeAll();
    const all = await PBMediaStore.items(), c = parse(view.which);
    const mine = PB.filterItems(all, { collection: c });
    const shown = PB.filterItems(mine, { kind: $("kind").value || null, tag: view.tag, q: $("q").value });
    $("tags").replaceChildren(...PBCollectionsUi.tags(mine, view.tag, (t) => { view.tag = t; draw(); }));
    const tiles = await Promise.all(shown.map((r) => PBCollectionsUi.tile(r, act)));
    $("grid").replaceChildren(...(tiles.length ? tiles : [el("li", { class: "muted" }, mine.length ? "Nothing matches the filter." : "Nothing saved here yet. Right-click a picture or video and choose Save to Daylight.")]));
    const problems = PB.checkLineage(all).filter((p) => mine.some((m) => m.id === p.id));
    $("summary").textContent = `${shown.length} of ${mine.length} shown. ${problems.length ? `${problems.length} lineage problem${problems.length > 1 ? "s" : ""}: open Details.` : "Lineage checked: every copy links by hash to its original."}`;
    const u = await PBMediaStore.usage();
    $("usage").textContent = `${u.records} saved items, ${u.files} files, ${PB.sizeText(u.bytes)} in this browser.`;
    $("export").disabled = !mine.length;
  }

  await fillWhich();
  for (const id of ["which", "kind"]) $(id).addEventListener("change", () => { view.which = $("which").value; view.tag = null; draw(); });
  $("q").addEventListener("input", () => draw());
  $("new-board").addEventListener("click", async () => {
    try { const b = await PBMediaStore.newBoard($("new-name").value); $("new-name").value = ""; view.which = "moodboard:" + b.id; await fillWhich(); draw(); }
    catch (e) { $("summary").textContent = e.message; }
  });
  $("export").addEventListener("click", async () => {
    const c = parse(view.which), list = PB.filterItems(await PBMediaStore.items(), { collection: c });
    const doc = { format: "daylight-collection/1", collection: c, exported: new Date().toISOString(), items: list, lineageProblems: PB.checkLineage(list) };
    download(`daylight-${c.type}-${c.id}.json`, new Blob([JSON.stringify(doc, null, 2) + "\n"], { type: "application/json" }));
  });
  $("clear").addEventListener("click", async () => {
    if (!confirm("Delete every saved file, moodboard and record from this browser? This cannot be undone.")) return;
    await PBMediaStore.clearAll();
    view.which = "case:case";
    await fillWhich();
    draw();
  });
  draw();
})().catch((e) => console.error("[daylight-commons] collections failed", e));
