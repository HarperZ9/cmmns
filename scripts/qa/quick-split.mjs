// Development tool for scripts/qa/quick_save_check.py: splits an MP4 with sound into a video-only
// and an audio-only MP4, the way Reddit's DASH serves them, with the toolkit's own reader and muxer.
//   node scripts/qa/quick-split.mjs <in.mp4> <video out> <audio out>
import { readFileSync, writeFileSync } from "node:fs";
import { demuxMp4 } from "../../src/core/media-demux.js";
import { muxMp4 } from "../../src/core/media-mp4.js";

const [src, vOut, aOut] = process.argv.slice(2);
const d = demuxMp4(readFileSync(src));
for (const [kind, out] of [["video", vOut], ["audio", aOut]]) {
  const t = d.tracks.find((x) => x.kind === kind);
  const us = (v) => (v * 1e6) / t.timescale;
  const chunks = d.samples.get(t.id).map((s) => ({ track: kind, data: d.bytes.subarray(s.offset, s.offset + s.size), timestampUs: us(s.dts + s.cts), decodeTimestampUs: us(s.dts), durationUs: us(s.duration), key: s.key }));
  const e = t.entry;
  const cfg = kind === "video" ? { video: { codec: "avc1", width: e.width, height: e.height, description: e.description } } : { audio: { codec: "mp4a", channels: e.channels, sampleRate: e.sampleRate, description: e.description } };
  writeFileSync(out, muxMp4({ ...cfg, chunks }));
  console.log(`${out}: ${chunks.length} ${kind} samples`);
}
