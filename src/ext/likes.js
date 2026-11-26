// Save all likes, in the page (project-docs/SAVE-ALL-LIKES.md). On X's likes list it reads the posts
// from X's Likes timeline responses (either auto-paginated via X's learned Likes cursor or passively
// sniffed as the user scrolls), skips duplicates by default using a persistent deduplication index
// (seenIds + content SHA-256 + media URLs) unless includeDuplicates is explicitly chosen, and saves
// files + daylight.sidecar/1 notes (and optional commons-digest/1 + engine-receipt/1 sidecars).
globalThis.PBLikes = globalThis.PBLikes || (() => {
  "use strict";
  if (!globalThis.PBQuickSites || !PBQuickSites.isX) return null;
  const KEY = "pb.likes.v1", FLUSH_LINES = 25, FLUSH_MS = 10000, WIDTH = 4, FOLDER = "x-likes";
  const listeners = [], pendingReqs = new Map();
  let run = null, state = null, flushTimer = null, flushChain = Promise.resolve(), hasLikesTemplate = false, reqSeq = 0;
  const clock = PB.stageClock();
  const manifestChunkSize = () => (globalThis.PBSettings ? PBSettings.get().likesManifestChunk : 500) || 500;
  const maxPagesSetting = () => (globalThis.PBSettings ? PBSettings.get().likesMaxPages : 0) || 0;

  const route = () => PB.likesRoute(location.href, { title: document.title, selectedTab: (document.querySelector('[role="tab"][aria-selected="true"]') || {}).textContent });
  const changed = () => { for (const f of listeners) try { f(status()); } catch (e) { console.warn("[cmmns] likes view", e); } };
  function status() {
    const c = (state && state.counts) || {}, missing = state && state.checklist.length ? PB.missingLikes(state.checklist, run ? run.known : new Set((state.ids || []).map(PB.postKey)), new Set(state.noVideo)).length : null;
    const dup = c.duplicate || 0, found = c.found || 0;
    return { status: run ? run.status : state && PB.resumable(state) ? "resumable" : "idle", mode: run ? run.mode : null,
      found, listed: c.listed || 0, saved: c.saved || 0, noVideo: c.noVideo || 0, duplicate: dup, skippedDuplicates: dup,
      totalSeen: found, failed: c.failed || 0, waiting: run ? run.queue.length + run.busy : 0, checklist: state ? state.checklist.length : 0,
      missing, why: run ? run.why : (state && state.why) || null, stoppedReason: run ? run.stoppedReason : (state && state.stoppedReason) || null,
      includeDuplicates: run ? !!run.includeDuplicates : false, canAutoPaginate: hasLikesTemplate };
  }

  async function maxDownloadManifestSeq() {
    try {
      if (!(globalThis.chrome && chrome.runtime && chrome.runtime.sendMessage)) return 0;
      const r = await chrome.runtime.sendMessage({ type: "pb-qs-max-manifest-seq" });
      return r && Number.isFinite(Number(r.maxSeq)) ? Math.max(0, Math.floor(Number(r.maxSeq))) : 0;
    } catch { return 0; }
  }

  async function load() {
    if (state) return state;
    const kept = (await chrome.storage.local.get(KEY))[KEY];
    const dedup = (await chrome.storage.local.get(PB.LIKES_DEDUP_KEY))[PB.LIKES_DEDUP_KEY];
    const storedSeq = (await chrome.storage.local.get(PB.MANIFEST_SEQ_KEY))[PB.MANIFEST_SEQ_KEY];
    const dlSeq = await maxDownloadManifestSeq();
    const manifestSeq = Math.max(0, Number(storedSeq) || 0, Number(kept && kept.manifestSeq) || 0, Number(kept && kept.part > 1 ? kept.part - 1 : 0) || 0, dlSeq);
    state = { ...PB.likesState(kept), ids: [...((kept && kept.ids) || [])], part: manifestSeq + 1, manifestSeq,
      partLines: [...((kept && kept.partLines) || [])], dedup: PB.createDedupIndex(dedup || { ids: (kept && kept.ids) || [] }),
      stoppedReason: (kept && kept.stoppedReason) || null };
    return state;
  }
  async function persist() {
    try {
      const { dedup, ...rest } = state;
      await chrome.storage.local.set({ [KEY]: { ...rest, lines: [] }, [PB.LIKES_DEDUP_KEY]: dedup.serialize(), [PB.MANIFEST_SEQ_KEY]: state.manifestSeq || 0 });
    } catch (e) { console.warn("[cmmns] likes: the record could not be kept in this browser", e); }
  }

  async function knownSet() {
    const all = await chrome.storage.local.get(null), known = new Set((state.ids || []).map(PB.postKey));
    for (const id of state.dedup.seenIds) known.add(id);
    for (const [k, v] of Object.entries(all)) {
      if (k.startsWith("pb.library.v1.") && v && Array.isArray(v.items)) for (const l of v.items) if (l && l.id) { known.add(PB.postKey(l.id)); state.dedup.add({ id: l.id }); }
    }
    for (const k of Object.keys(all["pb.saved.v1"] || {})) {
      known.add(k);
      if (k.startsWith("sha256:")) state.dedup.add({ sha256: k });
      else if (/^https?:/i.test(k)) state.dedup.add({ urls: [k] });
    }
    return known;
  }

  function noteNoVideo(id) { if (!state.noVideo.includes(id)) { state.noVideo.push(id); state.counts.noVideo++; } }

  function take(post) {
    if (!run || run.status === "stopped" || run.seen.has(post.id)) return;
    run.seen.add(post.id);
    if (!run.includeDuplicates && run.lines.has(post.id)) return;
    const t = performance.now();
    const res = PB.admitWithPolicy(state.dedup, post, { skipDuplicates: !run.includeDuplicates, includeDuplicates: run.includeDuplicates });
    const legacyKnown = !run.includeDuplicates && (PB.isKnown(run.known, post.id) || (res.line && res.line.files.length && res.line.files.every((f) => run.known.has(f.url))));
    clock.add("dedupe", performance.now() - t);
    state.counts.found++;
    if (res.action === "skip" || legacyKnown) {
      state.counts.duplicate++; run.known.add(PB.postKey(post.id)); run.lines.add(post.id);
      if (!state.ids.includes(post.id)) state.ids.push(post.id);
      changed(); return;
    }
    const line = res.line;
    run.lines.add(post.id); run.known.add(PB.postKey(post.id));
    if (!state.ids.includes(post.id)) state.ids.push(post.id);
    state.partLines.push(line); state.counts.listed++;
    state.checkpoint = { ...(state.checkpoint || {}), lastId: post.id };
    if (run.mode === "browser") { run.queue.push(line); pump(); }
    else if (PB.streamsOf(line).length) noteNoVideo(line.id);
    if (state.partLines.length % FLUSH_LINES === 0) flush();
    changed();
  }

  function askLikesPage(cursor) {
    return new Promise((resolve) => {
      const reqId = ++reqSeq;
      const timer = setTimeout(() => { pendingReqs.delete(reqId); resolve({ status: 0, error: "timeout" }); }, 20000);
      pendingReqs.set(reqId, (data) => { clearTimeout(timer); resolve(data); });
      window.postMessage({ source: "radar-ask-likes-page", reqId, cursor }, location.origin);
    });
  }

  function onMessage(e) {
    if (e.source !== window || !e.data) return;
    if (e.data.source === "radar-likes-template") { hasLikesTemplate = !!e.data.available; changed(); return; }
    if (e.data.source === "radar-likes-page" && pendingReqs.has(e.data.reqId)) {
      const fn = pendingReqs.get(e.data.reqId); pendingReqs.delete(e.data.reqId); fn(e.data); return;
    }
    if ((e.data.source !== "radar-sniff" && e.data.source !== "radar-sniff-replay") || !run || run.status === "stopped" || !route()) return;
    const t = performance.now(), posts = PB.parseLikes(e.data.json);
    clock.add("parse", performance.now() - t, Math.max(1, posts.length));
    for (const p of posts) if (p.media.length || p.text) take(p);
  }
  window.addEventListener("message", onMessage);
  window.postMessage({ source: "radar-likes-template-ask" }, location.origin);

  async function flushOnce() {
    if (!state || !state.partLines.length) return;
    const chunk = Math.max(1, manifestChunkSize());
    while (state.partLines.length) {
      const batch = state.partLines.splice(0, chunk);
      const seq = (state.manifestSeq = (Number(state.manifestSeq) || 0) + 1);
      state.part = seq + 1;
      try { await chrome.storage.local.set({ [PB.MANIFEST_SEQ_KEY]: seq }); } catch { /* best effort before write */ }
      const name = PB.manifestFilename(seq), bytes = new TextEncoder().encode(PB.manifestText(batch));
      try { await PBQuickSave.saveText(bytes, "application/x-ndjson", name, "x", false, { library: FOLDER, overwrite: false, noSaveAs: true }); }
      catch (e) {
        state.partLines.unshift(...batch);
        console.warn("[cmmns] likes: the manifest was not written", e);
        if (run) run.why = `the manifest was not written: ${e.message}`;
        break;
      }
    }
    state.checkpoint = { ...(state.checkpoint || {}), scrollY: Math.round(scrollY), status: run ? run.status : "stopped", at: new Date().toISOString() };
    await persist();
  }
  function flush() {
    flushChain = flushChain.then(flushOnce, flushOnce);
    return flushChain;
  }

  async function savePost(line) {
    const meta = { site: "x", handle: line.handle, text: line.text, postedAt: line.posted, postUrl: `https://x.com/${line.handle}/status/${line.id}`, links: line.links };
    const col = { files: [], unhashed: [], lenient: true, async add(name, original, saved) { const h = await PB.mediaSha256(saved); state.dedup.add({ id: line.id, sha256: h }); col.files.push({ name, sha256: h }); } };
    const names = [];
    for (const [index, f] of line.files.entries()) {
      const a = performance.now();
      try { const r = await PBQuickSave.run({ kind: f.kind, url: f.url, meta }, { index, total: line.files.length, oneSidecar: true, nameTag: line.id, collector: col, quiet: true, again: !!(run && run.includeDuplicates) }); names.push(...r.names); }
      catch (e) { console.warn("[cmmns] likes: a file was not saved", e); }
      clock.add("fetch", performance.now() - a);
    }
    const c = performance.now(), streams = PB.streamsOf(line).length, base = PB.likeMeta(line), mine = run;
    const record = { ...base, ...PB.sidecarRoutingMeta(base, { url: (line.files[0] && line.files[0].url) || "" }) };
    if (streams) record.notes = [...(record.notes || []), PB.noVideoNote(line)];
    const md = PB.sidecarMarkdown(record, names);
    const note = PBQuickSave.saveText(new TextEncoder().encode(md), "text/markdown", line.sidecar, "x", false, { overwrite: true })
      .then(async () => {
        clock.add("sidecar", performance.now() - c);
        if (globalThis.PBSettings && PBSettings.get().mediaSidecarReceipt) {
          const stem = line.sidecar.replace(/\.md$/, "");
          const files = col.files.map((x) => ({ rel_path: x.name, sha256: `sha256:${x.sha256}`, bytes: 0 }));
          const dg = await PB.sidecarDigest(record, { sidecarName: line.sidecar, sidecarMd: md, files });
          await PBQuickSave.saveText(new TextEncoder().encode(JSON.stringify(dg, null, 2) + "\n"), "application/json", `${stem}.digest.json`, "x", false, { overwrite: true });
        }
      }, (e) => console.warn("[cmmns] likes: a note was not written", e))
      .finally(() => mine.notes.delete(note));
    mine.notes.add(note);
    return !names.length && line.files.length ? "failed" : streams ? "noVideo" : "saved";
  }

  async function pump() {
    while (run && run.status === "running" && run.queue.length && run.busy < WIDTH) {
      const line = run.queue.shift();
      run.busy++;
      savePost(line).then((how) => { if (how === "noVideo") noteNoVideo(line.id); else state.counts[how]++; }, (e) => { state.counts.failed++; console.warn("[cmmns] likes: a post was not saved", e); })
        .finally(() => { if (run) { run.busy--; changed(); pump(); } });
    }
  }

  async function paginate(opts = {}) {
    if (!run || !hasLikesTemplate) return null;
    const savedCursor = opts.startCursor !== undefined ? opts.startCursor : (state && state.checkpoint && state.checkpoint.cursor) || null;
    const res = await PB.paginateLikes({
      fetchPage: askLikesPage,
      dedupIndex: state.dedup,
      skipDuplicates: !run.includeDuplicates,
      includeDuplicates: run.includeDuplicates,
      startCursor: savedCursor,
      maxPages: opts.maxPages ?? maxPagesSetting(),
      initialBackoffMs: opts.initialBackoffMs ?? 1500,
      maxBackoffMs: opts.maxBackoffMs ?? 60000,
      shouldPause: () => !run || run.status === "paused" || (run.queue.length + run.busy > 12),
      shouldStop: () => !run || run.status === "stopped",
      onItem: (line) => {
        if (!run || run.status === "stopped") return;
        run.seen.add(line.id); run.lines.add(line.id); run.known.add(PB.postKey(line.id));
        if (!state.ids.includes(line.id)) state.ids.push(line.id);
        state.counts.found++; state.counts.listed++; state.partLines.push(line);
        state.checkpoint = { ...(state.checkpoint || {}), lastId: line.id };
        if (run.mode === "browser") { run.queue.push(line); pump(); }
        else if (PB.streamsOf(line).length) noteNoVideo(line.id);
        if (state.partLines.length % FLUSH_LINES === 0) flush();
        changed();
      },
      onProgress: (snap) => {
        if (run) { run.stoppedReason = snap.stoppedReason; state.stoppedReason = snap.stoppedReason; }
        state.checkpoint = { ...(state.checkpoint || {}), cursor: snap.nextCursor || null };
        persist();
        changed();
      },
    });
    if (run && run.status !== "stopped") {
      run.stoppedReason = res.stoppedReason; state.stoppedReason = res.stoppedReason;
      const resumable = res.stoppedReason === "rate_limited" || res.stoppedReason === "challenge_required";
      await stop(`pagination finished (${res.stoppedReason})`, { resumable });
    }
    return res;
  }

  async function start(mode = "browser", opts = {}) {
    if (run && run.status !== "stopped") return status();
    if (!(globalThis.chrome && chrome.runtime && chrome.runtime.id)) throw new Error("CMMNS was updated. Reload this page, then start again.");
    if (!route()) throw new Error("Open your likes on X first (x.com/i/history/likes).");
    if (mode === "browser" && globalThis.PBSettings && PBSettings.get().protection) throw new Error("Source protection is on, so CMMNS does not download from X's media hosts.");
    await load();
    const defaultSkip = globalThis.PBSettings ? PBSettings.get().likesSkipDuplicates !== false : true;
    const includeDuplicates = opts.includeDuplicates === true || (opts.skipDuplicates === false);
    state.sessions.push({ started: new Date().toISOString(), mode, includeDuplicates });
    run = { mode, status: "running", known: await knownSet(), lines: new Set(state.ids), seen: new Set(), queue: [], busy: 0, notes: new Set(), why: null, stoppedReason: null, includeDuplicates: opts.includeDuplicates != null || opts.skipDuplicates != null ? includeDuplicates : !defaultSkip };
    flushTimer = setInterval(flush, FLUSH_MS);
    window.postMessage({ source: "radar-sniff-replay-ask" }, location.origin);
    await persist();
    changed();
    if (opts.autoPaginate && hasLikesTemplate) paginate(opts);
    return status();
  }
  function pause(on = true) { if (run && run.status !== "stopped") { run.status = on ? "paused" : "running"; if (!on) pump(); flush(); changed(); } return status(); }
  async function stop(why = "Stop pressed", { resumable = false } = {}) {
    if (!run || run.status === "stopped") return status();
    run.status = "stopped"; run.why = why; state.why = why; clearInterval(flushTimer);
    if (!run.stoppedReason) { run.stoppedReason = "stopped"; state.stoppedReason = "stopped"; }
    while (run.busy) await new Promise((r) => setTimeout(r, 200));
    await Promise.all([...run.notes]);
    await flush();
    state.checkpoint = { ...(state.checkpoint || {}), status: resumable ? "paused" : "stopped" };
    await persist();
    changed();
    return status();
  }

  async function importArchive(text) {
    await load();
    const list = PB.parseArchiveLikes(text);
    state.checklist = list.map((x) => x.id);
    await persist();
    changed();
    return list.length;
  }

  if (globalThis.PBSettings) PBSettings.onChange((s) => { if (s.protection && run && run.mode === "browser" && run.status !== "stopped") stop("source protection was turned on"); });
  load().then(changed, (e) => console.warn("[cmmns] likes: the record could not be read", e));
  const resumeY = () => (state && state.checkpoint && state.checkpoint.scrollY) || 0;
  return Object.freeze({ start, pause, stop, paginate, status, resumeY, route, importArchive, take, flush, canAutoPaginate: () => hasLikesTemplate, stages: () => clock.rows(), onChange: (f) => listeners.push(f), pending: () => (run ? run.queue.length + run.busy : 0) });
})();
