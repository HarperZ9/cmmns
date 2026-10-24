// Writes a non-fragmented MP4 with the moov box before mdat (fast start) from encoded video
// and audio chunks, such as WebCodecs output. Builds the sample tables (stts, ctts, stss, stsc,
// stsz, stco or co64) and lays the chunk bytes out in mdat interleaved by decode time.

import { MuxByteWriter, concatBytes } from "./media-bytes.js";
import { mp4Box, mp4FullBox, mp4Ftyp, mp4Mvhd, mp4Tkhd, mp4Mdhd, mp4Hdlr, mp4Minf, mp4Stsd } from "./media-mp4-boxes.js";

const TWO32 = 4294967296;
const MOVIE_TIMESCALE = 1000;
const VIDEO_TIMESCALE = 90000;

// Chunks come in any order. Each track is sorted by decode time: decodeTimestampUs when the
// caller supplies it (B-frames), otherwise timestampUs. Composition offsets come from the gap.
function trackSamples(chunks, name, timescale, defaultDurationUs) {
  const own = chunks.filter((c) => c.track === name);
  const useDts = own.some((c) => Number.isFinite(c.decodeTimestampUs));
  const dts = (c) => (useDts && Number.isFinite(c.decodeTimestampUs) ? c.decodeTimestampUs : c.timestampUs);
  const ticks = (us) => Math.round((us * timescale) / 1e6);
  const list = own.slice().sort((a, b) => dts(a) - dts(b));
  const samples = [];
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    let duration;
    if (Number.isFinite(c.durationUs)) duration = ticks(c.durationUs);
    else if (i + 1 < list.length) duration = ticks(dts(list[i + 1])) - ticks(dts(c));
    else if (samples.length) duration = samples[samples.length - 1].duration;
    else duration = ticks(defaultDurationUs);
    samples.push({
      data: c.data, size: c.data.length, key: Boolean(c.key), duration: Math.max(0, duration),
      cts: ticks(c.timestampUs) - ticks(dts(c)), dtsUs: dts(c),
    });
  }
  return samples;
}

function makeTracks(video, audio, chunks) {
  const tracks = [];
  if (video) {
    tracks.push({ audio: false, name: "video", config: video, timescale: VIDEO_TIMESCALE, samples: trackSamples(chunks, "video", VIDEO_TIMESCALE, 33333) });
  }
  if (audio) {
    const opus = audio.codec === "Opus";
    const timescale = opus ? 48000 : audio.sampleRate;
    if (!(timescale > 0)) throw new Error("muxMp4: audio sampleRate is required");
    const frameUs = opus ? 20000 : (1024 * 1e6) / timescale;
    tracks.push({ audio: true, name: "audio", config: audio, timescale, samples: trackSamples(chunks, "audio", timescale, frameUs) });
  }
  tracks.forEach((t, i) => {
    t.id = i + 1;
    t.duration = t.samples.reduce((n, s) => n + s.duration, 0);
    // Opus pre-skip is trimmed with an edit list that starts the presentation after it.
    t.mediaStart = t.config.codec === "Opus" ? Math.min(t.duration, t.config.preSkip ?? 3840) : 0;
    t.movieDuration = Math.round(((t.duration - t.mediaStart) * MOVIE_TIMESCALE) / t.timescale);
  });
  return tracks;
}

// Orders all samples by decode time and groups runs of one track into mdat chunks.
function layoutMdat(tracks) {
  const all = [];
  for (const t of tracks) {
    t.chunks = [];
    for (const s of t.samples) all.push({ t, s });
  }
  all.sort((a, b) => a.s.dtsUs - b.s.dtsUs);
  const parts = [];
  let offset = 0;
  let last = null;
  for (const { t, s } of all) {
    if (t !== last) t.chunks.push({ offset, count: 0 });
    t.chunks[t.chunks.length - 1].count++;
    last = t;
    parts.push(s.data);
    offset += s.size;
  }
  return { parts, size: offset };
}

function runs(values) {
  const out = [];
  for (const v of values) {
    const top = out[out.length - 1];
    if (top && top.value === v) top.count++;
    else out.push({ value: v, count: 1 });
  }
  return out;
}

function countTable(type, version, entries, write) {
  const w = new MuxByteWriter(8 + entries.length * 8).u32(entries.length);
  for (const e of entries) write(w, e);
  return mp4FullBox(type, version, 0, [w.finish()]);
}

