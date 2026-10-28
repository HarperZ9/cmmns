// "Download as GIF" on this device. Sites deliver most "GIFs" as MP4 or WebM: the file is read the
// way the page's player reads it, played in a hidden muted <video> from memory, and stepped frame by
// frame onto a canvas; animated WebP or AVIF pictures are read with the browser's ImageDecoder. The
// frames go to CMMNS' own GIF writer (src/core/media-gif-encode.js). Nothing is sent.
globalThis.PBQuickGif = globalThis.PBQuickGif || (() => {
  "use strict";
  const MAX_SECONDS = 20, FPS = 12, MAX_WIDTH = 480;

  const fit = (w, h) => { const k = w > MAX_WIDTH ? MAX_WIDTH / w : 1; return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))]; };

  function seek(video, t) {
    return new Promise((resolve, reject) => {
      const done = () => { video.removeEventListener("seeked", done); resolve(); };
      video.addEventListener("seeked", done);
      video.addEventListener("error", () => reject(new Error("The browser could not read this video.")), { once: true });
      video.currentTime = t;
    });
  }

  // GIF bytes from video bytes. onProgress(text).
  async function fromVideoBytes(bytes, mime, onProgress = () => {}) {
    const video = document.createElement("video");
    video.muted = true; video.playsInline = true; video.preload = "auto";
    const url = URL.createObjectURL(new Blob([bytes], { type: mime || "video/mp4" }));
    try {
      video.src = url;
      await new Promise((res, rej) => { video.onloadeddata = res; video.onerror = () => rej(new Error("The browser cannot play this video format.")); });
      if (!video.videoWidth) throw new Error("This file has no picture to make a GIF from.");
      const [w, h] = fit(video.videoWidth, video.videoHeight);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const g = canvas.getContext("2d", { willReadFrequently: true });
      const length = Math.min(Number.isFinite(video.duration) ? video.duration : MAX_SECONDS, MAX_SECONDS), step = 1 / FPS, frames = [];
      for (let t = 0; t < length - 1e-3; t += step) {
        await seek(video, t);
        g.drawImage(video, 0, 0, w, h);
        frames.push({ rgba: new Uint8Array(g.getImageData(0, 0, w, h).data.buffer), delayMs: Math.round(step * 1000) });
        if (frames.length % 12 === 0) onProgress(`Reading frames: ${Math.round(t)} of ${Math.round(length)} s`);
      }
      onProgress("Writing the GIF");
      await new Promise((r) => setTimeout(r, 0));
      const cut = Number.isFinite(video.duration) && video.duration > MAX_SECONDS ? ` The GIF holds the first ${MAX_SECONDS} seconds.` : "";
      return { bytes: PB.encodeGif({ width: w, height: h, frames }), note: cut };
    } finally { URL.revokeObjectURL(url); }
  }

  // GIF bytes from an animated picture (WebP, AVIF, PNG) through ImageDecoder.
  async function fromImageBytes(bytes, mime) {
    if (typeof ImageDecoder === "undefined") throw new Error("This browser cannot read animated pictures frame by frame, so no GIF can be made here.");
    const dec = new ImageDecoder({ data: bytes, type: mime });
    await dec.tracks.ready;
    const count = Math.min(dec.tracks.selectedTrack ? dec.tracks.selectedTrack.frameCount : 1, MAX_SECONDS * 25);
    let canvas = null, g = null, w = 0, h = 0;
    const frames = [];
    for (let i = 0; i < count; i++) {
      const { image } = await dec.decode({ frameIndex: i });
      if (!canvas) { [w, h] = fit(image.displayWidth, image.displayHeight); canvas = new OffscreenCanvas(w, h); g = canvas.getContext("2d", { willReadFrequently: true }); }
      g.clearRect(0, 0, w, h); g.drawImage(image, 0, 0, w, h);
      frames.push({ rgba: new Uint8Array(g.getImageData(0, 0, w, h).data.buffer), delayMs: Math.max(20, Math.round((image.duration || 100000) / 1000)) });
      image.close();
    }
    dec.close();
    return { bytes: PB.encodeGif({ width: w, height: h, frames }), note: "" };
  }

  return Object.freeze({ fromVideoBytes, fromImageBytes });
})();
