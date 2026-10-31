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

  const { open, bytesOf } = PBQuickFetch;   // one request per file (quick-fetch.js)

  // Where one save goes: { site, study, library }. The site folder, a study save (CMMNS/study/<site>/),
  // or a library (CMMNS/library/<library>/). Passed with every save, never kept between saves, so
  // a library filling in the background and a click on a post's own button cannot swap folders.
  const destOf = (o = {}) => ({ site: o.site || location.hostname, study: !!o.study, library: o.library || null });
  // After CMMNS is updated or reloaded, a page opened before keeps the old script, which
  // can no longer reach the extension. It says so instead of saving somewhere unexpected.
  const RELOAD = "CMMNS was updated. Reload this page, then save again.";
  function alive() { if (!(globalThis.chrome && chrome.runtime && chrome.runtime.id)) throw new Error(RELOAD); }
  async function viaBrowser(url, name, opts) {
    const { site, study, library } = destOf(opts.dest);
    const r = await msg({ type: "pb-qs-download", url, filename: name, site, study, library, overwrite: !!opts.overwrite, fixExt: opts.fixExt || false });
    if (!r || r.error) throw new Error(r && r.error ? r.error : "The browser did not start the download.");
    return r;
  }

  // Bytes made in the page go to the downloads as a blob address (into <save folder>/<site>/), else to
  // the worker. Never a page download link: it saves into the Downloads root (how 3.6.1 lost the folder).
  // Resolves to the name the browser wrote, which differs from `name` when that one was taken.
  async function saveBytes(bytes, mime, name, o = {}) {
    alive();
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    let r;
    try { r = await viaBrowser(url, name, o); }
    catch (e) {
      alive();
      r = await PBQuickHandoff.send(bytes, mime, { filename: name, ...destOf(o.dest), overwrite: !!o.overwrite });
      if (!r || r.error) throw new Error(r && r.error ? r.error : e.message);
    } finally { setTimeout(() => URL.revokeObjectURL(url), 120000); }
    return (r && r.filename) || name;
  }

  async function plainFile(t, plan0, c) {
    // The full-size addresses in turn (X keeps its original under one of several); a host that
    // does not let the page look first gets the first address.
    let plan = plan0, head = null;
    for (const url of [plan0.url, ...(plan0.alternatives || [])]) {
      if (head && head.cancel) head.cancel();
      head = await open(url);
      plan = { ...plan0, url };
      if (!head || !head.missing) break;
    }
    if (head && head.missing) throw new Error(`The site answered ${head.missing} for this file.`);
    try { return await fromHead(t, plan, head, c); } finally { if (head && head.cancel) head.cancel(); }
  }

  // The rest of a plain file's save, once its first 64 KB are in (head, or null when unreadable).
  async function fromHead(t, plan, head, c) {
    if (head && t.kind === "video") { const why = PB.fileProtection(head.bytes); if (why) throw new PBQuickStream.Protected(why); }
    const type = PB.chooseType({ bytes: head && head.bytes, contentType: head && head.type, url: plan.url });
    if (type.mime === "text/html") throw new Error("The address answers with a web page, not a file. The site may need you to open the post first.");
    c.meta.mediaUrl = plan.url;
    const name = c.name(type.ext, plan.url);
    // Saved from here when the words go inside the file, or when the server names another type than
    // the bytes show (a WebP sent as image/jpeg), which the browser would otherwise rename.
    const said = head && PB.chooseType({ contentType: head.type }).ext;
    const mismatch = type.from === "bytes" && said && said !== "bin" && said !== type.ext;
    // A file over EMBED_READ_MAX (a long video) is not read into the page to write the words inside it:
    // the browser downloads it at once, with its own progress, and the words stay in the sidecar. The
    // size comes from the answer's length before its body is read on. A capture
    // and a mislabelled type always read the bytes.
    const must = c.capture || mismatch, limit = must ? 0 : EMBED_READ_MAX;
    if (must || (head && c.p.mediaEmbed && EMBED.has(type.mime) && !(head.total > limit))) {
      try {
        const b = head ? await head.rest(c.progress, limit) : await bytesOf(plan.url, c.progress, limit);
        if (b && (b.bytes.length <= EMBED_MAX || must)) {
          const out = withWords(b.bytes, type.mime, c.meta, c.p);
          const written = await saveBytes(out, type.mime, name, { overwrite: c.overwrite, dest: c.dest });
          if (c.capture) await c.capture.add(written, b.bytes, out, type.mime);
          return { name: written, line: `Saved ${written}, ${size(out.length)}.` };
        }
      } catch (e) {
        // A library keeps the file unhashed rather than lose it; an evidence capture refuses it.
        if (c.capture && !c.capture.lenient) throw new Error(`The file could not be read for the capture: ${e.message}`);
        if (c.capture) c.capture.unhashed.push({ name, note: `not hashed: ${e.message}` });
        console.warn("[cmmns] could not read the file to add its description; the browser downloads it as it is", e); }
    }
    const written = (await viaBrowser(plan.url, name, { fixExt: type.from !== "bytes", overwrite: c.overwrite, dest: c.dest })).filename || name;
    return { name: written, line: `Downloading ${written}` };
  }

  const PROTECTED = "Source protection is on, so CMMNS did not download this: the request would tell the host. Use your browser's own Save as, and add the file to your case.";
  const EMBED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4"]), EMBED_MAX = 300 * 1048576, EMBED_READ_MAX = 32 * 1048576;
  async function prefs() {
    try { const k = PB.SETTINGS_KEY; return PB.normalizeSettings((await chrome.storage.local.get(k))[k]); } catch { return PB.normalizeSettings(null); }
  }
  // The post's words inside the file where its type allows, written without re-encoding.
  function withWords(bytes, mime, meta, p) {
    if (!p.mediaEmbed || !EMBED.has(mime)) return bytes;
    const creator = meta.author.handle ? `${meta.author.name ? meta.author.name + " " : ""}${/^u\//.test(meta.author.handle) ? "" : "@"}${meta.author.handle}` : meta.author.name || "";
    return PB.embedDescription(bytes, mime, { description: PB.embedText(meta), creator, source: meta.postUrl || meta.pageUrl || "" }) || bytes;
  }
  // The sidecar beside the file: the same name with .md, and .json when that setting is on.
  // For a whole gallery: one sidecar named after the post (the first file's name without "-1").
  // fileNames are the names the browser wrote. Resolves to the .md name written (o.stem rewrites it).
  // The post's comments come too, as "<stem>.thread.json" beside it (full-capture.js).
  async function sidecars(meta0, fileNames, p, o = {}) {
    const list = [].concat(fileNames), stem = o.stem || PB.sidecarStem(list);
    const meta = globalThis.PBFullCapture && (p.mediaSidecar || meta0.study || p.mediaSidecarJson) ? PBFullCapture.withFile(await PBFullCapture.complete(meta0), stem) : meta0;
    if (meta.threadCapture) await saveBytes(PBFullCapture.threadBytes(meta), "application/json", meta.threadFile, o);
    const md = p.mediaSidecar || meta.study ? await saveBytes(new TextEncoder().encode(PB.sidecarMarkdown(meta, list)), "text/markdown", stem + ".md", o) : null;
    if (p.mediaSidecarJson) await saveBytes(new TextEncoder().encode(PB.sidecarJson(meta, list)), "application/json", stem + ".json", o);
    return md;
  }
  // What the page says about media outside X and Reddit: its title, its description, the alt text.
  const pageMeta = (t) => ({ site: location.hostname.replace(/^www\./, ""), title: document.title || null, pageUrl: location.href, alt: (t.el && t.el.alt) || t.alt || null,
    text: (document.querySelector('meta[property="og:description"], meta[name="description"]') || {}).content || null });
  const metaOf = (t, opts) => PB.postMeta({ ...(t.meta || pageMeta(t)), pageUrl: location.href, mediaUrl: t.url || null, index: opts.index || 0, total: opts.total || 1, study: !!opts.study });

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

  // Files already saved (quick-saved.js), so a library of thousands keeps one copy of each. The
  // save does not wait for the list to be written.
  const { savedAs, remember, Already } = PBQuickSaved;
  // Downloads one target with its words. opts: { asGif, title, index, total, quiet, again, oneSidecar }.
  // Resolves to { line, names, meta }; with oneSidecar the caller writes one sidecar for the post.
  async function run(t, opts = {}) {
    const plan = PB.downloadPlan(t, { asGif: !!opts.asGif }), p = await prefs(), meta = metaOf(t, opts);
    if (globalThis.PBTrack) PBTrack.saved(meta);   // engagement over time (track.js): the saved post is tracked
    const dest = destOf({ site: meta.site, study: opts.study, library: opts.library });
    const title = opts.title || t.title || document.title || location.hostname;
    const own = (u) => (/^https?:/i.test(String(u || "")) ? u : "");
    // A name carries the post id (PB.postTag, or a library's own tag), so two posts never share one.
    const tagged = (n) => (opts.nameTag ? n.replace(/(\.[a-z0-9]+)$/i, `_${opts.nameTag}$1`) : n);
    const name = (ext, url) => (meta.author.handle ? PB.metaName(meta, ext, opts.nameTag || undefined) : tagged(PB.downloadName({ title, url: url != null ? url : own(t.url), index: opts.index || 0, total: opts.total || 1, ext })));
    const ow = { overwrite: !!opts.library, dest };
    const progress = (line) => toast(line, { stay: 0 });
    // Every file this save wrote, under the names the browser gave them.
    const side = (names) => (opts.oneSidecar ? null : sidecars(meta, names, p, { dest }));
    // Evidence capture: each file's hash before and after its words are written in (quick-capture.js).
    // A library passes its own collector (library.js), which keeps a file it could not hash.
    const capture = opts.capture ? PBQuickCapture.collector() : opts.collector || null;
    if (plan.action === "refuse") throw new PBQuickStream.Protected(plan.reason);
    if (plan.action === "none") throw new Error(plan.reason);
    // Source-protection mode: no request to any host. Only what the page holds (data:, blob:, a canvas) is saved.
    if (p.protection && (plan.action === "url" || plan.action === "stream" || (plan.action === "gif" && !/^(data|blob):/i.test(plan.url || "")))) throw new Error(PROTECTED);
    const key = (opts.asGif ? "gif:" : "") + (plan.url || (plan.stream && plan.stream.url) || "");
    const before = !opts.again && !opts.study && !capture && (await savedAs([key, opts.asGif ? null : own(t.url)]));
    if (before) throw new Already(before);
    if (plan.action === "url") { const r = await plainFile(t, plan, { name, meta, p, capture, overwrite: ow.overwrite, dest, progress: opts.quiet ? null : progress }); const sidecar = await side([r.name]); remember([key, own(t.url)], r.name); return { line: r.line, names: [r.name], meta, sidecar, files: capture && capture.files }; }
    let bytes, note = "", mime;
    if (plan.action === "bytes") { const b = await bytesOf(plan.url); bytes = b.bytes; mime = PB.chooseType({ bytes, contentType: b.type }).mime; }
    else if (plan.action === "canvas") { bytes = await canvasPng(t.el); mime = "image/png"; }
    else if (plan.action === "gif") { progress("Making a GIF on this device"); ({ bytes, note } = await makeGif(t, plan, progress)); mime = "image/gif"; }
    else if (plan.action === "stream") {
      progress("Putting the stream together");
      const got = await PBQuickStream.assemble(plan.stream, (d, n) => progress(`Fetching part ${d} of ${n}`), t.streams || []);
      meta.mediaUrl = plan.stream.url;
      const names = got.files.map((f) => name(PB.downloadExt(f.mime) || "bin", "").replace(/(\.[a-z0-9]+)$/i, got.files.length > 1 ? `-${f.role}$1` : "$1"));
      for (const [i, f] of got.files.entries()) { const out = withWords(f.bytes, f.mime, meta, p); names[i] = await saveBytes(out, f.mime, names[i], ow); if (capture) await capture.add(names[i], f.bytes, out, f.mime, "put together from the stream's parts"); }
      const sidecar = await side(names); remember([key], names[0]);
      return { line: `Saved ${got.files.length > 1 ? got.files.length + " files" : names[0]}, ${size(got.files.reduce((s, f) => s + f.bytes.length, 0))}.${got.note}`, names, meta, sidecar, files: capture && capture.files };
    }
    const hash = "sha256:" + (await PB.mediaSha256(bytes));
    const dup = !opts.again && !opts.study && !capture && (await savedAs([hash]));
    if (dup) throw new Already(dup);
    const out = withWords(bytes, mime, meta, p);
    const n = await saveBytes(out, mime, name(PB.downloadExt(mime) || "bin", plan.action === "bytes" && /^data:/.test(plan.url) ? "" : undefined), ow);
    if (capture) await capture.add(n, bytes, out, mime, plan.action === "gif" ? "a GIF made in the page" : plan.action === "canvas" ? "a picture of the canvas" : null);
    const sidecar = await side([n]); remember([key, hash], n);
    return { line: `Saved ${n}, ${size(out.length)}.${note}`, names: [n], meta, sidecar, files: capture && capture.files, transformed: plan.action === "gif" ? "made into a GIF in the page" : null };
  }

  // One sidecar for every file of a post saved together (the inline button on a gallery).
  async function postSidecar(meta, names) {
    const p = await prefs();
    if (names.length) await sidecars({ ...meta, item: null }, names, p, { dest: destOf({ site: meta.site, study: meta.study }) });
  }

  // A reference to protected media: the page, its title, the time and pictures the page shows in the
  // clear, kept on a moodboard with its label. Never the media itself.
  async function keepReference(t, reason) {
    if ((await prefs()).protection) throw new Error(PROTECTED);
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
    if (!(globalThis.chrome && chrome.runtime && chrome.runtime.id)) { toast(RELOAD, { tone: "no", stay: 9000 }); return { ok: false, line: RELOAD }; }
    // A whole post at once (an Instagram carousel), or a tile whose post must be opened first.
    if (globalThis.PBFullCapture && opts.total == null && !opts.asGif && t.post && t.post.items.length > 1) return PBFullCapture.saveWhole(t.post, opts);
    if (globalThis.PBFullCapture && t.open && !opts.asGif) return PBFullCapture.openAndSave(t, opts);
    toast(opts.asGif ? "Making a GIF" : "Downloading", { stay: 0 });
    try {
      const r = await run(t, opts);
      if (opts.capture) { toast("Capturing the page as evidence", { stay: 0 }); r.line = await PBQuickCapture.finish(r); if (!opts.quiet) toast(r.line, { tone: "ok", stay: 7000 }); }
      else if (opts.study && !opts.quiet && r.names && r.names.length) noteAfter(r.meta, r.names, r.sidecar);
      else if (!opts.quiet) toast(r.line, { tone: "ok" });
      return { ok: true, ...r };
    } catch (e) {
      if (e instanceof Already) {
        if (!opts.quiet) toast(e.message, { actions: [["Save again", () => start(t, { ...opts, again: true })]] });
        return { ok: true, already: true, line: e.message, names: [] };
      }
      if (e instanceof PBQuickStream.Protected) {
        toast(`Protected, can't be saved. ${e.reason}`, { tone: "no", actions: [["Save reference", () => keepReference(t, e.reason).then((l) => toast(l, { tone: "ok", stay: 7000 }), (x) => toast(`No reference kept: ${x.message}`, { tone: "no" }))]] });
        return { ok: false, protected: true, line: e.reason };
      }
      console.warn("[cmmns] download failed", e);
      toast(`Not saved: ${e.message}`, { tone: "no", stay: 7000 });
      return { ok: false, line: e.message };
    }
  }

  // After a study save: the optional line on what draws the person to it. The file is already saved;
  // a note, if typed, rewrites the sidecar in place.
  function noteAfter(meta, names, sidecar) {
    toast(`Saved for study: ${names[0]}`, { tone: "ok", stay: 6000, input: { label: "What draws you to this? (optional, Enter to keep)", onSubmit: async (note) => {
      try { await sidecars({ ...meta, studyNote: note }, names, await prefs(), { overwrite: true, stem: sidecar ? sidecar.replace(/\.md$/i, "") : null, dest: destOf({ site: meta.site, study: true }) }); toast("Note kept with the study.", { tone: "ok" }); }
      catch (e) { toast(`Note not kept: ${e.message}`, { tone: "no" }); }
    } } });
  }

  // From the right-click menu (media-bg.js). info: { srcUrl, linkUrl, asGif, study }.
  function fromMenu(info) {
    const t = PBQuickResolve.resolve(info);
    // No picture or video here: a study keeps the text post (or selection) instead.
    if (!t && info.study && globalThis.PBQuickText) return PBQuickText.run("study", info);
    if (!t) { toast("No picture, GIF or video was found under the pointer.", { tone: "no" }); return Promise.resolve({ ok: false, line: "nothing found" }); }
    return start(t, { asGif: info.asGif, study: !!info.study, capture: !!info.capture });
  }

  // A note or card made in the page (quick-text.js), to the site's folder or the study folder.
  async function saveText(bytes, mime, name, toSite, toStudy, o = {}) {
    return saveBytes(bytes, mime, name, { ...o, dest: destOf({ site: toSite, study: toStudy, library: o.library }) });
  }
  // After a text study: the same optional line, written into the note itself.
  function noteAfterText(meta, name) {
    toast(`Saved for study: ${name}`, { tone: "ok", stay: 6000, input: { label: "What draws you to this? (optional, Enter to keep)", onSubmit: async (note) => {
      try { await saveText(new TextEncoder().encode(PB.sidecarMarkdown({ ...meta, studyNote: note }, [])), "text/markdown", name, meta.site, true, { overwrite: true }); toast("Note kept with the study.", { tone: "ok" }); }
      catch (e) { toast(`Note not kept: ${e.message}`, { tone: "no" }); }
    } } });
  }

  return Object.freeze({ start, run, fromMenu, keepReference, saveBytes, metaOf, postSidecar, saveText, noteAfterText });
})();
