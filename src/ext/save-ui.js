// Drawing for the save page (save.js): one card per media item found on the page, with a tick box,
// a preview where one exists, its kind and size, and a plain line when it is protected or cannot be
// read. Built with textContent and element properties only, never markup from strings.
globalThis.PBSaveUi = (() => {
  "use strict";
  const { el } = PBPages;
  const KIND = { image: "Image", gif: "GIF", video: "Video", audio: "Audio" };

  function preview(item) {
    const url = item.kind === "video" ? item.poster : item.url;
    if (item.kind === "video" && !url && item.url && !item.protected) {
      const v = el("video", { class: "thumb", muted: "", preload: "metadata", "aria-hidden": "true" });
      v.src = item.url + "#t=0.5";
      return v;
    }
    if (item.kind === "audio" || !url || item.protected) return el("div", { class: "thumb empty", "aria-hidden": "true" }, KIND[item.kind] || "File");
    const img = el("img", { class: "thumb", alt: item.alt || "", loading: "lazy", referrerpolicy: "no-referrer" });
    img.src = url;
    return img;
  }

  function facts(item) {
    const bits = [KIND[item.kind] || "Media"];
    if (item.width && item.height) bits.push(`${item.width} by ${item.height}`);
    if (item.duration) bits.push(`${item.duration} s`);
    if (!item.url && item.streams && item.streams.length) bits.push(item.streams[item.streams.length - 1].type === "hls" ? "HLS stream" : "DASH stream");
    if (item.background) bits.push("page background");
    return bits.join(", ");
  }

  // A card: <li><label><input type=checkbox> preview, facts, address or the reason it cannot be saved</label></li>
  function card(item, i, checked) {
    const li = el("li", { class: "media-card" + (item.protected ? " protected" : "") });
    const label = el("label");
    const box = el("input", { type: "checkbox", "data-i": String(i) });
    box.checked = !!checked && !item.protected;
    box.disabled = !!item.protected || (!item.url && !(item.streams && item.streams.length));
    label.append(box, preview(item), el("span", { class: "facts" }, facts(item)));
    if (item.protected) label.append(el("span", { class: "why v-drift" }, `Protected: ${item.protected} ${PB.PROTECTED_LINE}`));
    else if (box.disabled) label.append(el("span", { class: "why" }, "The page builds this media in memory from a source Daylight Commons cannot read."));
    else label.append(el("span", { class: "addr mono" }, (item.url || item.streams[item.streams.length - 1].url).slice(0, 140)));
    li.append(label);
    return li;
  }

  // One result line: what was saved, its size and its hash, or why it was not.
  function result(text, rec, cls) {
    const li = el("li", cls ? { class: cls } : {}, text);
    if (rec) {
      li.append(el("br"), el("code", { class: "hash" }, rec.sha256));
      const a = el("a", { href: `convert.html#${encodeURIComponent(rec.id)}` }, " Convert or compress");
      li.append(" ", a);
      // Share clean (share-clean.js): a copy to send, with what the file says about itself removed.
      const c = el("button", { type: "button", class: "quiet" }, "Share clean");
      const said = el("span", { class: "muted", role: "status" });
      c.addEventListener("click", async () => { const r = await PBShareClean.download(rec); said.textContent = r.ok ? ` Saved ${r.name}; removed ${r.removed.join("; ") || "nothing"}.` : ` Not cleaned: ${r.reason}.`; });
      li.append(" ", c, said);
    }
    return li;
  }

  return Object.freeze({ card, result, KIND });
})();
