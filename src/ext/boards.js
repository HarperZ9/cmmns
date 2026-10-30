// The Boards page: a study board (src/core/board.js, refdb.board/1) from a moodboard in this browser
// or a folder of saves, drawn by src/core/board-html.js in the frame below the controls. Print or
// save as PDF through the browser; save as one web page (pictures and type inside it) into
// Downloads/<save folder>/boards/; or, where the browser lets a page write to the picked folder, save
// the portable folder (page, board.json, plates, fonts, the notes) beside the saves.
(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const status = (t) => { $("status").textContent = t; };
  let current = null;   // { kind: "moodboard" | "folder", board?, urls, entries?, handle?, moodboard? }

  $("lanes").replaceChildren(...PB.LANES.map((l) => Object.assign(document.createElement("option"), { value: l })));
  const boards = await PBMediaStore.boards().catch(() => []);
  const opt = (value, text) => Object.assign(document.createElement("option"), { value, textContent: text });
  $("source").replaceChildren(opt("", "Choose a folder or a moodboard"), ...boards.map((b) => opt("mb:" + b.id, `Moodboard: ${b.name}`)));

  const words = () => $("keywords").value.split(",").map((w) => w.trim()).filter(Boolean);
  const fonts = chrome.runtime.getURL("fonts/");

  // The board for the controls as they stand.
  function board() {
    if (!current) return null;
    let b;
    if (current.kind === "moodboard") {
      b = { ...current.board, plates: current.board.plates };
      b.running_head = { left: $("title").value || current.moodboard.name, right: ($("lane").value || "moodboard").toUpperCase() };
      b.lane = $("lane").value || "moodboard"; b.keyword_line = words().length ? words() : current.board.keyword_line; b.layout = $("layout").value; b.head = $("head").value;
    } else {
      const site = $("site").value, study = $("study").checked, f = { likes: $("likes").checked, liked: current.entries.liked, since: $("since").value, until: $("until").value };
      const entries = current.entries.filter((e) => (!site || e.sidecar.front.site === site) && (!study || e.sidecar.front.study) && PB.savesFilter(e.sidecar.front, f));
      b = PB.boardFrom(entries, { title: $("title").value || "Study board", lane: $("lane").value || "research", keywords: words(), layout: $("layout").value, head: $("head").value });
    }
    return b;
  }

  // Every button reports its failure on the page and in the console.
  const act = (fn) => async () => { try { await fn(); } catch (e) { console.error("[cmmns] study board:", e); status(e.message || String(e)); } };

  const urlFor = (m) => current.urls.get(m.path) || "";
  function draw() {
    const b = board();
    if (!b) return;
    $("view").srcdoc = PB.boardHtml(b, { url: urlFor, fonts });
    status(b.plates.length === 1 ? "1 plate." : `${b.plates.length} plates.`);
    if (current.kind === "moodboard") PBMediaStore.putBoard({ ...current.moodboard, lane: b.lane, keywords: b.keyword_line, layout: b.layout, head: b.head }).catch(() => {});
  }

  async function useFolder(handle) {
    status("Reading the notes in that folder.");
    const entries = await PBBoardsRead.fromFolder(handle);
    const urls = new Map();
    for (const e of entries) for (const [name, file] of Object.entries(e.file)) urls.set(name, URL.createObjectURL(file));
    current = { kind: "folder", entries, urls, handle };
    const sites = [...new Set(entries.map((e) => e.sidecar.front.site).filter(Boolean))].sort();
    $("site").replaceChildren(opt("", "All"), ...sites.map((s) => opt(s, s)));
    $("title").value = $("title").value || handle.name;
    $("write").hidden = typeof handle.requestPermission !== "function";
    draw();
  }

  $("folder").addEventListener("click", async () => {
    if (typeof showDirectoryPicker !== "function") { status("This browser cannot open a folder here. Use Chrome or Edge, or make the board with: cmmns board make <folder>."); return; }
    try { await useFolder(await showDirectoryPicker({ id: "daylight-saves", mode: "read" })); } catch (e) { if (e.name !== "AbortError") status(e.message); }
  });
  $("source").addEventListener("change", act(async () => {
    const v = $("source").value;
    if (!v.startsWith("mb:")) return;
    const r = await PBBoardsRead.fromMoodboard(v.slice(3));
    current = { kind: "moodboard", ...r };
    $("title").value = r.moodboard.name; $("lane").value = r.board.lane; $("keywords").value = r.board.keyword_line.join(", "); $("layout").value = r.board.layout; $("head").value = r.moodboard.head || "grotesk";
    $("write").hidden = true;
    draw();
  }));
  const asked = new URLSearchParams(location.search).get("mb");
  if (asked && boards.some((x) => x.id === asked)) { $("source").value = "mb:" + asked; $("source").dispatchEvent(new Event("change")); }
  for (const id of ["title", "lane", "keywords", "layout", "head", "site", "study", "likes", "since", "until"]) $(id).addEventListener("change", draw);

  $("print").addEventListener("click", () => { if ($("view").contentWindow) $("view").contentWindow.print(); });

  const dataUrl = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
  const slug = (s) => String(s || "board").normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 60) || "board";

  // One self-contained page: every plate and the type as data addresses.
  $("page").addEventListener("click", act(async () => {
    const b = board();
    if (!b) return;
    status("Putting the page together.");
    const inline = new Map();
    for (const [k, u] of current.urls) inline.set(k, await dataUrl(await (await fetch(u)).blob()));
    let html = PB.boardHtml(b, { url: (m) => inline.get(m.path) || "", fonts: "" });
    for (const f of ["AccessionStencil.woff2", "hanken-grotesk.woff2", "jetbrains-mono-regular.woff2"]) html = html.replace(`url("${f}")`, `url("${await dataUrl(await (await fetch(fonts + f)).blob())}")`);
    // Through the worker, which names every CMMNS download (<save folder>/boards/<title>.html).
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const r = await chrome.runtime.sendMessage({ type: "pb-qs-download", url, filename: slug(b.running_head.left) + ".html", site: "boards" });
    if (r && r.error) throw new Error(r.error);
    status("Saved as one web page in your Downloads.");
  }));

  // The portable folder, written into <picked folder>/boards/<title>/.
  $("write").addEventListener("click", act(async () => {
    const b = board(), h = current && current.handle;
    if (!b || !h) return;
    if ((await h.requestPermission({ mode: "readwrite" })) !== "granted") { status("Writing to that folder was not allowed."); return; }
    const dir = await (await h.getDirectoryHandle("boards", { create: true })).getDirectoryHandle(slug(b.running_head.left), { create: true });
    // Every file written is listed with its SHA-256 in MANIFEST.sha256, as the command line does.
    const listed = [];
    const put = async (d, name, data, at = "") => {
      const blob = data instanceof Blob ? data : new Blob([data]);
      const w = await (await d.getFileHandle(name, { create: true })).createWritable(); await w.write(blob); await w.close();
      const hex = [...new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()))].map((x) => x.toString(16).padStart(2, "0")).join("");
      listed.push([at + name, hex]);
    };
    const plates = await dir.getDirectoryHandle("plates", { create: true }), fontDir = await dir.getDirectoryHandle("fonts", { create: true }), notes = await dir.getDirectoryHandle("sidecars", { create: true });
    for (const e of current.entries) {
      for (const [name, file] of Object.entries(e.file)) if (b.plates.some((p) => p.media.some((m) => m.path === name))) await put(plates, name, file, "plates/");
      if (e.text && b.plates.some((p) => p.unit === e.sidecarName)) await put(notes, e.sidecarName, e.text, "sidecars/");
    }
    for (const f of ["AccessionStencil.woff2", "hanken-grotesk.woff2", "jetbrains-mono-regular.woff2", "OFL-accession.txt", "OFL-hanken-grotesk.txt", "OFL-jetbrains-mono.txt"]) await put(fontDir, f, await (await fetch(fonts + f)).blob(), "fonts/");
    await put(dir, "board.json", JSON.stringify(b, null, 2) + "\n");
    await put(dir, "index.html", PB.boardHtml(b));
    const lines = listed.sort((x, y) => (x[0] < y[0] ? -1 : 1)).map(([p, hex]) => `${hex}  ${p}`);
    const m = await (await dir.getFileHandle("MANIFEST.sha256", { create: true })).createWritable(); await m.write(lines.join("\n") + "\n"); await m.close();
    status(`Saved in ${h.name}/boards/${slug(b.running_head.left)}.`);
  }));
})().catch((e) => console.error("[cmmns] the Boards page failed", e));
