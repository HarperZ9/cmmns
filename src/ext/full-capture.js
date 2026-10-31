// Whole saves: every save brings the post's whole body and its parts. Before a post's sidecar is
// written, its comments are read from the page (capture-sites.js) and, on the post's own page, more
// are opened at a person's pace: one "more replies" control or one scroll, then a wait of 1.2 to 3 s,
// up to the cap the user set (threadCap), with Stop on the notice. The comments go beside the sidecar
// as "<stem>.thread.json", a tree with a completeness block (src/core/capture-thread.js), so a short
// capture says how short it is. Nothing here makes a request: the page asks its own site for more
// comments when its own control is pressed, and source protection holds that off. An Instagram tile
// that shows only a thumbnail is saved by opening its post in a background tab (capture-open-bg.js).
globalThis.PBFullCapture = globalThis.PBFullCapture || (() => {
  "use strict";
  const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const toast = (t, o) => (globalThis.PBQuickToast ? PBQuickToast.show(t, o) : null);
  // Tests set __cmmnsPaceMs to run the same steps without the person-paced wait.
  const pace = (n) => (Number.isFinite(globalThis.__cmmnsPaceMs) ? globalThis.__cmmnsPaceMs : PB.expandPace(Math.random, n));
  async function prefs() {
    try { const k = PB.SETTINGS_KEY; return PB.normalizeSettings((await chrome.storage.local.get(k))[k]); } catch { return PB.normalizeSettings(null); }
  }

  // Opens more of the thread, one step at a time, until the cap, the end, three steps that added
  // nothing, or Stop. Returns the last reading and how many controls were opened.
  async function expand(read, got, cap) {
    const clicked = new WeakSet(), y = scrollY;
    let expanded = 0, idle = 0, stop = false;
    for (let step = 0; step < 400 && !stop; step++) {
      const before = got.comments.length;
      if (before >= cap) break;
      const stub = got.stubs.find((b) => !clicked.has(b));
      if (stub) { clicked.add(stub); stub.click(); expanded++; }
      else if (got.scroll && (got.expected == null || before < Number(got.expected))) window.scrollBy({ top: Math.round(innerHeight * 0.8) });
      else break;
      toast(`Loading more comments: ${before}${got.expected != null ? ` of ${got.expected}` : ""}, up to ${cap}`, { stay: 0, actions: [["Stop", () => { stop = true; }]] });
      await sleep(pace(step));
      got = read();
      idle = got.comments.length === before ? idle + 1 : 0;
      if (idle >= 3) break;
    }
    if (got.scroll) window.scrollTo({ top: y });
    return { got, expanded, stopped: stop };
  }

  async function capture(meta, p) {
    const read = () => PBCaptureSites.read(meta);
    let got = read();
    if (!got) return null;
    const cap = p.threadCap;
    let expanded = 0, reason = null;
    const can = got.own && p.threadExpand && cap > 0 && !p.protection;
    if (can) { const r = await expand(read, got, cap); got = r.got; expanded = r.expanded; if (r.stopped) reason = "Stop was pressed"; }
    else if (got.own && p.protection) reason = "source protection is on, so no more comments were loaded";
    else if (got.own && (!p.threadExpand || cap === 0)) reason = "loading more comments is off in the settings";
    else if (!got.own && !got.comments.length) reason = "the comments were not on this page; open the post's own page to save them";
    const n = got.comments.length, open = got.stubs.length + (got.away || 0);
    if (!n && got.expected == null && !open && !got.own) return null;
    const capHit = can && n >= cap && (open > 0 || (got.expected != null && n < Number(got.expected)) || (got.scroll && got.expected == null));
    return PB.captureThread({ site: meta.site, post: { url: meta.postUrl, id: PB.postTag(meta) }, comments: got.comments, expected: got.expected, cap, capHit, stubs: open, expanded, source: got.source, reason });
  }

  // One reading per post while it runs and for a few seconds after, so the files of one post saved
  // together never open the thread twice.
  const memo = new Map();
  async function complete(meta) {
    if (!meta || meta.threadCapture || !meta.postUrl || !globalThis.PBCaptureSites) return meta;
    const p = await prefs();
    if (!p.threadCapture) return meta;
    const key = `${meta.site} ${meta.postUrl}`, had = memo.get(key);
    let m = had && (!had.done || Date.now() - had.done < 5000) ? had : null;
    if (!m) {
      m = { done: 0, promise: capture(meta, p).catch((e) => { console.warn("[cmmns] could not read the post's comments", e); return null; }) };
      m.promise.then(() => { m.done = Date.now(); });
      memo.set(key, m);
    }
    const t = await m.promise;
    return t ? { ...meta, threadCapture: t } : meta;
  }
  const withFile = (meta, stem) => (meta.threadCapture ? { ...meta, threadFile: stem + ".thread.json" } : meta);
  const threadBytes = (meta) => new TextEncoder().encode(PB.threadFileJson(meta.threadCapture));

  // Every file of a post (an Instagram carousel), then one sidecar for the post.
  async function saveWhole(post, opts = {}) {
    const items = post.items, names = [];
    let meta = null, ok = 0, last = "";
    if (!opts.quiet) toast(`Downloading ${items.length} files`, { stay: 0 });
    for (const [index, t] of items.entries()) {
      const r = await PBQuickSave.start(t, { ...opts, title: post.title, index, total: items.length, quiet: true, oneSidecar: true });
      if (r.ok) ok++; else last = r.line || "";
      names.push(...(r.names || [])); meta = meta || r.meta || null;
    }
    if (meta) await PBQuickSave.postSidecar({ ...meta, study: !!opts.study }, names);
    const line = ok === items.length ? `Saved all ${items.length} files of the post.` : `Saved ${ok} of ${items.length} files. ${last}`;
    if (!opts.quiet) toast(line, { tone: ok === items.length ? "ok" : "no" });
    return { ok: ok > 0, names, meta, line };
  }

  // A tile with only a thumbnail: the post opened in a background tab and saved there whole. If that
  // fails, the thumbnail is saved with a note that says it is not the whole post, and why.
  async function openAndSave(t, opts = {}) {
    if ((await prefs()).protection) return PBQuickSave.start({ ...t, open: null }, opts);
    toast("Opening the post to save it whole", { stay: 0 });
    let r = null;
    try { r = await chrome.runtime.sendMessage({ type: "pb-cap-open", url: t.open, shortcode: t.shortcode, study: !!opts.study }); } catch (e) { r = { error: e.message }; }
    if (r && r.ok) { if (!opts.quiet) toast(r.line, { tone: "ok" }); return { ok: true, names: r.names || [], line: r.line }; }
    const why = (r && r.error) || "the post did not open";
    const note = { label: "Not the whole post", text: `This page showed only a thumbnail, and the post could not be opened to save it whole (${why}). The post: ${t.open}` };
    return PBQuickSave.start({ ...t, open: null, meta: { ...t.meta, notes: [...((t.meta && t.meta.notes) || []), note] } }, opts);
  }

  // In the background tab: wait for the post's data, save it whole, answer with what was saved.
  if (globalThis.chrome && chrome.runtime && chrome.runtime.onMessage && globalThis.PBQuickInstagram) {
    chrome.runtime.onMessage.addListener((m, sender, reply) => {
      if (!m || m.type !== "pb-cap-save") return false;
      (async () => {
        const p = await PBQuickInstagram.whenPost(m.shortcode);
        if (!p) return { error: "the post's data did not arrive in the opened tab" };
        const post = PBQuickInstagram.postMedia(m.shortcode);
        const r = post.items.length > 1 ? await saveWhole(post, { study: !!m.study, quiet: true }) : await PBQuickSave.start(post.items[0], { title: post.title, study: !!m.study, quiet: true });
        return r.ok ? { ok: true, names: r.names || [], line: r.line || `Saved ${post.title}` } : { error: r.line || "not saved" };
      })().then(reply, (e) => reply({ error: e.message }));
      return true;
    });
  }

  return Object.freeze({ complete, withFile, threadBytes, saveWhole, openAndSave, capture });
})();
