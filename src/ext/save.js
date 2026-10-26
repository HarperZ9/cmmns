// The save page: shows what the page loaded (from media-bg.js), and on the user's click asks the
// browser for access to the hosts those files come from, fetches them (media-fetch.js), hashes each
// one and keeps it in a case or a moodboard (media-store.js). A case save also joins the case list
// (case-inbox.js) and, when ticked, asks the Internet Archive to keep a copy of the address.
(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const { el } = PBPages;
  const id = decodeURIComponent(location.hash.slice(1));
  const job = id ? await chrome.runtime.sendMessage({ type: "pb-save-get", id }).catch(() => null) : null;
  const status = (t) => { $("status").textContent = t; };
  let pending = null;
  await PBSettings.ready;
  const protectedMode = PBSettings.get().protection;
  if (protectedMode) { $("archive").checked = false; $("archive").disabled = true; $("protection-note").hidden = false; }

  if (!job) { $("from").textContent = "Nothing to save here. Use \"Save to Daylight\" on a picture or video, or \"Save media from this page\" in the toolbar menu."; $("save").disabled = true; return; }
  $("from").textContent = job.error || `From ${job.title || "this page"} (${job.page || "unknown address"}). ${job.items.length} item${job.items.length === 1 ? "" : "s"} found.`;
  job.items.forEach((item, i) => $("found").append(PBSaveUi.card(item, i, job.target ? i === 0 : job.items.length <= 6)));
  if (!job.items.length) { $("save").disabled = true; status("No images, GIFs, videos or audio were found on the page."); }

  // Moodboards for the picker.
  async function fillBoards(select) {
    const boards = await PBMediaStore.boards();
    $("board").replaceChildren(...boards.map((b) => el("option", { value: b.id }, b.name)));
    if (select) $("board").value = select;
    if (!boards.length) $("board").append(el("option", { value: "" }, "No moodboards yet: name one below"));
  }
  await fillBoards();
  const where = () => document.querySelector("input[name=where]:checked").value;
  for (const r of document.querySelectorAll("input[name=where]")) r.addEventListener("change", () => { $("case-opts").hidden = where() !== "case"; $("board-opts").hidden = where() !== "moodboard"; });

  const chosen = () => [...document.querySelectorAll("#found input[type=checkbox]:checked")].map((b) => job.items[Number(b.dataset.i)]);

  async function collection() {
    if (where() === "case") return { type: "case", id: "case" };
    const name = $("board-new").value.trim();
    if (name) { const b = await PBMediaStore.newBoard(name); await fillBoards(b.id); $("board-new").value = ""; return { type: "moodboard", id: b.id }; }
    if (!$("board").value) throw new Error("Pick a moodboard or name a new one.");
    return { type: "moodboard", id: $("board").value };
  }

  async function archive(url) {
    const out = { requested: new Date().toISOString(), url: null, timestamp: null, error: null };
    try {
      const res = await fetch("https://web.archive.org/save/" + url, { signal: AbortSignal.timeout(90000) });
      const m = /\/web\/(\d{14})\/(.+)$/.exec(res.headers.get("content-location") || res.url || "");
      if (m) Object.assign(out, { url: `https://web.archive.org/web/${m[1]}/${m[2]}`, timestamp: m[1] }); else out.error = `HTTP ${res.status}, no snapshot address in the answer`;
    } catch (e) { out.error = `${e.name}: ${e.message}`; }
    return out;
  }

  async function keep(item, part, got, where, opts) {
    const sha256 = await PB.mediaSha256(part.bytes);
    const src = { bytes: part.bytes.length, mime: part.mime, url: item.url || (got.stream && got.stream.manifest), page: job.page, pageTitle: job.title, alt: item.alt,
      stream: got.stream ? { ...got.stream, role: part.role, segments: part.segments } : null };
    let rec = PB.savedRecord(src, { sha256, collection: where, tags: opts.tags, note: opts.note });
    await PBMediaStore.put(rec, new Blob([part.bytes], { type: part.mime }));
    if (where.type === "case") {
      const target = item.url && /^https?:/.test(item.url) ? item.url : job.page;
      if (opts.archive && target) { rec = { ...rec, archive: await archive(target) }; await PBMediaStore.update(rec); }
      await PBCaseInbox.addRow(PB.caseInboxRow(rec));
    }
    return rec;
  }

  async function saveOne(item, where, opts) {
    try {
      const got = await PBMediaFetch.fetchItem(item, { maxHeight: Number($("quality").value), onProgress: (d, n) => status(`Fetching segment ${d} of ${n}.`) });
      for (const part of got.parts) {
        const rec = await keep(item, part, got, where, opts);
        const live = got.stream && got.stream.live ? " This is a live stream: the file holds what it listed when saved." : "";
        const arch = rec.archive ? (rec.archive.url ? ` Archived at ${rec.archive.url}.` : ` The Internet Archive did not keep a copy: ${rec.archive.error}.`) : "";
        $("results").append(PBSaveUi.result(`Saved ${PBSaveUi.KIND[rec.kind] || "file"}${got.parts.length > 1 ? ` (${part.role} track)` : ""}, ${PB.sizeText(rec.bytes)}.${live}${arch}`, rec));
      }
    } catch (e) {
      if (e instanceof PBMediaFetch.NeedsAccess) { pending = { items: [item], where, opts, origins: e.origins }; $("more").hidden = false; $("more").textContent = `Allow ${e.origins.map((o) => o.replace(/^https?:\/\/|\/\*$/g, "")).join(", ")} and continue`; return; }
      const prot = e instanceof PBMediaFetch.Protected;
      $("results").append(PBSaveUi.result(prot ? `Not saved. ${e.reason} ${PB.PROTECTED_LINE}` : `Not saved: ${e.message}`, null, prot ? "v-drift" : ""));
      if (!prot) console.warn("[daylight-commons] save failed", item.url, e);
    }
  }

  async function run(items, where, opts) {
    $("save").disabled = true;
    for (const item of items) await saveOne(item, where, opts);
    status(pending ? "One more host needs your permission." : "Done.");
    $("save").disabled = false;
  }

  // The permission request runs first in the click, as browsers require.
  $("save").addEventListener("click", () => {
    const items = chosen();
    if (!items.length) { status("Tick at least one item."); return; }
    // Source-protection mode asks for no host access: nothing will be fetched (media-fetch.js).
    const origins = protectedMode ? [] : [...new Set(items.flatMap(PBMediaFetch.firstOrigins))];
    if (where() === "case" && $("archive").checked && !protectedMode) origins.push("https://web.archive.org/*");
    // Firefox 140 and later ask for "browsing activity" themselves when an address goes to the Internet
    // Archive; other browsers throw on that key, and only the hosts are asked for.
    const archive = where() === "case" && $("archive").checked && !protectedMode;
    let asked;
    if (!origins.length) asked = Promise.resolve(true);
    else { try { asked = chrome.permissions.request(archive ? { origins, data_collection: ["browsingActivity"] } : { origins }); } catch { asked = chrome.permissions.request({ origins }); } }
    asked.then(async (ok) => {
      if (!ok) { status("Access was not given, so nothing was saved."); return; }
      const opts = { tags: $("tags").value, note: $("note").value, archive };
      run(items, await collection(), opts);
    }).catch((e) => status(e.message));
  });
  $("more").addEventListener("click", () => {
    if (!pending) return;
    const p = pending; pending = null; $("more").hidden = true;
    chrome.permissions.request({ origins: p.origins }).then((ok) => (ok ? run(p.items, p.where, p.opts) : status("Access was not given for the segments."))).catch((e) => status(e.message));
  });
})().catch((e) => console.error("[daylight-commons] save page failed", e));
