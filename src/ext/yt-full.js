// YouTube: "Save video in full". One save keeps the watch page's reference (thumbnail and note), the
// transcript as timestamped lines and as plain paragraphs, the chapters and metadata
// ("<stem>.video.json", cmmns.video/1), the comment tree with replies and like counts
// ("<stem>.thread.json"), and the save's "<stem>.SOURCE.txt" and "<stem>.SHA256SUMS". Everything
// comes from what the page loaded for the viewer (ytsniff.js passes the page's own data on) or drew;
// CMMNS makes no request of its own. When the page has no transcript open, its own "Show transcript"
// control is pressed once, as a person would, unless source protection is on.
// The media file is the user's choice on each save. Builds that carry the command line hand-off
// (yt-handoff.js) offer to copy the command that saves it beside the bundle; store builds do not
// save YouTube video files. The file is a local research copy and is never uploaded or shared.
globalThis.PBYtFull = globalThis.PBYtFull || (() => {
  "use strict";
  const isYouTube = /(^|\.)youtube\.com$/.test(location.hostname);
  const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const toast = (t, o) => PBQuickToast.show(t, o);
  const enc = (s) => new TextEncoder().encode(s);
  const vid = () => (globalThis.PBYouTube ? PBYouTube.videoId() : null);

  // The page's own data, kept per video for the last few videos. YouTube swaps videos without a
  // reload, so each answer is filed under the video the page shows when it arrives.
  const payloads = new Map(), PER_VIDEO = 80, VIDEOS = 4;
  function keep(json) {
    const id = vid();
    if (!id || !json) return;
    const list = payloads.get(id) || [];
    list.push(json);
    while (list.length > PER_VIDEO) list.shift();
    payloads.delete(id); payloads.set(id, list);
    while (payloads.size > VIDEOS) payloads.delete(payloads.keys().next().value);
  }
  if (isYouTube) window.addEventListener("message", (e) => { if (e.source === window && e.data && e.data.source === "radar-yt") keep(e.data.json); });
  const dataOf = (id) => payloads.get(id) || [];

  // The comments the page received for this video, for capture-sites.js.
  const pageComments = (id) => dataOf(id).flatMap((j) => { try { return PB.pageComments(j, id); } catch { return []; } });

  const panelLines = () => [...document.querySelectorAll("ytd-transcript-segment-renderer")].map((s) => {
    const t = s.querySelector(".segment-timestamp"), w = s.querySelector(".segment-text");
    return w && w.innerText ? `${t && t.innerText ? t.innerText.trim() + " " : ""}${w.innerText.trim()}` : null;
  }).filter(Boolean);
  function readTranscript(id) {
    const data = dataOf(id).flatMap((j) => PB.dataSegments(j));
    if (data.length) return { segs: data, from: "the transcript data the page received" };
    const shown = PB.panelSegments(panelLines());
    return shown.length ? { segs: shown, from: "the transcript panel the page showed" } : null;
  }
  // The transcript: what the page has, else its own "Show transcript" control pressed once.
  async function transcript(id, p) {
    const now = readTranscript(id);
    if (now) return now;
    if (p.protection) return { segs: [], why: "source protection is on, so the transcript panel was not opened" };
    const btn = document.querySelector("ytd-video-description-transcript-section-renderer button, button[aria-label='Show transcript']");
    if (!btn) return { segs: [], why: "this video's page offers no transcript" };
    btn.click();
    for (let i = 0; i < 20; i++) { await sleep(500); const got = readTranscript(id); if (got) return got; }
    return { segs: [], why: "the transcript panel opened but showed no lines within 10 seconds" };
  }

  function chapters(id) {
    const data = dataOf(id).flatMap((j) => PB.dataChapters(j));
    if (data.length) return [...new Map(data.map((c) => [`${c.start} ${c.title}`, c])).values()].sort((a, b) => a.start - b.start);
    return (PBYouTube.chapters() || []).map((l) => { const m = /^(\S+)\s+(.+)$/.exec(l); return m ? { start: PB.secondsOf(m[1]) ?? 0, title: m[2] } : null; }).filter(Boolean);
  }
  function pageInfo(id) {
    let out = null;
    for (const j of dataOf(id)) { const v = PB.ytVideoInfo(j); if (v && (!v.videoId || v.videoId === id)) out = { ...(out || {}), ...v }; }
    return out;
  }

  // The bundle's own files beside the reference, named after its note. Returns [{ name, bytes }].
  async function writeExtras(id, stem, site, meta, tr, saved) {
    const put = async (name, text, mime) => { const b = enc(text); saved.push({ name: await PBQuickSave.saveText(b, mime, name, site, false), bytes: b }); };
    if (tr.segs.length) { await put(`${stem}.transcript.txt`, PB.timedTranscript(tr.segs), "text/plain"); await put(`${stem}.transcript.plain.txt`, PB.plainTranscript(tr.segs), "text/plain"); }
    const info = pageInfo(id) || {};
    const rec = PB.videoRecord({ id, url: `https://www.youtube.com/watch?v=${id}`, title: meta.title, channel: meta.author && meta.author.name, handle: meta.author && meta.author.handle,
      channelUrl: info.channelUrl ? `https://www.youtube.com${info.channelUrl}` : null, published: info.published || meta.postedAt, views: info.views, description: meta.text,
      chapters: chapters(id), captions: tr.segs.length ? { lang: null, kind: null, from: tr.from } : null, segments: tr.segs.length, info, source: "the watch page", tool: "CMMNS extension" });
    await put(`${stem}.video.json`, JSON.stringify(rec, null, 2) + "\n", "application/json");
    const names = saved.map((f) => f.name);
    await put(`${stem}.SOURCE.txt`, PB.sourceText({ url: rec.url, title: rec.title, channel: rec.channel, savedAt: rec.savedAt, files: names,
      how: `CMMNS extension, from what the watch page loaded and showed; transcript ${tr.segs.length ? `from ${tr.from}` : `not saved (${tr.why})`}. SHA256SUMS covers every file listed here except files the browser downloaded directly from their address`, media: null }), "text/plain");
    const sums = await Promise.all(saved.map(async (f) => ({ name: f.name, sha256: await PB.mediaSha256(f.bytes) })));
    await PBQuickSave.saveText(enc(PB.sha256Sums(sums)), "text/plain", `${stem}.SHA256SUMS`, site, false);
    return saved.length + 1;
  }

  // The media file, asked on each save. Only builds with the command line hand-off can save it.
  function askMedia(stem, line) {
    const handoff = globalThis.PBYtHandoff && PBYtHandoff.runFor;
    if (!handoff) { toast(`${line} This build does not save YouTube video files; the command line does (cmmns media fetch --full).`, { tone: "ok", stay: 9000 }); return; }
    toast(`${line} Save the video file too? It stays on this computer as a research copy.`, { tone: "ok", stay: 0,
      actions: [["Copy the command for the video file", () => PBYtHandoff.runFor(stem)], ["Not this time", () => toast("Saved without the video file.", { tone: "ok" })]] });
  }

  async function save() {
    const id = vid();
    if (!id) { toast("Open a video's own page to save it in full.", { tone: "no" }); return { ok: false }; }
    let p;
    try { const k = PB.SETTINGS_KEY; p = PB.normalizeSettings((await chrome.storage.local.get(k))[k]); } catch { p = PB.normalizeSettings(null); }
    toast("Saving the video in full: transcript, chapters, comments", { stay: 0 });
    const tr = await transcript(id, p);
    const ref = PBYouTube.reference(), saved = [];
    const r = await PBQuickSave.start(ref, { title: ref.title, collect: saved, quiet: true, again: true });
    if (!r.ok || !(r.names || []).length) { toast(`Not saved: ${r.line || "the reference could not be saved"}`, { tone: "no", stay: 7000 }); return { ok: false, line: r.line }; }
    const stem = (r.sidecar || r.names[0]).replace(/\.[^.]+$/, "");
    try {
      const n = await writeExtras(id, stem, (r.meta && r.meta.site) || "youtube", r.meta || ref.meta, tr, saved);
      askMedia(stem, `Saved the video in full: ${n + r.names.filter((x) => !saved.some((f) => f.name === x)).length} files${tr.segs.length ? "" : `, no transcript (${tr.why})`}.`);
      return { ok: true, stem, files: saved.map((f) => f.name), transcript: tr.segs.length };
    } catch (e) { console.warn("[cmmns] the full save stopped part way", e); toast(`Saved the reference, but not every file: ${e.message}`, { tone: "no", stay: 9000 }); return { ok: false, line: e.message }; }
  }

  const MENU = ["ytfull", "Save video in full"];
  return Object.freeze({ isYouTube, save, pageComments, transcript, chapters, MENU });
})();
