// Save all likes, in the page (project-docs/SAVE-ALL-LIKES.md). On X's likes list it reads the posts
// from the responses X already sent this page (sniff.js passes them on; nothing is requested), turns
// each into one manifest line (src/core/likes.js: parse, pick, dedupe, name), and writes the manifest
// into Downloads/<save folder>/library/x-likes/ in parts of 500 lines. `cmmns likes fetch` reads it and
// fetches the files; "Save in the browser" fetches them here instead, four at a time. The run's record
// (ids, counts, checkpoint) is kept in chrome.storage.local, so a reload or a restart continues it.
globalThis.PBLikes = globalThis.PBLikes || (() => {
  "use strict";
  if (!globalThis.PBQuickSites || !PBQuickSites.isX) return null;
  const KEY = "pb.likes.v1", PART = 500, FLUSH_LINES = 25, FLUSH_MS = 10000, WIDTH = 4, FOLDER = "x-likes";
  const listeners = [];
  let run = null, state = null, flushTimer = null;
  const clock = PB.stageClock();

  const route = () => PB.likesRoute(location.href, { title: document.title, selectedTab: (document.querySelector('[role="tab"][aria-selected="true"]') || {}).textContent });
  const changed = () => { for (const f of listeners) try { f(status()); } catch (e) { console.warn("[cmmns] likes view", e); } };
  function status() {
    const c = (state && state.counts) || {}, missing = state && state.checklist.length ? PB.missingLikes(state.checklist, run ? run.known : new Set((state.ids || []).map(PB.postKey))).length : null;
    return { status: run ? run.status : state && PB.resumable(state) ? "resumable" : "idle", mode: run ? run.mode : null, found: c.found || 0, listed: c.listed || 0, saved: c.saved || 0,
      duplicate: c.duplicate || 0, failed: c.failed || 0, waiting: run ? run.queue.length + run.busy : 0, checklist: state ? state.checklist.length : 0, missing, why: run ? run.why : (state && state.why) || null };
  }

  async function load() {
    if (state) return state;
    const kept = (await chrome.storage.local.get(KEY))[KEY];
    state = { ...PB.likesState(kept), ids: [...((kept && kept.ids) || [])], part: (kept && kept.part) || 1, partLines: [...((kept && kept.partLines) || [])] };
    return state;
  }
  async function persist() {
    try { await chrome.storage.local.set({ [KEY]: { ...state, lines: [] } }); } catch (e) { console.warn("[cmmns] likes: the record could not be kept in this browser", e); }
  }

  // The dedupe set: every post id already saved here before (this run's record, libraries) and every
  // address and hash in the saved list (quick-saved.js), so a picture saved with one click is known.
  async function knownSet() {
    const all = await chrome.storage.local.get(null), known = new Set((state.ids || []).map(PB.postKey));
    for (const [k, v] of Object.entries(all)) {
      if (k.startsWith("pb.library.v1.") && v && Array.isArray(v.items)) for (const l of v.items) if (l && l.id) known.add(PB.postKey(l.id));
    }
    for (const k of Object.keys(all["pb.saved.v1"] || {})) known.add(k);
    return known;
  }

  // One post found: dedupe, then into the manifest part (and the save queue in browser mode).
  function take(post) {
    if (!run || run.status === "stopped" || run.seen.has(post.id)) return;
    run.seen.add(post.id);
    if (run.lines.has(post.id)) return;   // listed by an earlier session of this run: counted then
    const t = performance.now(), r = PB.admit(run.known, run.lines, post);
    clock.add("dedupe", performance.now() - t);
    const urlsKnown = r.kind === "new" && r.line.files.length && r.line.files.every((f) => run.known.has(f.url));
    state.counts.found++;
    // Saved before: known by its id from now on (the checklist counts it as saved), and passed over by a later session.
    if (r.kind === "duplicate" || urlsKnown) { state.counts.duplicate++; run.known.add(PB.postKey(post.id)); run.lines.add(post.id); state.ids.push(post.id); changed(); return; }
    run.lines.add(post.id); run.known.add(PB.postKey(post.id)); state.ids.push(post.id); state.partLines.push(r.line); state.counts.listed++;
    state.checkpoint = { ...(state.checkpoint || {}), lastId: post.id };
    if (run.mode === "browser") { run.queue.push(r.line); pump(); }
    if (state.partLines.length % FLUSH_LINES === 0) flush();
    changed();
  }

  // X's JSON, as sniff.js passes it on: every post it carries (parse and pick are one pass here).
  function onSniff(e) {
    if (e.source !== window || !e.data || (e.data.source !== "radar-sniff" && e.data.source !== "radar-sniff-replay") || !run || run.status === "stopped" || !route()) return;
    const t = performance.now(), posts = PB.parseLikes(e.data.json);
    clock.add("parse", performance.now() - t, Math.max(1, posts.length));
    for (const p of posts) if (p.media.length || p.text) take(p);
  }
  window.addEventListener("message", onSniff);

  // The manifest part, written whole; a full part is closed and the next begins.
  async function flush() {
    if (!state || !state.partLines.length) return;
    const name = `manifest-${String(state.part).padStart(4, "0")}.jsonl`, bytes = new TextEncoder().encode(PB.manifestText(state.partLines));
    try { await PBQuickSave.saveText(bytes, "application/x-ndjson", name, "x", false, { library: FOLDER, overwrite: true }); }
    catch (e) { console.warn("[cmmns] likes: the manifest was not written", e); if (run) run.why = `the manifest was not written: ${e.message}`; }
    if (state.partLines.length >= PART) { state.part++; state.partLines = []; }
    state.checkpoint = { ...(state.checkpoint || {}), scrollY: Math.round(scrollY), status: run ? run.status : "stopped", at: new Date().toISOString() };
    await persist();
  }

  // Browser mode: the files of each line, WIDTH at a time across posts, then one sidecar per post.
  async function savePost(line) {
    const meta = { site: "x", handle: line.handle, text: line.text, postedAt: line.posted, postUrl: `https://x.com/${line.handle}/status/${line.id}`, links: line.links };
    const col = { files: [], unhashed: [], lenient: true, async add(name, original, saved) { col.files.push({ name, sha256: await PB.mediaSha256(saved) }); } };
    const names = [];
    for (const [index, f] of line.files.entries()) {
      const a = performance.now();
      try { const r = await PBQuickSave.run({ kind: f.kind, url: f.url, meta }, { index, total: line.files.length, oneSidecar: true, nameTag: line.id, collector: col, quiet: true }); names.push(...r.names); }
      catch (e) { console.warn("[cmmns] likes: a file was not saved", e); }
      clock.add("fetch", performance.now() - a);
    }
    // The note is written without holding a save slot: the next post's files start while the browser
    // names this one (about 130 ms a note in the timing run, the slowest stage while it held the slot).
    const c = performance.now(), md = PB.sidecarMarkdown(PB.likeMeta(line), names), mine = run;
    const note = PBQuickSave.saveText(new TextEncoder().encode(md), "text/markdown", line.sidecar, "x", false, { overwrite: true })
      .then(() => clock.add("sidecar", performance.now() - c), (e) => console.warn("[cmmns] likes: a note was not written", e))
      .finally(() => mine.notes.delete(note));
    mine.notes.add(note);
    return names.length || !line.files.length;
  }
  async function pump() {
    while (run && run.status === "running" && run.queue.length && run.busy < WIDTH) {
      const line = run.queue.shift();
      run.busy++;
      savePost(line).then((ok) => { state.counts[ok ? "saved" : "failed"]++; }, (e) => { state.counts.failed++; console.warn("[cmmns] likes: a post was not saved", e); })
        .finally(() => { if (run) { run.busy--; changed(); pump(); } });
    }
  }

  // Starts or continues the run. mode: "manifest" (the command line fetches) or "browser".
  async function start(mode = "manifest") {
    if (run && run.status !== "stopped") return status();
    if (!(globalThis.chrome && chrome.runtime && chrome.runtime.id)) throw new Error("CMMNS was updated. Reload this page, then start again.");
    if (!route()) throw new Error("Open your likes on X first (x.com/i/history/likes).");
    if (mode === "browser" && globalThis.PBSettings && PBSettings.get().protection) throw new Error("Source protection is on, so CMMNS does not download from X's media hosts.");
    await load();
    state.sessions.push({ started: new Date().toISOString(), mode });
    run = { mode, status: "running", known: await knownSet(), lines: new Set(state.ids), seen: new Set(), queue: [], busy: 0, notes: new Set(), why: null };
    flushTimer = setInterval(flush, FLUSH_MS);
    window.postMessage({ source: "radar-sniff-replay-ask" }, location.origin);   // what X sent before the start
    await persist();
    changed();
    return status();
  }
  function pause(on = true) { if (run && run.status !== "stopped") { run.status = on ? "paused" : "running"; if (!on) pump(); flush(); changed(); } return status(); }
  // resumable: the run was cut short (an error X showed, the page left), so the next visit offers Resume.
  async function stop(why = "Stop pressed", { resumable = false } = {}) {
    if (!run || run.status === "stopped") return status();
    run.status = "stopped"; run.why = why; state.why = why; clearInterval(flushTimer);
    while (run.busy) await new Promise((r) => setTimeout(r, 200));
    await Promise.all([...run.notes]);
    await flush();
    state.checkpoint = { ...(state.checkpoint || {}), status: resumable ? "paused" : "stopped" };
    await persist();
    changed();
    return status();
  }

  // like.js from X's archive: the complete list of likes, kept as the checklist.
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
  return Object.freeze({ start, pause, stop, status, resumeY, route, importArchive, take, flush, stages: () => clock.rows(), onChange: (f) => listeners.push(f), pending: () => (run ? run.queue.length + run.busy : 0) });
})();
