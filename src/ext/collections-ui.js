// Drawing for the collections page (collections.js): the grid tiles, the tag row and the details
// list for one item with its hash, source, archive copy and lineage. textContent only.
globalThis.PBCollectionsUi = (() => {
  "use strict";
  const { el } = PBPages;
  const urls = new Map();   // sha256 -> object URL, revoked when the grid redraws

  function revokeAll() { for (const u of urls.values()) URL.revokeObjectURL(u); urls.clear(); }
  async function objectUrl(sha256) {
    if (urls.has(sha256)) return urls.get(sha256);
    const b = await PBMediaStore.blob(sha256);
    if (!b) return null;
    const u = URL.createObjectURL(b);
    urls.set(sha256, u);
    return u;
  }

  async function media(rec) {
    const u = await objectUrl(rec.sha256);
    if (!u) return el("div", { class: "thumb empty" }, "File missing");
    if (rec.kind === "video") { const v = el("video", { class: "thumb", preload: "metadata", muted: "", controls: "" }); v.src = u; return v; }
    if (rec.kind === "audio") { const a = el("audio", { controls: "", preload: "metadata" }); a.src = u; return a; }
    const img = el("img", { class: "thumb", alt: rec.source.alt || rec.note || "Saved image", loading: "lazy" });
    img.src = u;
    return img;
  }

  // A tile with its media, tags, note and the four actions.
  async function tile(rec, on) {
    const li = el("li", { class: "media-card" });
    li.append(await media(rec));
    if ((rec.lineage || []).length) li.append(el("span", { class: "facts" }, `Copy: ${rec.lineage.map((l) => l.op).join(", then ")}`));
    if (rec.tags.length) li.append(el("span", { class: "facts mono" }, rec.tags.map((t) => "#" + t).join(" ")));
    if (rec.note) li.append(el("span", { class: "note" }, rec.note));
    const row = el("div", { class: "tile-actions" });
    for (const [label, act] of [["Details", "detail"], ["Download", "download"], ["Convert", "convert"], ["Delete", "delete"]]) {
      const b = el("button", { type: "button", class: act === "delete" ? "quiet" : "" }, label);
      b.addEventListener("click", () => on(act, rec));
      row.append(b);
    }
    li.append(row);
    return li;
  }

  function tags(list, active, onPick) {
    const out = [];
    for (const t of [...new Set(list.flatMap((r) => r.tags || []))].sort()) {
      const b = el("button", { type: "button", class: "tag" + (t === active ? " on" : ""), "aria-pressed": String(t === active) }, "#" + t);
      b.addEventListener("click", () => onPick(t === active ? null : t));
      out.push(b);
    }
    return out;
  }

  function detail(rec, problems) {
    const rows = [["Kind", `${rec.kind}, ${rec.mime}`], ["Size", PB.sizeText(rec.bytes)], ["SHA-256", rec.sha256], ["Original SHA-256", rec.original],
      ["Address", rec.source.url || "none"], ["Page", rec.source.page || "none"], ["Saved", rec.source.savedAt]];
    if (rec.source.stream) rows.push(["Stream", `${rec.source.stream.type.toUpperCase()}, ${rec.source.stream.role || "media"} track, ${rec.source.stream.segments || "?"} segments`]);
    if (rec.archive) rows.push(["Internet Archive", rec.archive.url || `not kept: ${rec.archive.error}`]);
    (rec.lineage || []).forEach((l, i) => rows.push([`Step ${i + 1}`, `${l.op} ${JSON.stringify(l.params)} with ${l.tool || "unknown"}: ${l.from.slice(0, 12)} to ${l.to.slice(0, 12)}, ${PB.sizeLine(l.bytesBefore, l.bytesAfter)}`]));
    const mine = problems.filter((p) => p.id === rec.id);
    rows.push(["Lineage check", mine.length ? mine.map((p) => p.problem).join("; ") : "every step links by hash back to the original"]);
    return rows.flatMap(([k, v]) => [el("dt", {}, k), el("dd", { class: /SHA|Step/.test(k) ? "mono" : "" }, String(v))]);
  }

  return Object.freeze({ tile, tags, detail, revokeAll, objectUrl });
})();