function stts(samples) {
  return countTable("stts", 0, runs(samples.map((s) => s.duration)), (w, r) => w.u32(r.count).u32(r.value));
}

function ctts(samples) {
  if (!samples.some((s) => s.cts !== 0)) return null;
  const signed = samples.some((s) => s.cts < 0);
  return countTable("ctts", signed ? 1 : 0, runs(samples.map((s) => s.cts)), (w, r) => w.u32(r.count).i32(r.value));
}

function stss(samples) {
  const keys = [];
  samples.forEach((s, i) => s.key && keys.push(i + 1));
  return countTable("stss", 0, keys, (w, k) => w.u32(k));
}

function stsc(chunks) {
  const entries = [];
  chunks.forEach((c, i) => {
    const top = entries[entries.length - 1];
    if (!top || top.count !== c.count) entries.push({ first: i + 1, count: c.count });
  });
  return countTable("stsc", 0, entries, (w, e) => w.u32(e.first).u32(e.count).u32(1));
}

function stsz(samples) {
  const w = new MuxByteWriter(8 + samples.length * 4).u32(0).u32(samples.length);
  for (const s of samples) w.u32(s.size);
  return mp4FullBox("stsz", 0, 0, [w.finish()]);
}

function chunkOffsets(chunks, base, wide) {
  return countTable(wide ? "co64" : "stco", 0, chunks, (w, c) => (wide ? w.u64(base + c.offset) : w.u32(base + c.offset)));
}

function trak(t, base, wide) {
  const tables = [mp4Stsd(t), stts(t.samples)];
  const c = ctts(t.samples);
  if (c) tables.push(c);
  if (!t.audio) tables.push(stss(t.samples));
  tables.push(stsc(t.chunks), stsz(t.samples), chunkOffsets(t.chunks, base, wide));
  const tkhd = mp4Tkhd({ trackId: t.id, duration: t.movieDuration, width: t.config.width, height: t.config.height, audio: t.audio });
  const mdia = mp4Box("mdia", [mp4Mdhd(t.timescale, t.duration), mp4Hdlr(t.audio), mp4Minf(t.audio, mp4Box("stbl", tables))]);
  return mp4Box("trak", t.mediaStart ? [tkhd, edts(t), mdia] : [tkhd, mdia]);
}

function edts(t) {
  const w = new MuxByteWriter(16).u32(1).u32(t.movieDuration).u32(t.mediaStart).u16(1).u16(0);
  return mp4Box("edts", [mp4FullBox("elst", 0, 0, [w.finish()])]);
}

function moov(tracks, base, wide) {
  let duration = 0;
  for (const t of tracks) duration = Math.max(duration, t.movieDuration);
  const traks = tracks.map((t) => trak(t, base, wide));
  return mp4Box("moov", [mp4Mvhd(MOVIE_TIMESCALE, duration, tracks.length + 1), ...traks]);
}

function mdatHeader(payloadSize) {
  if (payloadSize + 8 < TWO32) return new MuxByteWriter(8).u32(payloadSize + 8).ascii("mdat").finish();
  return new MuxByteWriter(16).u32(1).ascii("mdat").u64(payloadSize + 16).finish();
}

function checkChunks(chunks, tracksByName) {
  for (const c of chunks) {
    if (!tracksByName[c.track]) throw new Error(`muxMp4: chunk for missing track "${c.track}"`);
    if (!(c.data instanceof Uint8Array)) throw new Error("muxMp4: chunk data must be a Uint8Array");
    if (!Number.isFinite(c.timestampUs)) throw new Error("muxMp4: chunk timestampUs must be a number");
  }
}

export function muxMp4({ video, audio, chunks = [] } = {}) {
  if (!video && !audio) throw new Error("muxMp4: needs a video or an audio track");
  checkChunks(chunks, { video: Boolean(video), audio: Boolean(audio) });
  const tracks = makeTracks(video, audio, chunks);
  const mdat = layoutMdat(tracks);
  const ftyp = mp4Ftyp();
  const head = mdatHeader(mdat.size);
  // Offsets depend on the moov size, which only changes if stco must become co64.
  const narrowLen = moov(tracks, 0, false).length;
  const wide = ftyp.length + narrowLen + head.length + mdat.size >= TWO32;
  const moovLen = wide ? moov(tracks, 0, true).length : narrowLen;
  const movie = moov(tracks, ftyp.length + moovLen + head.length, wide);
  return concatBytes([ftyp, movie, head, ...mdat.parts]);
}
