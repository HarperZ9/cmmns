// The convert page: a file from Collections (convert.html#<item id>) or from this computer, the
// formats that suit its kind, then a local conversion (convert-image.js, convert-video.js,
// convert-audio.js) with the size before and after, both hashes and the lineage step. A file from
// a collection gets its copy saved beside it with the chain back to the original.
(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const { el } = PBPages;
  const FORMATS = {
    image: [["webp", "WebP"], ["jpeg", "JPEG"], ["png", "PNG"], ["avif", "AVIF"]],
    gif: [["mp4", "MP4 video (H.264)"], ["webm", "WebM video (VP9)"], ["webp", "WebP still, first frame"], ["png", "PNG still, first frame"]],
    video: [["webm", "WebM (VP9 and Opus)"], ["mp4", "MP4 (H.264 and AAC or Opus)"]],
    audio: [["webm", "Opus in WebM"], ["ogg", "Opus in Ogg"]],
  };
  const state = { rec: null, blob: null, bytes: null, sha256: null, out: null, lineage: null };
  const status = (t) => { $("status").textContent = t; };
  const facts = (box, rows) => box.replaceChildren(...rows.flatMap(([k, v]) => [el("dt", {}, k), el("dd", { class: /SHA/.test(k) ? "mono" : "" }, String(v))]));

  async function show(blob, rec) {
    state.blob = blob; state.rec = rec; state.bytes = new Uint8Array(await blob.arrayBuffer());
    state.sha256 = rec ? rec.sha256 : await PB.mediaSha256(state.bytes);
    const kind = PB.isGif(state.bytes) ? "gif" : (rec && rec.kind) || PB.mediaKindOf(blob.type, blob.name || "") || "image";
    state.kind = kind;
    facts($("source"), [["Name", rec ? PB.fileNameFor(rec) : blob.name || "file"], ["Kind", `${kind}, ${blob.type || "unknown type"}`], ["Size", PB.sizeText(state.bytes.length)], ["SHA-256", state.sha256],
      ...(rec ? [["Collection", rec.collection.type === "case" ? "Investigation case" : "Moodboard"], ["Steps so far", (rec.lineage || []).map((l) => l.op).join(", ") || "none, this is the original"]] : [])]);
    $("to").replaceChildren(...FORMATS[kind].map(([v, t]) => el("option", { value: v }, t)));
    for (const x of document.querySelectorAll("[data-for]")) x.hidden = !x.dataset.for.split(" ").includes(kind === "gif" && ["webp", "png"].includes($("to").value) ? "image" : kind);
    $("options-box").hidden = false; $("result-box").hidden = true;
    const w = await PBConvertImage.writable().catch(() => ({}));
    $("caps").textContent = `This browser writes ${Object.entries(w).filter(([, ok]) => ok).map(([k]) => k.toUpperCase()).join(", ") || "no"} images${typeof VideoEncoder === "undefined" ? ", and has no video encoder" : ", and encodes video with WebCodecs"}.`;
  }
  $("to").addEventListener("change", () => { if (state.kind) for (const x of document.querySelectorAll("[data-for]")) x.hidden = !x.dataset.for.split(" ").includes(state.kind === "gif" && ["webp", "png"].includes($("to").value) ? "image" : state.kind); });
  $("quality").addEventListener("input", () => { $("quality-out").textContent = Number($("quality").value).toFixed(2); });

  async function run() {
    const to = $("to").value, k = state.kind, n = (id) => Number($(id).value);
    if (k === "image" || (k === "gif" && ["webp", "png"].includes(to))) return { ...(await PBConvertImage.convert(state.blob, { to, quality: n("quality"), maxSide: n("maxSide") })), tool: "browser canvas encoder" };
    if (k === "gif") return { ...(await PBConvertVideo.fromGif(state.bytes, { to, maxHeight: n("maxHeight"), bitrate: n("bitrate") }, status)), tool: "CMMNS GIF decoder, WebCodecs VideoEncoder, CMMNS muxer" };
    if (k === "video") return { ...(await PBConvertVideo.fromVideo(state.blob, state.bytes, { to, maxHeight: n("maxHeight"), bitrate: n("bitrate"), fps: n("fps"), audioBitrate: n("audioBitrate") }, status)), tool: "WebCodecs VideoEncoder and AudioEncoder, CMMNS muxer" };
    return { ...(await PBConvertAudio.convert(state.bytes, { to, bitrate: n("audioBitrate") }, status)), tool: "WebCodecs AudioEncoder, CMMNS muxer" };
  }

  async function finish(out) {
    const sha256 = await PB.mediaSha256(out.bytes), now = new Date().toISOString();
    const op = out.bytes.length < state.bytes.length && out.mime === (state.blob.type || out.mime) ? "compress" : "convert";
    const parent = state.rec || PB.savedRecord({ bytes: state.bytes.length, mime: state.blob.type, url: null, pageTitle: state.blob.name || null }, { sha256: state.sha256, collection: { type: "moodboard", id: "local-file" }, now });
    const rec = PB.derivedRecord(parent, { bytes: out.bytes.length, mime: out.mime, sha256, step: { op, params: out.params, tool: out.tool }, now });
    if (state.rec) await PBMediaStore.put(rec, new Blob([out.bytes], { type: out.mime }));
    state.out = out; state.lineage = { format: "daylight-lineage/1", original: rec.original, file: { sha256, bytes: out.bytes.length, mime: out.mime }, steps: rec.lineage };
    $("size").textContent = `Size: ${PB.sizeLine(state.bytes.length, out.bytes.length)}.`;
    facts($("result"), [["Format", out.mime], ["SHA-256 of the original", rec.original], ["SHA-256 of the new file", sha256], ["Step", `${op}, ${JSON.stringify(out.params)}`], ["Made with", out.tool],
      ["Kept", state.rec ? "in the same collection, beside the original" : "nowhere yet: download it, the original was not in a collection"]]);
    const a = $("download");
    if (a.dataset.url) URL.revokeObjectURL(a.dataset.url);
    a.dataset.url = a.href = URL.createObjectURL(new Blob([out.bytes], { type: out.mime }));
    a.download = PB.fileNameFor({ source: { url: state.rec && state.rec.source.url ? state.rec.source.url : "https://local/" + (state.blob.name || "file") }, sha256, mime: out.mime });
    const kind = out.mime.split("/")[0], p = el(kind === "image" ? "img" : kind, kind === "image" ? { alt: "The converted file" } : { controls: "" });
    p.src = a.href;
    $("preview").replaceChildren(p);
    $("result-box").hidden = false;
  }

  $("go").addEventListener("click", async () => {
    $("go").disabled = true;
    status("Working on this device.");
    const t0 = performance.now();
    try { await finish(await run()); status(`Done in ${((performance.now() - t0) / 1000).toFixed(1)} s.`); }
    catch (e) { status(`Not converted: ${e.message}`); console.warn("[cmmns] convert failed", e); }
    finally { $("go").disabled = false; }
  });
  $("lineage").addEventListener("click", () => {
    if (!state.lineage) return;
    const a = el("a", { download: `lineage-${state.lineage.file.sha256.slice(0, 12)}.json` });
    a.href = URL.createObjectURL(new Blob([JSON.stringify(state.lineage, null, 2) + "\n"], { type: "application/json" }));
    a.click();
  });
  const pickFile = (f) => f && show(f, null).catch((e) => status(e.message));
  $("file").addEventListener("change", () => pickFile($("file").files[0]));
  $("drop").addEventListener("dragover", (e) => e.preventDefault());
  $("drop").addEventListener("drop", (e) => { e.preventDefault(); pickFile(e.dataTransfer.files[0]); });

  const id = decodeURIComponent(location.hash.slice(1));
  if (id) {
    const rec = await PBMediaStore.item(id), blob = rec && (await PBMediaStore.blob(rec.sha256));
    if (rec && blob) await show(blob, rec); else facts($("source"), [["Not found", "That item is not in your collections any more."]]);
  }
  globalThis.PBConvertPage = Object.freeze({ show });
})().catch((e) => console.error("[cmmns] convert page failed", e));
