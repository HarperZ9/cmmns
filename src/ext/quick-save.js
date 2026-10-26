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
      if (!res.ok) return { missing: res.status };
      const reader = res.body.getReader(), parts = [];
      let n = 0;
      while (n < 65536) { const { done, value } = await reader.read(); if (done) break; parts.push(value); n += value.length; }
      reader.cancel().catch(() => {});
      return { bytes: PB.concatBytes(parts).subarray(0, 65536), type: res.headers.get("content-type") || "" };
    } catch { return null; }
  }

  // The folder inside the save folder, and whether this is a study save (Daylight/study/<site>/); set per download in run().
  let site = location.hostname, study = false;
  // After Daylight Commons is updated or reloaded, a page opened before keeps the old script, which
  // can no longer reach the extension. It says so instead of saving somewhere unexpected.
  const RELOAD = "Daylight Commons was updated. Reload this page, then save again.";
  function alive() { if (!(globalThis.chrome && chrome.runtime && chrome.runtime.id)) throw new Error(RELOAD); }
  async function viaBrowser(url, name, opts) {
    const r = await msg({ type: "pb-qs-download", url, filename: name, site, study, overwrite: !!opts.overwrite, fixExt: opts.fixExt || false });
    if (!r || r.error) throw new Error(r && r.error ? r.error : "The browser did not start the download.");
    return r;
  }

  // Bytes made in the page: handed to the browser's downloads as a blob address; where the
  // browser cannot read the page's blob address, a download link in the page saves it instead.
  // Bytes made in the page go to the browser's downloads as a blob address, so they land in
  // <save folder>/<site>/. Where the browser cannot read the page's blob address, the bytes go to the
  // worker, which hands over its own. Never a download link in the page: that saves into the
  // Downloads root, which is how 3.6.1 lost the folder after an update (pages kept the old script).
  async function saveBytes(bytes, mime, name, o = {}) {
    alive();
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    try { await viaBrowser(url, name, o); }
    catch (e) {
      alive();
      const r = await msg({ type: "pb-qs-bytes", bytes: Array.from(bytes), mime, filename: name, site, study, overwrite: !!o.overwrite });
      if (!r || r.error) throw new Error(r && r.error ? r.error : e.message);
    } finally { setTimeout(() => URL.revokeObjectURL(url), 120000); }
  }

  async function plainFile(t, plan0, c) {
    // The full-size addresses in turn (X keeps its original under one of several); a host that
    // does not let the page look first gets the first address.
    let plan = plan0, head = null;
    for (const url of [plan0.url, ...(plan0.alternatives || [])]) {
      head = await probe(url);
      plan = { ...plan0, url };
      if (!head || !head.missing) break;
    }
    if (head && head.missing) throw new Error(`The site answered ${head.missing} for this file.`);
    if (head && t.kind === "video") { const why = PB.fileProtection(head.bytes); if (why) throw new PBQuickStream.Protected(why); }
    const type = PB.chooseType({ bytes: head && head.bytes, contentType: head && head.type, url: plan.url });
    if (type.mime === "text/html") throw new Error("The address answers with a web page, not a file. The site may need you to open the post first.");
    c.meta.mediaUrl = plan.url;
    const name = c.name(type.ext, plan.url);
    // Saved from here when the words go inside the file, or when the server names another type than
    // the bytes show (a WebP sent as image/jpeg), which the browser would otherwise rename.
    const said = head && PB.chooseType({ contentType: head.type }).ext;
    const mismatch = type.from === "bytes" && said && said !== "bin" && said !== type.ext;
    if (head && (mismatch || (c.p.mediaEmbed && EMBED.has(type.mime)))) {
      try {
        const b = await bytesOf(plan.url);
        if (b.bytes.length <= EMBED_MAX || mismatch) {
          const out = withWords(b.bytes, type.mime, c.meta, c.p);
          await saveBytes(out, type.mime, name);
          return { name, line: `Saved ${name}, ${size(out.length)}.` };
        }
      } catch (e) { console.warn("[daylight-commons] could not read the file to add its description; the browser downloads it as it is", e); }
    }
    await viaBrowser(plan.url, name, { fixExt: type.from !== "bytes" });
    return { name, line: `Downloading ${name}` };
  }

  const PROTECTED = "Source protection is on, so Daylight Commons did not download this: the request would tell the host. Use your browser's own Save as, and add the file to your case.";
  const EMBED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4"]), EMBED_MAX = 300 * 1048576;
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
  async function sidecars(meta, fileNames, p, o = {}) {
    const list = [].concat(fileNames), stem = list[0].replace(/\.[a-z0-9]{1,5}$/i, "").replace(list.length > 1 ? /-1$/ : /$^/, "");
    if (p.mediaSidecar || meta.study) await saveBytes(new TextEncoder().encode(PB.sidecarMarkdown(meta, list)), "text/markdown", stem + ".md", o);
    if (p.mediaSidecarJson) await saveBytes(new TextEncoder().encode(PB.sidecarJson(meta, list)), "application/json", stem + ".json", o);
  }
  // What the page says about media outside X and Reddit: its title, its description, the alt text.
  const pageMeta = (t) => ({ site: location.hostname.replace(/^www\./, ""), title: document.title || null, pageUrl: location.href, alt: (t.el && t.el.alt) || t.alt || null,
    text: (document.querySelector('meta[property="og:description"], meta[name="description"]') || {}).content || null });
  const metaOf = (t, opts) => PB.postMeta({ ...(t.meta || pageMeta(t)), pageUrl: location.href, mediaUrl: t.url || null, index: opts.index || 0, total: opts.total || 1, study: !!opts.study });

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

  // Files already saved, so a library of thousands keeps one copy of each: the direct address and,
  // for files made here, the content hash, in this browser only (chrome.storage.local).
  const SAVED = "pb.saved.v1", SAVED_MAX = 20000;
  async function savedAs(keys) {
    try { const all = (await chrome.storage.local.get(SAVED))[SAVED] || {}; const k = keys.find((x) => x && all[x]); return k ? all[k][0] : null; } catch { return null; }
  }
  async function remember(keys, name) {
    try {
      const all = (await chrome.storage.local.get(SAVED))[SAVED] || {};
      for (const k of keys.filter(Boolean)) all[k] = [name, Date.now()];
      const list = Object.entries(all);
      const kept = list.length > SAVED_MAX ? Object.fromEntries(list.sort((a, b) => b[1][1] - a[1][1]).slice(0, SAVED_MAX)) : all;
      await chrome.storage.local.set({ [SAVED]: kept });
    } catch (e) { console.warn("[daylight-commons] could not note the saved file", e); }
  }
  class Already extends Error { constructor(name) { super(`Already saved as ${name}.`); this.fileName = name; } }

  // Downloads one target with its words. opts: { asGif, title, index, total, quiet, again, oneSidecar }.
  // Resolves to { line, names, meta }; with oneSidecar the caller writes one sidecar for the post.
  async function run(t, opts = {}) {
    const plan = PB.downloadPlan(t, { asGif: !!opts.asGif }), p = await prefs(), meta = metaOf(t, opts);
    site = meta.site || location.hostname; study = !!opts.study;
    const title = opts.title || t.title || document.title || location.hostname;
    const own = (u) => (/^https?:/i.test(String(u || "")) ? u : "");
    const name = (ext, url) => (meta.author.handle ? PB.metaName(meta, ext) : PB.downloadName({ title, url: url != null ? url : own(t.url), index: opts.index || 0, total: opts.total || 1, ext }));
    const progress = (line) => toast(line, { stay: 0 });
    const side = (names) => (opts.oneSidecar ? null : sidecars(meta, names[0], p));
    if (plan.action === "refuse") throw new PBQuickStream.Protected(plan.reason);
    if (plan.action === "none") throw new Error(plan.reason);
    // Source-protection mode: no request to any host. Only what the page holds (data:, blob:, a canvas) is saved.
    if (p.protection && (plan.action === "url" || plan.action === "stream" || (plan.action === "gif" && !/^(data|blob):/i.test(plan.url || "")))) throw new Error(PROTECTED);
    const key = (opts.asGif ? "gif:" : "") + (plan.url || (plan.stream && plan.stream.url) || "");
    const before = !opts.again && !opts.study && (await savedAs([key, opts.asGif ? null : own(t.url)]));
    if (before) throw new Already(before);
    if (plan.action === "url") { const r = await plainFile(t, plan, { name, meta, p }); await side([r.name]); await remember([key, own(t.url)], r.name); return { line: r.line, names: [r.name], meta }; }
    let bytes, note = "", mime;
    if (plan.action === "bytes") { const b = await bytesOf(plan.url); bytes = b.bytes; mime = PB.chooseType({ bytes, contentType: b.type }).mime; }
    else if (plan.action === "canvas") { bytes = await canvasPng(t.el); mime = "image/png"; }
    else if (plan.action === "gif") { progress("Making a GIF on this device"); ({ bytes, note } = await makeGif(t, plan, progress)); mime = "image/gif"; }
    else if (plan.action === "stream") {
      progress("Putting the stream together");
      const got = await PBQuickStream.assemble(plan.stream, (d, n) => progress(`Fetching part ${d} of ${n}`), t.streams || []);
      meta.mediaUrl = plan.stream.url;
      const names = got.files.map((f) => name(PB.downloadExt(f.mime) || "bin", "").replace(/(\.[a-z0-9]+)$/i, got.files.length > 1 ? `-${f.role}$1` : "$1"));
      for (const [i, f] of got.files.entries()) await saveBytes(withWords(f.bytes, f.mime, meta, p), f.mime, names[i]);
      await side(names); await remember([key], names[0]);
      return { line: `Saved ${got.files.length > 1 ? got.files.length + " files" : names[0]}, ${size(got.files.reduce((s, f) => s + f.bytes.length, 0))}.${got.note}`, names, meta };
    }
    const hash = "sha256:" + (await PB.mediaSha256(bytes));
    const dup = !opts.again && !opts.study && (await savedAs([hash]));
    if (dup) throw new Already(dup);
    const n = name(PB.downloadExt(mime) || "bin", plan.action === "bytes" && /^data:/.test(plan.url) ? "" : undefined);
    const out = withWords(bytes, mime, meta, p);
    await saveBytes(out, mime, n);
    await side([n]); await remember([key, hash], n);
    return { line: `Saved ${n}, ${size(out.length)}.${note}`, names: [n], meta };
  }

  // One sidecar for every file of a post saved together (the inline button on a gallery).
  async function postSidecar(meta, names) {
    const p = await prefs();
    if (names.length) await sidecars({ ...meta, item: null }, names, p);
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
    toast(opts.asGif ? "Making a GIF" : "Downloading", { stay: 0 });
    try {
      const r = await run(t, opts);
      if (opts.study && !opts.quiet && r.names && r.names.length) noteAfter(r.meta, r.names);
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
      console.warn("[daylight-commons] download failed", e);
      toast(`Not saved: ${e.message}`, { tone: "no", stay: 7000 });
      return { ok: false, line: e.message };
    }
  }

  // After a study save: the optional line on what draws the person to it. The file is already saved;
  // a note, if typed, rewrites the sidecar in place.
  function noteAfter(meta, names) {
    toast(`Saved for study: ${names[0]}`, { tone: "ok", stay: 6000, input: { label: "What draws you to this? (optional, Enter to keep)", onSubmit: async (note) => {
      study = true; site = meta.site || location.hostname;
      try { await sidecars({ ...meta, studyNote: note }, names, await prefs(), { overwrite: true }); toast("Note kept with the study.", { tone: "ok" }); }
      catch (e) { toast(`Note not kept: ${e.message}`, { tone: "no" }); }
    } } });
  }

  // From the right-click menu (media-bg.js). info: { srcUrl, linkUrl, asGif, study }.
  function fromMenu(info) {
    const t = PBQuickResolve.resolve(info);
    // No picture or video here: a study keeps the text post (or selection) instead.
    if (!t && info.study && globalThis.PBQuickText) return PBQuickText.run("study", info);
    if (!t) { toast("No picture, GIF or video was found under the pointer.", { tone: "no" }); return Promise.resolve({ ok: false, line: "nothing found" }); }
    return start(t, { asGif: info.asGif, study: !!info.study });
  }

  // A note or card made in the page (quick-text.js), saved to the site's folder or the study folder.
  async function saveText(bytes, mime, name, toSite, toStudy, o = {}) {
    site = toSite || location.hostname; study = !!toStudy;
    return saveBytes(bytes, mime, name, o);
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
