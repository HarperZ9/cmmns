// Media checks in the window, only on click and one file at a time. CMMNS reads media the page
// already loaded: it re-requests the exact address the page's own <img> or <video> shows, so the
// browser usually answers from its cache, and sends no cookies. Frames for reverse search are taken
// from the page's own <video> element and stay in this tab until the user picks a search service.
(() => {
  "use strict";
  const MAX_BYTES = 25 * 1024 * 1024, MIN_SIDE = 200;   // at least 200 wide and 100 high: posts, screenshots, banners of text
  // Web media only; the loopback address serves the local fixture harness (scripts/serve.mjs).
  const WEB = /^(https:|http:\/\/127\.0\.0\.1[:/])/;
  const checks = new Map();   // url -> { state: "reading" | "done", result }
  const frames = new Map();   // video key -> { state, list: [{ t, url, blob }], error }

  // Media in one post: X media matched to what the page drew, else large images and videos.
  function inPost(node, tweet) {
    if (!node) return [];
    const imgs = [...node.querySelectorAll("img")].filter((i) => WEB.test(i.currentSrc || i.src) && !i.closest(".pb-pop"));
    const vids = [...node.querySelectorAll("video")];
    if (tweet && tweet.media) {
      return tweet.media.map((m, i) => {
        const key = (m.url || "").split("/").pop().replace(/\.\w+$/, "");
        const img = m.type === "photo" && key ? imgs.find((x) => (x.currentSrc || x.src).includes(key)) : null;
        const video = m.type !== "photo" ? vids[Math.min(i, vids.length - 1)] || null : null;
        return { i, type: m.type === "photo" ? "image" : m.type, src: img ? img.currentSrc || img.src : directSrc(video), searchUrl: m.url || null, video, media: m };
      });
    }
    const big = imgs.filter((x) => (x.naturalWidth >= MIN_SIDE && x.naturalHeight >= MIN_SIDE / 2) || (x.width >= MIN_SIDE && x.height >= MIN_SIDE / 2)).slice(0, 4);
    return [...big.map((x, i) => ({ i, type: "image", src: x.currentSrc || x.src, searchUrl: x.currentSrc || x.src })), ...vids.slice(0, 2).map((v, k) => ({ i: big.length + k, type: "video", src: directSrc(v), searchUrl: v.poster || null, video: v }))];
  }

  // A video's file address when the page plays a plain file; streamed video (blob:) has none.
  function directSrc(v) {
    if (!v) return null;
    const s = v.currentSrc || v.src || ((v.querySelector("source") || {}).src || "");
    return WEB.test(s) ? s : null;
  }

  async function readBytes(url) {
    const get = (globalThis.content && globalThis.content.fetch) || fetch;
    const res = await get(url, { credentials: "omit", cache: "force-cache", mode: "cors" });
    if (!res.ok) throw new Error(`the media host answered ${res.status}`);
    const reader = res.body.getReader(), parts = [];
    let n = 0, complete = true;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value); n += value.length;
      if (n >= MAX_BYTES) { complete = false; reader.cancel().catch(() => {}); break; }
    }
    const out = new Uint8Array(n);
    let o = 0;
    for (const p of parts) { out.set(p.subarray(0, Math.min(p.length, n - o)), o); o += p.length; }
    return { bytes: out, complete };
  }

  // The survival count on the feed page (src/core/survival.js): the outcome per file, keyed by a
  // short hash of its address, never the address itself.
  async function remember(url, result) {
    try {
      const log = (await chrome.storage.local.get(PB.MEDIA_KEY))[PB.MEDIA_KEY] || {};
      await chrome.storage.local.set({ [PB.MEDIA_KEY]: PB.recordCheck(log, { url, host: location.hostname, result }) });
    } catch (e) { PBGuard.report("could not save the media check count", e); }
  }

  async function check(url) {
    if (!url || (checks.get(url) || {}).state === "reading") return;
    checks.set(url, { state: "reading" });
    PBPop.refresh();
    try {
      const { bytes, complete } = await readBytes(url);
      const result = await PB.readCredentials(bytes, { complete });
      checks.set(url, { state: "done", result });
      remember(url, result);
    } catch (e) {
      console.warn("[cmmns] media check failed", url, e);
      const msg = e instanceof TypeError ? "the media host blocked CMMNS from reading the file on this page" : String(e.message || e);
      checks.set(url, { state: "done", result: { error: `could not read the file: ${msg}` } });
    }
    PBPop.refresh();
  }

  const seek = (v, t) => new Promise((ok) => { const done = () => { clearTimeout(timer); v.removeEventListener("seeked", done); ok(); }; const timer = setTimeout(done, 2000); v.addEventListener("seeked", done); v.currentTime = t; });

  // Up to four frames from the part of the video the browser has loaded. Playback position and
  // play state are restored afterwards.
  async function takeFrames(key, v) {
    if (!v || (frames.get(key) || {}).state === "reading") return;
    frames.set(key, { state: "reading" });
    PBPop.refresh();
    const t0 = v.currentTime, wasPaused = v.paused, list = [];
    try {
      const buffered = [...Array(v.buffered.length)].map((_, i) => [v.buffered.start(i), v.buffered.end(i)]);
      v.pause();
      for (const t of PB.keyframeTimes(v.duration, buffered, 4)) {
        await seek(v, t);
        const c = document.createElement("canvas");
        c.width = v.videoWidth; c.height = v.videoHeight;
        if (!c.width) continue;
        c.getContext("2d").drawImage(v, 0, 0);
        const blob = await new Promise((ok) => c.toBlob(ok, "image/png"));
        if (blob) list.push({ t, url: URL.createObjectURL(blob), blob });
      }
      frames.set(key, { state: "done", list, error: list.length ? null : "this video gave up zero frames" });
    } catch (e) {
      console.warn("[cmmns] frames failed", e);
      frames.set(key, { state: "done", list, error: e && e.name === "SecurityError" ? "the site's player blocks the page from reading its frames" : "this video gave up zero frames" });
    }
    try { await seek(v, t0); if (!wasPaused) await v.play(); } catch (e) { console.warn("[cmmns] could not restore playback", e); }
    PBPop.refresh();
  }

  // The frame goes to the clipboard and the service opens in a new tab. Nothing is sent until the
  // user pastes it there.
  async function searchFrame(frame, open) {
    try { await navigator.clipboard.write([new ClipboardItem({ "image/png": frame.blob })]); }
    catch (e) { console.warn("[cmmns] could not copy the frame", e); }
    window.open(open, "_blank", "noopener,noreferrer");
  }

  // Text in one image, on click: the bytes go to CMMNS' background worker (src/ext/ocr-bg.js),
  // which reads them on this device; the text then goes to the fact-check index the same way a
  // post's text does. Never run on its own.
  const texts = new Map();   // url -> { state: "reading" | "done", result }
  const b64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
  async function readText(url) {
    if (!url || (texts.get(url) || {}).state === "reading") return;
    texts.set(url, { state: "reading" });
    PBPop.refresh();
    let result;
    try {
      const { bytes, complete } = await readBytes(url);
      if (!complete) throw new Error("the image is larger than CMMNS reads");
      result = await chrome.runtime.sendMessage({ type: "pb-ocr", bytes: b64(bytes) });
      if (result && result.text) {
        const key = "img:" + url.length + ":" + url.slice(-24);
        const hits = await chrome.runtime.sendMessage({ type: "pb-claims", posts: [{ id: key, text: result.text }], fromImage: true });
        result = { ...result, claims: (hits && hits[key]) || [] };
      }
    } catch (e) {
      console.warn("[cmmns] reading text in the image failed", url, e);
      result = { error: e instanceof TypeError ? "the media host blocked CMMNS from reading the file on this page" : String(e.message || e) };
    }
    texts.set(url, { state: "done", result: result || { error: "no answer from CMMNS' background worker" } });
    PBPop.refresh();
  }
  const textsFor = (node, tweet) => inPost(node, tweet).map((x) => (texts.get(x.src) || {}).result).filter((r) => r && !r.error);

  const resultsFor = (node, tweet) => inPost(node, tweet).map((x) => (checks.get(x.src) || {}).result).filter(Boolean);
  globalThis.PBMedia = Object.freeze({ inPost, check, takeFrames, searchFrame, checkOf: (u) => checks.get(u) || null, framesOf: (k) => frames.get(k) || null, resultsFor, readText, textOf: (u) => texts.get(u) || null, textsFor });
})();
