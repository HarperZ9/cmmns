// Share clean in the browser (src/core/clean.js through core.bundle.js): a copy of a saved file
// with everything it says about itself removed, downloaded under a neutral name. The saved file in
// this browser stays as it was, as the evidence copy, and gets the lineage record (original hash to
// clean hash) in its own record. Nothing is sent anywhere.
globalThis.PBShareClean = (() => {
  "use strict";
  const extOf = (rec) => (String(rec.mime || "").split("/")[1] || "").replace("jpeg", "jpg").replace("quicktime", "mov").replace(/[^a-z0-9]/gi, "");

  function save(name, blob) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // { ok, name, bytes, removed } or { ok: false, reason }.
  async function cleanOne(rec) {
    const blob = await PBMediaStore.blob(rec.sha256);
    if (!blob) return { ok: false, reason: "the saved file is missing from this browser" };
    const original = new Uint8Array(await blob.arrayBuffer()), r = await PB.shareClean(original);
    if (!r.ok) return r;
    const lineage = await PB.cleanLineage(original, r);
    await PBMediaStore.update({ ...rec, cleanCopies: [...(rec.cleanCopies || []), lineage] });
    return { ok: true, name: PB.cleanName(r.format, lineage.clean.sha256, extOf(rec)), bytes: r.bytes, removed: r.removed, notes: r.notes, format: r.format };
  }

  async function download(rec) {
    const r = await cleanOne(rec);
    if (r.ok) save(r.name, new Blob([r.bytes], { type: rec.mime || "application/octet-stream" }));
    return r;
  }

  // Every file of a collection, cleaned, in one zip with a plain list of what was removed. A file
  // Share clean cannot read is left out and listed, never put in as it was.
  async function downloadAll(list) {
    const entries = [], lines = ["Share clean: each file below had what it says about itself removed.", ""];
    let left = 0;
    for (const rec of list) {
      const r = await cleanOne(rec);
      if (r.ok) { entries.push({ name: r.name, bytes: r.bytes }); lines.push(`${r.name}: removed ${r.removed.join("; ") || "nothing; it carried no metadata"}`); }
      else { left++; lines.push(`One ${rec.kind || "file"} was left out: ${r.reason}`); }
    }
    lines.push("", PB.CLEAN_LIMITS, "");
    entries.push({ name: "SHARE-CLEAN.txt", bytes: new TextEncoder().encode(lines.join("\n")) });
    save("share-clean.zip", new Blob([PB.storedZip(entries)], { type: "application/zip" }));
    return { files: entries.length - 1, left };
  }

  return Object.freeze({ download, downloadAll, cleanOne });
})();
