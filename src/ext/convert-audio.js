// Audio for the convert page, on this device: decode any file the browser can play (alone or as a
// video's sound track) at 48 kHz, encode it with WebCodecs' AudioEncoder (Opus, or AAC for MP4 where
// the browser has an AAC encoder), and wrap it in WebM or Ogg with CMMNS' own muxers
// (src/core/media-webm.js, media-ogg.js). Nothing is uploaded.
globalThis.PBConvertAudio = (() => {
  "use strict";
  const RATE = 48000, BLOCK = 4800;

  // The decoded sound at 48 kHz as an AudioBuffer, or null when the file has no audio track.
  async function decode(bytes) {
    const ctx = new OfflineAudioContext(2, 1, RATE);
    try { return await ctx.decodeAudioData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)); } catch { return null; }
  }

  async function supported(config) {
    if (typeof AudioEncoder === "undefined") return false;
    try { return (await AudioEncoder.isConfigSupported(config)).supported; } catch { return false; }
  }

  // Encodes an AudioBuffer. codec: "opus" or "mp4a.40.2". Returns { chunks, config, description }.
  async function encode(buffer, { codec = "opus", bitrate = 96000 } = {}) {
    const channels = Math.min(2, buffer.numberOfChannels);
    const config = { codec, sampleRate: RATE, numberOfChannels: channels, bitrate };
    if (!(await supported(config))) throw new Error(`This browser has no ${codec === "opus" ? "Opus" : "AAC"} audio encoder.`);
    const chunks = [];
    let description = null, failed = null;
    const enc = new AudioEncoder({
      output: (chunk, meta) => {
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        chunks.push({ track: "audio", timestampUs: chunk.timestamp, durationUs: chunk.duration || null, key: true, data });
        if (meta && meta.decoderConfig && meta.decoderConfig.description && !description) description = new Uint8Array(meta.decoderConfig.description);
      },
      error: (e) => { failed = e; },
    });
    enc.configure(config);
    const planes = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
    for (let at = 0; at < buffer.length; at += BLOCK) {
      const n = Math.min(BLOCK, buffer.length - at), data = new Float32Array(n * channels);
      for (let c = 0; c < channels; c++) data.set(planes[c].subarray(at, at + n), c * n);
      const ad = new AudioData({ format: "f32-planar", sampleRate: RATE, numberOfFrames: n, numberOfChannels: channels, timestamp: Math.round((at / RATE) * 1e6), data });
      enc.encode(ad);
      ad.close();
    }
    await enc.flush();
    enc.close();
    if (failed) throw failed;
    return { chunks, channels, description, samples: buffer.length, codec };
  }

  // The encoder's pre-skip from its OpusHead, else libopus's usual 312 samples at 48 kHz.
  const preSkipOf = (description) => (description && description.length >= 12 && String.fromCharCode(...description.subarray(0, 8)) === "OpusHead" ? description[10] | (description[11] << 8) : 312);

  // The WebM track description for Opus.
  function webmTrack(enc) {
    const preSkip = preSkipOf(enc.description);
    return { codec: "A_OPUS", sampleRate: RATE, channels: enc.channels, codecPrivate: enc.description && enc.description.length >= 19 ? enc.description : PB.opusHead({ channels: enc.channels, sampleRate: RATE, preSkip }) };
  }

  // The MP4 track description: AAC with its AudioSpecificConfig, or Opus.
  const mp4Track = (enc) => (enc.codec === "opus" ? { codec: "Opus", sampleRate: RATE, channels: enc.channels, preSkip: preSkipOf(enc.description) }
    : { codec: "mp4a", sampleRate: RATE, channels: enc.channels, description: enc.description });

  // Audio-only conversion: { bytes, mime, params }.
  async function convert(bytes, { to = "webm", bitrate = 96000 } = {}, onProgress = () => {}) {
    onProgress("Decoding the sound");
    const buffer = await decode(bytes);
    if (!buffer) throw new Error("The browser could not decode any sound in this file.");
    onProgress("Encoding Opus");
    const enc = await encode(buffer, { codec: "opus", bitrate });
    if (to === "ogg") {
      const packets = enc.chunks.map((c) => ({ data: c.data, durationSamples: Math.round(((c.durationUs || 20000) / 1e6) * RATE) }));
      return { bytes: PB.muxOggOpus({ sampleRate: RATE, channels: enc.channels, preSkip: preSkipOf(enc.description), packets, totalSamples: enc.samples }), mime: "audio/ogg", params: { to: "audio/ogg", codec: "opus", bitrate } };
    }
    return { bytes: PB.muxWebM({ audio: webmTrack(enc), chunks: enc.chunks, durationUs: Math.round((enc.samples / RATE) * 1e6) }), mime: "audio/webm", params: { to: "audio/webm", codec: "opus", bitrate } };
  }

  return Object.freeze({ decode, encode, convert, supported, webmTrack, mp4Track, RATE });
})();
