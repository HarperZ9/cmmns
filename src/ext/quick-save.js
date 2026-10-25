// One-click download, in the page: the plan for the target (src/core/media-pick.js), then the file.
// A plain address goes to the browser's own downloads (media-bg.js asks chrome.downloads), named
// from the page and typed from the file's first bytes. Bytes made here (a stream put together, a
// GIF, a canvas) are handed over the same way. Protected media is refused and, if the user asks,
// a reference is kept instead. Fetches happen only after the click and send no cookies elsewhere.
globalThis.PBQuickSave = globalThis.PBQuickSave || (() => {
  "use strict";
  const toast = (t, o) => PBQuickToast.show(t, o);
  const size = (n) => PB.sizeText(n);
  const msg = (m) => chrome.runtime.sendMessage(m);

  // The first 64 KB of a file (Range), for its type and an encryption check; null when the host
  // does not allow the page to read it, in which case the address and the browser decide the type.
  async function probe(url) {
    try {
      const res = await fetch(url, { headers: { Range: "bytes=0-65535" }, credentials: "omit", mode: "cors", signal: AbortSignal.timeout(10000) });
      if (!res.ok) return null;
      const reader = res.body.getReader(), parts = [];
      let n = 0;
      while (n < 65536) { const { done, value } = await reader.read(); if (done) break; parts.push(value); n += value.length; }
      reader.cancel().catch(() => {});
      return { bytes: PB.concatBytes(parts).subarray(0, 65536), type: res.headers.get("content-type") || "" };
    } catch { return null; }
  }

  async function viaBrowser(url, name, opts) {
    const r = await msg({ type: "pb-qs-download", url, filename: name, fixExt: opts.fixExt || false });
    if (!r || r.error) throw new Error(r && r.error ? r.error : "The browser did not start the download.");
    return r;
  }

  // Bytes made in the page: handed to the browser's downloads as a blob address; where the
  // browser cannot read the page's blob address, a download link in the page saves it instead.
  async function saveBytes(bytes, mime, name) {
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    try { await viaBrowser(url, name, {}); }
    catch (e) {
      const a = document.createElement("a");
      a.href = url; a.download = name; a.style.display = "none";
      (document.body || document.documentElement).append(a); a.click(); a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  }

  async function plainFile(t, plan, name0) {
    const head = await probe(plan.url);
    if (head && t.kind === "video") { const why = PB.fileProtection(head.bytes); if (why) throw new PBQuickStream.Protected(why); }
    const type = PB.chooseType({ bytes: head && head.bytes, contentType: head && head.type, url: plan.url });
    if (type.mime === "text/html") throw new Error("The address answers with a web page, not a file. The site may need you to open the post first.");
    const name = name0(type.ext, plan.url);
    // The server names another type than the bytes show (a WebP sent as image/jpeg): the browser
    // would rename the file after the server's type, so the bytes are saved from here instead.
    const said = head && PB.chooseType({ contentType: head.type }).ext;
    if (type.from === "bytes" && said && said !== "bin" && said !== type.ext) {
      const b = await bytesOf(plan.url);
      await saveBytes(b.bytes, type.mime, name);
      return `Saved ${name}, ${size(b.bytes.length)}.`;
    }
    await viaBrowser(plan.url, name, { fixExt: type.from !== "bytes" });
    return `Downloading ${name}`;
  }

  async function bytesOf(url) {
    const res = await fetch(url, { credentials: /^(data|blob):/.test(url) || new URL(url).origin === location.origin ? "include" : "omit" });
    if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
    return { bytes: new Uint8Array(await res.arrayBuffer()), type: res.headers.get("content-type") || "" };
  }

  async function canvasPng(el) {
    let blob;
    try { blob = await new Promise((res, rej) => el.toBlob((b) => (b ? res(b) : rej(new Error("The canvas is empty."))), "image/png")); }
    catch (e) { throw new Error(e && e.name === "SecurityError" ? "The site drew this picture from another site without letting pages read it back, so it cannot be saved." : e.message); }
    return new Uint8Array(await blob.arrayBuffer());
  }

  async function makeGif(t, plan, progress) {
    if (plan.from === "stream") {
      const got = await PBQuickStream.assemble(plan.stream, (d, n) => progress(`Fetching part ${d} of ${n}`), t.streams || []);
      const v = got.files.find((f) => f.role === "video") || got.files[0];
      return PBQuickGif.fromVideoBytes(v.bytes, v.mime, progress);
    }
    const src = await bytesOf(plan.url);
    const type = PB.chooseType({ bytes: src.bytes, contentType: src.type, url: plan.url });
    if (type.mime === "image/gif") return { bytes: src.bytes, note: "" };
    if (type.mime.startsWith("image/")) return PBQuickGif.fromImageBytes(src.bytes, type.mime);
    return PBQuickGif.fromVideoBytes(src.bytes, type.mime, progress);
  }

  // Downloads one target. opts: { asGif, title, index, total, quiet }. Resolves to the line shown.
  async function run(t, opts = {}) {
    const plan = PB.downloadPlan(t, { asGif: !!opts.asGif });
    const title = opts.title || t.title || document.title || location.hostname;
    const name = (ext, url) => PB.downloadName({ title, url: url || t.url || "", index: opts.index || 0, total: opts.total || 1, ext });
    const progress = (line) => toast(line, { stay: 0 });
    if (plan.action === "refuse") throw new PBQuickStream.Protected(plan.reason);
    if (plan.action === "none") throw new Error(plan.reason);
    if (plan.action === "url") return plainFile(t, plan, name);
    let bytes, note = "", mime;
    if (plan.action === "bytes") { const b = await bytesOf(plan.url); bytes = b.bytes; mime = PB.chooseType({ bytes, contentType: b.type }).mime; }
    else if (plan.action === "canvas") { bytes = await canvasPng(t.el); mime = "image/png"; }
    else if (plan.action === "gif") { progress("Making a GIF on this device"); ({ bytes, note } = await makeGif(t, plan, progress)); mime = "image/gif"; }
    else if (plan.action === "stream") {
      progress("Putting the stream together");
      const got = await PBQuickStream.assemble(plan.stream, (d, n) => progress(`Fetching part ${d} of ${n}`), t.streams || []);
      note = got.note;
      for (const f of got.files) await saveBytes(f.bytes, f.mime, PB.downloadName({ title: got.files.length > 1 ? `${title} ${f.role}` : title, ext: PB.downloadExt(f.mime) || "bin" }));
      return `Saved ${got.files.length > 1 ? got.files.length + " files" : PB.downloadName({ title, ext: PB.downloadExt(got.files[0].mime) })}, ${size(got.files.reduce((s, f) => s + f.bytes.length, 0))}.${note}`;
    }
    const n = name(PB.downloadExt(mime) || "bin");
    await saveBytes(bytes, mime, n);
    return `Saved ${n}, ${size(bytes.length)}.${note}`;
  }

  // A reference to protected media: the page, its title, the time and pictures the page shows in the
  // clear, kept on a moodboard with its label. Never the media itself.
  async function keepReference(t, reason) {
    const imgs = [t.poster, ...(t.el ? [...(t.el.closest("article, section, main, body") || document).querySelectorAll("img")].slice(0, 6).map((i) => i.currentSrc || i.src) : [])];
    const previews = PBQuickResolve.loadedStreams("").map((s) => s.url).filter((u) => u !== (t.streams && t.streams[0] && t.streams[0].url));
    const ref = PB.referenceOf({ page: location.href, title: document.title, poster: t.poster || null, images: imgs, previews, reason });
    const thumbs = [];
    for (const u of ref.images.slice(0, 4)) { try { const b = await bytesOf(u); if (PB.sniffMime(b.bytes) && PB.sniffMime(b.bytes).startsWith("image/")) thumbs.push({ url: u, b64: b64(b.bytes) }); } catch { /* the address stays in the reference */ } }
    const r = await msg({ type: "pb-qs-reference", ref, thumbs });
    if (!r || r.error) throw new Error(r && r.error ? r.error : "The reference could not be kept.");
    return `Kept a reference on the moodboard "${r.board}". ${PB.REFERENCE_LABEL}`;
  }
  function b64(bytes) { let s = ""; for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode(...bytes.subarray(i, i + 32768)); return btoa(s); }

  // The entry point for a click: runs, then says what happened. Returns the outcome for tests.
  async function start(t, opts = {}) {
    toast(opts.asGif ? "Making a GIF" : "Downloading", { stay: 0 });
    try {
      const line = await run(t, opts);
      if (!opts.quiet) toast(line, { tone: "ok" });
      return { ok: true, line };
    } catch (e) {
      if (e instanceof PBQuickStream.Protected) {
        toast(`Protected, can't be saved. ${e.reason}`, { tone: "no", actions: [["Save reference", () => keepReference(t, e.reason).then((l) => toast(l, { tone: "ok", stay: 7000 }), (x) => toast(`No reference kept: ${x.message}`, { tone: "no" }))]] });
        return { ok: false, protected: true, line: e.reason };
      }
      console.warn("[daylight-commons] download failed", e);
      toast(`Not saved: ${e.message}`, { tone: "no", stay: 7000 });
      return { ok: false, line: e.message };
    }
  }

  // From the right-click menu (media-bg.js). info: { srcUrl, linkUrl, asGif }.
  function fromMenu(info) {
    const t = PBQuickResolve.resolve(info);
    if (!t) { toast("No picture, GIF or video was found under the pointer.", { tone: "no" }); return Promise.resolve({ ok: false, line: "nothing found" }); }
    return start(t, { asGif: info.asGif });
  }

  return Object.freeze({ start, run, fromMenu, keepReference, saveBytes });
})();
