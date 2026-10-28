// Injected into the current tab only when the user clicks "Save media" in the toolbar popup or
// "Save to CMMNS" in the right-click menu (activeTab). Lists the images, GIFs, videos and audio
// the page has loaded, with any HLS or DASH address the page fetched, and marks media that plays
// through Encrypted Media Extensions as protected. Reads the page; changes nothing and sends nothing.
globalThis.PBMediaScan = globalThis.PBMediaScan || (() => {
  "use strict";
  const MAX = 300, MIN_SIDE = 48;
  const STREAM = /\.(m3u8|mpd)(?:$|[?#])/i, FILE = /\.(mp4|webm|m4v|mov|gif|mp3|m4a|aac|ogg|opus|wav)(?:$|[?#])/i;
  const abs = (u) => { try { return new URL(u, location.href).href; } catch { return null; } };
  const okUrl = (u) => !!u && /^(https?:|data:image\/|blob:)/i.test(u);

  // Stream and file addresses the page loaded, newest last, from the page's own resource timing.
  function loaded() {
    let entries = [];
    try { entries = performance.getEntriesByType("resource").map((e) => e.name); } catch { /* no timing in this frame */ }
    const streams = [...new Set(entries.filter((u) => STREAM.test(u)))].map((url) => ({ type: /\.m3u8/i.test(url) ? "hls" : "dash", url }));
    return { streams, files: [...new Set(entries.filter((u) => FILE.test(u)))] };
  }

  function imageRow(img) {
    const url = abs(img.currentSrc || img.src);
    if (!okUrl(url) || url.startsWith("blob:")) return null;
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    if (w && h && (w < MIN_SIDE || h < MIN_SIDE)) return null;
    return { kind: /\.gif(?:$|[?#])/i.test(url) ? "gif" : "image", url, width: w || null, height: h || null, alt: img.alt || null, protected: null, streams: [] };
  }

  function mediaRow(el, net) {
    const kind = el.tagName === "AUDIO" ? "audio" : "video";
    const sources = [el.currentSrc, el.src, ...[...el.querySelectorAll("source")].map((s) => s.src)].map(abs).filter(Boolean);
    const direct = sources.find((u) => /^https?:/i.test(u) && !STREAM.test(u)) || null;
    const listed = sources.filter((u) => STREAM.test(u)).map((url) => ({ type: /\.m3u8/i.test(url) ? "hls" : "dash", url }));
    const drm = el.mediaKeys ? "The page plays this media through Encrypted Media Extensions (DRM)." : null;
    // A blob: source is a stream the page assembles itself; the manifests it fetched are candidates.
    const streams = listed.length ? listed : !direct ? net.streams : [];
    return { kind, url: direct, width: el.videoWidth || null, height: el.videoHeight || null, poster: el.poster ? abs(el.poster) : null,
      duration: Number.isFinite(el.duration) ? Math.round(el.duration * 10) / 10 : null, alt: el.getAttribute("aria-label") || el.title || null,
      protected: drm, streams, blob: sources.some((u) => u.startsWith("blob:")) };
  }

  // A CSS background image on a large element, for moodboards.
  function backgroundRow(el) {
    const bg = getComputedStyle(el).backgroundImage;
    const m = bg && /url\(["']?([^"')]+)["']?\)/.exec(bg);
    if (!m) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 150 || r.height < 150) return null;
    const url = abs(m[1]);
    return okUrl(url) && !url.startsWith("blob:") ? { kind: "image", url, width: Math.round(r.width), height: Math.round(r.height), alt: null, protected: null, streams: [], background: true } : null;
  }

  // Everything on the page; `target` (the right-clicked address) is listed first when present.
  function scan(target) {
    const net = loaded(), rows = [], seen = new Set();
    const add = (r) => { if (!r) return; const key = r.url || (r.streams[0] && r.streams[0].url) || r.poster; if (!key || seen.has(key)) return; seen.add(key); rows.push(r); };
    for (const el of document.querySelectorAll("video, audio")) add(mediaRow(el, net));
    for (const img of document.images) add(imageRow(img));
    let n = 0;
    for (const el of document.querySelectorAll("div, section, figure, a, span")) { if (++n > 2000) break; add(backgroundRow(el)); }
    const t = target ? abs(target) : null;
    if (t && !t.startsWith("blob:") && !seen.has(t)) add({ kind: FILE.test(t) && /\.gif/i.test(t) ? "gif" : null, url: t, protected: null, streams: [] });
    const first = (r) => (r.url === t || (t && t.startsWith("blob:") && r.blob) ? 1 : 0);
    rows.sort((a, b) => first(b) - first(a));
    return { page: location.href, title: document.title, items: rows.slice(0, MAX), streams: net.streams, at: new Date().toISOString() };
  }

  return Object.freeze({ scan });
})();
