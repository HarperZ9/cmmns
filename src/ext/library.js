// Library capture, in the page (project-docs/LIBRARY-CAPTURE.md). While it runs, every post the page
// loads (as the user scrolls, or as auto-scroll scrolls in the builds that have it) is saved once:
// its media and a daylight.sidecar/1 note, into "<save folder>/library/<site>-<name>/", with
// index.jsonl (one line per post, the SHA-256 of each file) and LIBRARY.md. The record is kept in this
// browser (chrome.storage.local), so reopening the same page continues the same library and skips
// the posts it already holds. Saves go through PBQuickSave like any other save; nothing else is sent.
globalThis.PBLibrary = globalThis.PBLibrary || (() => {
  "use strict";
  if (!globalThis.PBQuickSites || !(PBQuickSites.isX || PBQuickSites.isReddit)) return null;
  const KEY = (folder) => "pb.library.v1." + folder, FLUSH_EVERY = 10, SKIPPED_IDS_MAX = 20000;
  const store = () => chrome.storage.local;
  const listeners = [];
  let run = null;   // the library being filled, or null

  const changed = () => { for (const f of listeners) try { f(status()); } catch (e) { console.warn("[cmmns] library view", e); } };
  function status() {
    if (!run) return { running: false };
    return { running: !run.stopped, folder: run.state.folder, label: run.state.label, saved: run.session.saved, total: run.state.items.length,
      skipped: run.skippedNow, already: run.already, queued: run.queue.length, why: run.session.why || null };
  }

  // The posts on the page now, each with what decides whether it is kept.
  // Reddit comments are collected on a user's own page, where they are that user's words.
  const nodes = () => [...document.querySelectorAll(PBQuickSites.isX ? "article" : run && run.lib.kind === "user" ? `shreddit-post, ${PBQuickSites.COMMENT}` : "shreddit-post")];
  const isComment = (node) => PBQuickSites.isReddit && node.matches(PBQuickSites.COMMENT);
  // X draws a repost with a line above it ("<name> reposted") linking to the account that reposted it.
  function repostBy(node) {
    if (!PBQuickSites.isX) return null;
    const ctx = [...node.querySelectorAll('[data-testid="socialContext"]')].find((c) => c.closest("article") === node);
    if (!ctx) return null;
    const a = ctx.closest("a[href]") || ctx.querySelector("a[href]"), h = a && (/^\/([A-Za-z0-9_]{1,15})$/.exec(a.getAttribute("href")) || [])[1];
    return h || (/repost/i.test(ctx.textContent) ? (run && run.lib.author) || "unknown" : null);
  }
  const isAd = (node) => (PBQuickSites.isX ? [...node.querySelectorAll("span")].some((s) => s.closest("article") === node && /^(Ad|Promoted)$/.test(s.textContent.trim())) : node.hasAttribute("promoted"));
  function refOf(node) {
    if (isComment(node)) {
      const c = PBQuickSites.commentMetaOf(node);
      return c ? { id: c.id, handle: c.handle, url: c.postUrl, posted: c.postedAt, promoted: false, kind: "comment", meta: c } : null;
    }
    const meta = PBQuickSites.postMetaOf(node);
    if (!meta) return null;
    const id = PBQuickSites.isX ? (/\/status\/(\d+)/.exec(meta.postUrl || "") || [])[1] : node.getAttribute("id") || (/\/comments\/(\w+)/.exec(meta.postUrl || "") || [])[1];
    const by = repostBy(node), norm = (h) => String(h || "").toLowerCase();
    const repost = !!by && norm(by) !== norm(meta.handle);
    return { id: id || null, handle: meta.handle, url: meta.postUrl, posted: meta.postedAt, promoted: isAd(node), repost, repostBy: repost ? by : null, kind: repost ? "repost" : "post", meta };
  }

  function skip(why, id) {
    if (id) { if (run.skippedIds.has(id)) return; run.skippedIds.add(id); }
    run.state.skipped[why] = (run.state.skipped[why] || 0) + 1;
    run.skippedNow++;
  }

  // New posts go into the queue once; posts already in the library are counted, not saved again.
  function scan() {
    if (!run || run.stopped) return;
    for (const node of nodes()) {
      if (run.seen.has(node)) continue;
      const ref = refOf(node);
      if (!ref) continue;   // still drawing; looked at again on the next scan
      run.seen.add(node);
      if (ref.id && (run.ids.has(ref.id) || run.queued.has(ref.id))) { if (run.ids.has(ref.id) && !run.counted.has(ref.id)) { run.counted.add(ref.id); run.already++; } continue; }
      const why = PB.librarySkip(run.lib, ref);
      if (why) { skip(why, ref.id); continue; }
      run.queued.add(ref.id);
      run.queue.push([node, ref]);
    }
    changed();
    pump();
  }

  // A collector like the evidence capture's (quick-capture.js) that keeps a file it could not hash.
  function collector() {
    const files = [];
    return { files, unhashed: files, lenient: true,
      async add(name, original, saved) { files.push({ name, sha256: await PB.mediaSha256(saved) }); } };
  }

  // One post: each picture or video, then the sidecar note listing them, then its index line.
  async function savePost(node, ref) {
    const { items, title } = ref.kind === "comment" ? { items: [], title: null } : PBQuickSites.postMedia(node), col = collector(), missing = [];
    let meta = null;
    for (const [index, t] of items.entries()) {
      try { const r = await PBQuickSave.run(t, { title, index, total: items.length, oneSidecar: true, library: run.state.folder, collector: col, nameTag: ref.id }); meta = meta || r.meta; }
      catch (e) { missing.push(`item ${index + 1} of ${items.length}: ${e.reason || e.message}`); }
    }
    meta = { ...(meta || PBQuickSave.metaOf({ meta: { ...ref.meta, kind: items.length ? "media" : "text" } }, {})), item: null };
    meta.notes = [...(meta.notes || []), ...(ref.repostBy ? [{ label: "Reposted", text: `Reposted by @${ref.repostBy}; the post above is @${ref.handle}'s.` }] : []),
      ...(ref.kind === "comment" ? [{ label: "Comment", text: `A comment in ${ref.meta.subreddit || "a subreddit"} on post ${ref.meta.parentPost || "unknown"}.` }] : []), ...labelNotes(ref.meta.fields || {})];
    const names = col.files.map((f) => f.name);
    const side = PB.metaName(meta, "md").replace(/\.md$/, `_${ref.id}.md`), bytes = new TextEncoder().encode(PB.sidecarMarkdown(meta, names));
    await PBQuickSave.saveText(bytes, "text/markdown", side, meta.site, false, { library: run.state.folder, overwrite: true });
    const files = [...col.files, { name: side, sha256: await PB.mediaSha256(bytes) }];
    return PB.libraryLine({ id: ref.id, url: ref.url, handle: ref.handle, posted: meta.postedAt, saved: new Date().toISOString(), kind: ref.kind, content: items.length ? "media" : "text", files, missing, fields: ref.meta.fields,
      repostBy: ref.repostBy, parentPost: ref.meta.parentPost, subreddit: ref.meta.subreddit });
  }

  // The labels the site put on the post, under their own headings in the note.
  function labelNotes(f) {
    return [f.community_note ? { label: "Community Note", text: f.community_note } : null, f.paid_partnership ? { label: "Paid partnership", text: "X marks this post as a paid partnership." } : null,
      f.edits ? { label: "Edited", text: `X lists ${f.edits} earlier version${f.edits === 1 ? "" : "s"} of this post.` } : null].filter(Boolean);
  }

  async function pump() {
    if (!run || run.busy) return;
    run.busy = true;
    try {
      while (run && !run.stopped && run.queue.length) {
        const [node, ref] = run.queue.shift();
        try {
          const line = await savePost(node, ref);
          run.state.items.push(line); run.ids.add(ref.id); run.session.saved++;
          if (run.session.saved % FLUSH_EVERY === 0) await flush();
          await persist();
        } catch (e) {
          console.warn("[cmmns] library: a post was not saved", e);
          skip(`not saved: ${String(e.message).slice(0, 160)}`, ref.id);
          if (/updated\. Reload this page/.test(e.message)) { await stop("CMMNS was updated; reload the page to continue"); break; }
        } finally { run && run.queued.delete(ref.id); changed(); }
      }
    } finally { if (run) run.busy = false; }
  }

  async function persist() {
    const st = run.state;
    st.skippedIds = [...run.skippedIds].slice(-SKIPPED_IDS_MAX);
    try { await store().set({ [KEY(st.folder)]: st }); } catch (e) { console.warn("[cmmns] library: the record could not be kept in this browser", e); }
  }

  // index.jsonl and LIBRARY.md, written whole each time (the browser cannot append to a file).
  async function flush() {
    const enc = (s) => new TextEncoder().encode(s), o = { library: run.state.folder, overwrite: true }, site = run.state.site;
    await PBQuickSave.saveText(enc(PB.libraryIndex(run.state)), "application/x-ndjson", "index.jsonl", site, false, o);
    await PBQuickSave.saveText(enc(PB.libraryMarkdown(run.state)), "text/markdown", "LIBRARY.md", site, false, o);
  }

  let observer = null, timer = null, queuedScan = false;
  const later = () => { if (!queuedScan) { queuedScan = true; setTimeout(() => { queuedScan = false; scan(); }, 400); } };

  // Starts (or continues) the library this page fills. mode: "collect" or "auto".
  async function start(lib, mode = "collect") {
    if (run && !run.stopped) return status();
    if (!(globalThis.chrome && chrome.runtime && chrome.runtime.id)) throw new Error("CMMNS was updated. Reload this page, then start again.");
    if (globalThis.PBSettings && PBSettings.get().protection) throw new Error("Source protection is on, so CMMNS does not download from the page's hosts.");
    const kept = (await store().get(KEY(lib.folder)))[KEY(lib.folder)] || null;
    const state = PB.libraryState(lib, kept);
    if (!state.sources.includes(location.href)) state.sources.push(location.href);
    const session = { started: new Date().toISOString(), stopped: null, saved: 0, mode, why: null };
    state.sessions.push(session);
    run = { lib, state, session, ids: new Set(state.items.map((l) => l.id)), skippedIds: new Set(state.skippedIds || []), counted: new Set(), queued: new Set(),
      seen: new WeakSet(), queue: [], busy: false, stopped: false, skippedNow: 0, already: 0 };
    await persist();
    observer = new MutationObserver(later);
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
    timer = setInterval(scan, 2000);
    scan();
    return status();
  }

  // Stops after the post being saved now, then writes index.jsonl and LIBRARY.md.
  async function stop(why = "Stop pressed") {
    if (!run || run.stopped) return status();
    run.stopped = true;
    if (observer) observer.disconnect();
    clearInterval(timer);
    while (run.busy) await new Promise((r) => setTimeout(r, 200));
    run.session.stopped = new Date().toISOString(); run.session.why = why;
    await persist();
    try { await flush(); } catch (e) { console.warn("[cmmns] library: index not written", e); run.session.why += "; index.jsonl not written: " + e.message; }
    changed();
    return status();
  }

  // Source protection turned on while a library runs: it stops, and says why.
  if (globalThis.PBSettings) PBSettings.onChange((s) => { if (s.protection && run && !run.stopped) stop("source protection was turned on"); });

  return Object.freeze({ start, stop, status, scan, onChange: (f) => listeners.push(f), pending: () => (run ? run.queue.length + (run.busy ? 1 : 0) : 0) });
})();
