// Evidence capture, in the page (project-docs/EVIDENCE-CAPTURE.md): the files are saved as a normal
// save; this collects each file's SHA-256 before and after its words were written in, then asks the
// worker to picture the visible page, log the capture in the custody chain and save the record
// (<name>.capture.json and <name>.capture.png) beside the files. Nothing leaves the computer.
globalThis.PBQuickCapture = globalThis.PBQuickCapture || (() => {
  "use strict";

  function collector() {
    const files = [];
    return {
      files,
      async add(name, original, saved, mime, made = null) {
        const sha256 = await PB.mediaSha256(original), saved_sha256 = saved === original ? sha256 : await PB.mediaSha256(saved);
        files.push({ name, sha256, saved_sha256, bytes: original.length, mime, made });
      },
    };
  }

  // r: what PBQuickSave.run returned ({ names, meta, files, transformed }). Resolves to the line to show.
  async function finish(r) {
    if (!r.files || !r.files.length) throw new Error("Nothing was saved, so there is nothing to capture.");
    // CMMNS's own controls (the toast, the hover bar, the in-post buttons) stay out of the picture.
    PBQuickToast.hide && PBQuickToast.hide();
    if (globalThis.PBHover) PBHover.hide();
    const veil = document.createElement("style");
    veil.textContent = ".dc-dl { visibility: hidden !important; }";
    document.documentElement.append(veil);
    let out;
    try {
      await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      const page = { url: location.href, title: document.title, viewport_height: innerHeight, page_height: Math.max(document.documentElement.scrollHeight, innerHeight), scroll_y: Math.round(scrollY) };
      out = await chrome.runtime.sendMessage({ type: "pb-qs-capture", meta: r.meta, files: r.files, page, transformed: r.transformed || null, offsetMinutes: -new Date().getTimezoneOffset() });
    } finally { veil.remove(); }
    if (!out || out.error) throw new Error(out && out.error ? out.error : "The capture could not be recorded.");
    return `Captured as evidence: ${r.files.length === 1 ? r.files[0].name : r.files.length + " files"}, the visible page, and custody line ${out.seq}. ${out.kept}`;
  }

  return Object.freeze({ collector, finish });
})();
