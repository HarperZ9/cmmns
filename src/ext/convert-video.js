// Video for the convert page, on this device: frames come from CMMNS' own GIF decoder
// (src/core/media-gif.js) or from the browser playing the file muted, are scaled on a canvas,
// encoded with WebCodecs' VideoEncoder (VP9 or VP8 for WebM, H.264 for MP4), and muxed with
// CMMNS' own WebM and MP4 writers. Sound is decoded and re-encoded by convert-audio.js.
globalThis.PBConvertVideo = (() => {
  "use strict";
  const CODECS = { webm: [["vp09.00.40.08", "V_VP9"], ["vp8", "V_VP8"]], mp4: [["avc1.640028", "avc1"], ["avc1.4d4028", "avc1"], ["avc1.42e028", "avc1"], ["avc1.42e01f", "avc1"]] };
  const even = (n) => Math.max(2, Math.round(n / 2) * 2);

  function size(w, h, maxHeight) {
    const k = maxHeight && h > maxHeight ? maxHeight / h : 1;
    return [even(w * k), even(h * k)];
  }

  // The first codec this browser can encode at this size, as { codec, track, config }.
  async function pick(to, w, h, bitrate, fps) {
    if (typeof VideoEncoder === "undefined") throw new Error("This browser has no video encoder (WebCodecs). The command line can convert video with ffmpeg: cmmns media convert.");
    for (const [codec, track] of CODECS[to]) {
      const config = { codec, width: w, height: h, bitrate, framerate: fps, latencyMode: "quality", ...(track === "avc1" ? { avc: { format: "avc" } } : {}) };
      try { if ((await VideoEncoder.isConfigSupported(config)).supported) return { codec, track, config }; } catch { /* try the next codec */ }
    }
    throw new Error(`This browser cannot encode ${to === "mp4" ? "H.264 for MP4" : "VP9 or VP8 for WebM"} at ${w} by ${h}. Try ${to === "mp4" ? "WebM" : "a smaller size"}.`);
  }

  // A running encoder: feed(canvas, timestampUs, durationUs), then done() for { chunks, description }.
  function encoder(choice, keyEveryUs = 2000000) {
    const chunks = [];
    let description = null, failed = null, lastKey = -Infinity;
    const enc = new VideoEncoder({
      output: (chunk, meta) => {
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        chunks.push({ track: "video", timestampUs: chunk.timestamp, durationUs: chunk.duration || null, key: chunk.type === "key", data });
        if (meta && meta.decoderConfig && meta.decoderConfig.description && !description) description = new Uint8Array(meta.decoderConfig.description);
      },
      error: (e) => { failed = e; },
    });
    enc.configure(choice.config);
    return {
      async feed(source, timestampUs, durationUs) {
        if (failed) throw failed;
        const frame = new VideoFrame(source, { timestamp: Math.round(timestampUs), duration: durationUs ? Math.round(durationUs) : undefined });
        const key = timestampUs - lastKey >= keyEveryUs;
        if (key) lastKey = timestampUs;
        enc.encode(frame, { keyFrame: key });
        frame.close();
        while (enc.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 5));
      },
      async done() { await enc.flush(); enc.close(); if (failed) throw failed; return { chunks, description }; },
    };
  }

  function mux(to, choice, w, h, video, audio, durationUs) {
    if (to === "webm") return { bytes: PB.muxWebM({ video: { codec: choice.track, width: w, height: h }, audio: audio ? PBConvertAudio.webmTrack(audio) : undefined,
      chunks: [...video.chunks, ...(audio ? audio.chunks : [])], durationUs }), mime: "video/webm" };
    if (!video.description) throw new Error("The H.264 encoder gave no decoder configuration, so no MP4 can be written.");
    return { bytes: PB.muxMp4({ video: { codec: "avc1", width: w, height: h, description: video.description }, audio: audio ? PBConvertAudio.mp4Track(audio) : undefined,
      chunks: [...video.chunks, ...(audio ? audio.chunks : [])] }), mime: "video/mp4" };
  }

  // GIF to WebM or MP4. opts: { to, maxHeight, bitrate }.
  async function fromGif(bytes, { to = "mp4", maxHeight = 0, bitrate = 1500000 } = {}, onProgress = () => {}) {
    const gif = PB.decodeGif(bytes);
    if (!gif.frames.length) throw new Error("The GIF has no frames this decoder could read.");
    const [w, h] = size(gif.width, gif.height, Number(maxHeight) || 0);
    const choice = await pick(to, w, h, bitrate, 25);
    const src = new OffscreenCanvas(gif.width, gif.height), out = new OffscreenCanvas(w, h), g = out.getContext("2d");
    const enc = encoder(choice);
    let t = 0;
    for (let i = 0; i < gif.frames.length; i++) {
      const f = gif.frames[i];
      src.getContext("2d").putImageData(new ImageData(f.rgba, gif.width, gif.height), 0, 0);
      g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
      g.drawImage(src, 0, 0, w, h);
      await enc.feed(out, t * 1000, f.delayMs * 1000);
      t += f.delayMs;
      if (i % 10 === 0) onProgress(`Encoding frame ${i + 1} of ${gif.frames.length}`);
    }
    const video = await enc.done();
    return { ...mux(to, choice, w, h, video, null, t * 1000), params: { to: to === "webm" ? "video/webm" : "video/mp4", codec: choice.codec, width: w, height: h, bitrate, frames: gif.frames.length } };
  }

  // Plays the file muted and hands each presented frame to onFrame(video, mediaTimeUs).
  function playFrames(video, onFrame) {
    return new Promise((resolve, reject) => {
      let busy = Promise.resolve();
      const tick = (_now, meta) => {
        busy = busy.then(() => onFrame(video, meta.mediaTime * 1e6)).catch(reject);
        if (!video.ended) video.requestVideoFrameCallback(tick);
      };
      video.requestVideoFrameCallback(tick);
      video.addEventListener("ended", () => busy.then(resolve, reject), { once: true });
      video.addEventListener("error", () => reject(new Error("The browser could not play this video.")), { once: true });
      video.play().catch(reject);
    });
  }

  async function load(blob) {
    const video = document.createElement("video");
    video.muted = true; video.playsInline = true; video.preload = "auto";
    video.src = URL.createObjectURL(blob);
    await new Promise((res, rej) => { video.onloadedmetadata = res; video.onerror = () => rej(new Error("The browser cannot play this video format.")); });
    if (!video.videoWidth) throw new Error("This file has no picture to convert. Use an audio format instead.");
    return video;
  }

  // Video to WebM or MP4, smaller if asked. opts: { to, maxHeight, bitrate, fps, audioBitrate }.
  async function fromVideo(blob, bytes, { to = "webm", maxHeight = 0, bitrate = 2000000, fps = 0, audioBitrate = 96000 } = {}, onProgress = () => {}) {
    if (typeof HTMLVideoElement === "undefined" || !("requestVideoFrameCallback" in HTMLVideoElement.prototype)) throw new Error("This browser cannot hand video frames to the encoder. Use the command line: cmmns media convert.");
    const video = await load(blob);
    const [w, h] = size(video.videoWidth, video.videoHeight, Number(maxHeight) || 0);
    const choice = await pick(to, w, h, bitrate, Number(fps) || 30);
    const canvas = new OffscreenCanvas(w, h), g = canvas.getContext("2d"), enc = encoder(choice), gap = fps ? 1e6 / fps : 0;
    let last = -Infinity, n = 0;
    onProgress("Playing the video to read its frames, at normal speed");
    await playFrames(video, async (v, t) => {
      if (t - last < gap * 0.98) return;
      last = t;
      g.drawImage(v, 0, 0, w, h);
      await enc.feed(canvas, t, gap || undefined);
      if (++n % 30 === 0) onProgress(`Encoded ${n} frames (${Math.round(t / 1e6)} of ${Math.round(video.duration)} s)`);
    });
    URL.revokeObjectURL(video.src);
    const v = await enc.done();
    onProgress("Encoding the sound");
    const buffer = await PBConvertAudio.decode(bytes);
    const aCodec = to === "mp4" && (await PBConvertAudio.supported({ codec: "mp4a.40.2", sampleRate: 48000, numberOfChannels: 2, bitrate: audioBitrate })) ? "mp4a.40.2" : "opus";
    const audio = buffer ? await PBConvertAudio.encode(buffer, { codec: aCodec, bitrate: audioBitrate }) : null;
    return { ...mux(to, choice, w, h, v, audio, Math.round(video.duration * 1e6)),
      params: { to: to === "webm" ? "video/webm" : "video/mp4", codec: choice.codec, audio: audio ? aCodec : null, width: w, height: h, bitrate, fps: fps || null, audioBitrate: audio ? audioBitrate : null, frames: n } };
  }

  return Object.freeze({ fromGif, fromVideo, size });
})();
