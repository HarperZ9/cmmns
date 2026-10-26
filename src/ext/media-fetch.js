// Fetches a file the page loaded, or assembles an unencrypted HLS or DASH stream from its segments,
// for the save page. Runs only after the user's click on Save, and only from hosts the user granted
// for that save. Protected media is refused before any segment is fetched: an encrypted manifest,
// a DRM key system, or an encryption box in the file itself. Uses PB (core.bundle.js).
globalThis.PBMediaFetch = (() => {
  "use strict";
  const TIMEOUT_MS = 30000, PARALLEL = 4, MAX_BYTES = 1536 * 1048576;

  class NeedsAccess extends Error { constructor(origins) { super("needs access to " + origins.join(", ")); this.origins = origins; } }
  class Protected extends Error { constructor(reason) { super(reason); this.reason = reason; } }

  const originOf = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? `${x.protocol}//${x.host}/*` : null; } catch { return null; } };
  const has = (origins) => (origins.length ? chrome.permissions.contains({ origins }) : Promise.resolve(true));
  async function ensure(urls) {
    const origins = [...new Set(urls.map(originOf).filter(Boolean))];
    const missing = [];
    for (const o of origins) if (!(await has([o]))) missing.push(o);
    if (missing.length) throw new NeedsAccess(missing);
  }

  async function get(url, range, as = "bytes") {
    // Source-protection mode: no request to any host. Only what the page holds in memory is read.
    if (globalThis.PBSettings && PBSettings.get().protection && !/^(data|blob):/i.test(url)) throw new Error(`Source-protection mode is on, so Daylight Commons did not download this again from ${new URL(url).host}: that request would tell the host. Save it with your browser's own Save as, then add the file to the case.`);
    const headers = range ? { Range: `bytes=${range.offset}-${range.offset + range.length - 1}` } : {};
    const res = await fetch(url, { headers, credentials: "include", signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
    if (as === "text") return { text: await res.text(), type: res.headers.get("content-type") || "" };
    return { bytes: new Uint8Array(await res.arrayBuffer()), type: (res.headers.get("content-type") || "").split(";")[0].trim() };
  }

  // Every segment in order, PARALLEL at a time, as one byte array.
  async function segments(list, onProgress) {
    await ensure(list.map((s) => s.url));
    const out = new Array(list.length);
    let next = 0, done = 0, total = 0;
    async function worker() {
      while (next < list.length) {
        const i = next++;
        out[i] = (await get(list[i].url, list[i].range)).bytes;
        total += out[i].length;
        if (total > MAX_BYTES) throw new Error("The stream is larger than 1.5 GB, more than Daylight Commons saves in a browser. Use a smaller quality.");
        if (onProgress) onProgress(++done, list.length);
      }
    }
    await Promise.all(Array.from({ length: Math.min(PARALLEL, list.length) }, worker));
    return PB.concatBytes(out);
  }

  async function hls(url, { maxHeight, onProgress }) {
    await ensure([url]);
    let pl = PB.parseM3u8((await get(url, null, "text")).text, url);
    if (!pl) throw new Error("The address did not answer with an HLS playlist.");
    let reason = PB.hlsProtection(pl), audio = null, variant = null;
    if (reason) throw new Protected(reason);
    if (pl.kind === "master") {
      variant = PB.pickVariant(pl, { maxHeight });
      const a = PB.audioFor(pl, variant);
      if (a) audio = a.url;
      await ensure([variant.url]);
      pl = PB.parseM3u8((await get(variant.url, null, "text")).text, variant.url);
      if ((reason = PB.hlsProtection(pl))) throw new Protected(reason);
    }
    const parts = [await hlsPart(pl, "video", onProgress)];
    if (audio) {
      await ensure([audio]);
      const ap = PB.parseM3u8((await get(audio, null, "text")).text, audio);
      if ((reason = PB.hlsProtection(ap))) throw new Protected(reason);
      parts.push(await hlsPart(ap, "audio", onProgress));
    }
    return { parts, stream: { type: "hls", manifest: url, variant: variant ? { bandwidth: variant.bandwidth, height: variant.height } : null, live: !pl.endList } };
  }

  async function hlsPart(pl, role, onProgress) {
    const list = PB.hlsFetchList(pl), container = PB.hlsContainer(pl, list[0] && list[0].url);
    const bytes = await segments(list, onProgress);
    const mime = container === "mp4" ? (role === "audio" ? "audio/mp4" : "video/mp4") : container === "aac" ? "audio/aac" : "video/mp2t";
    return { role, bytes, mime, segments: list.length };
  }

  async function dash(url, { maxHeight, onProgress }) {
    await ensure([url]);
    const mpd = PB.parseMpd((await get(url, null, "text")).text, url);
    if (!mpd) throw new Error("The address did not answer with a DASH manifest.");
    const reason = PB.dashProtection(mpd);
    if (reason) throw new Protected(reason);
    const parts = [];
    for (const [kind, rep] of [["video", PB.pickRepresentation(mpd, "video", { maxHeight })], ["audio", PB.pickRepresentation(mpd, "audio")]]) {
      if (!rep) continue;
      const bytes = await segments(rep.segments, onProgress);
      const webm = /webm/.test(rep.mimeType || "");
      parts.push({ role: kind, bytes, mime: `${kind}/${webm ? "webm" : "mp4"}`, segments: rep.segments.length });
    }
    if (!parts.length) throw new Error("The manifest lists no video or audio.");
    return { parts, stream: { type: "dash", manifest: url, live: mpd.type === "dynamic" } };
  }

  // { parts: [{ role, bytes, mime }], stream } for a scanned item. Throws Protected, NeedsAccess or Error.
  async function fetchItem(item, opts = {}) {
    if (item.protected) throw new Protected(item.protected);
    let got;
    if (item.url) {
      if (!item.url.startsWith("data:")) await ensure([item.url]);
      const r = await get(item.url);
      got = { parts: [{ role: item.kind || "file", bytes: r.bytes, mime: r.type || "application/octet-stream" }], stream: null };
    } else if (item.streams && item.streams.length) {
      const s = item.streams[item.streams.length - 1];
      got = await (s.type === "hls" ? hls : dash)(s.url, opts);
    } else throw new Error("This media has no address Daylight Commons can read: the page builds it in memory.");
    for (const p of got.parts) { const why = PB.fileProtection(p.bytes); if (why) throw new Protected(why); }
    return got;
  }

  // The hosts a save will ask for first: the file's or the manifest's, never all sites.
  const firstOrigins = (item) => [...new Set([item.url, ...(item.streams || []).map((s) => s.url)].map(originOf).filter(Boolean))];

  return Object.freeze({ fetchItem, firstOrigins, NeedsAccess, Protected, originOf });
})();
