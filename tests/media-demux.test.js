// The MP4 reader behind one-file downloads of streams with separate sound (Reddit's DASH, X's HLS):
// samples read from a plain MP4 and from fragments match what was written, and a video file and an
// audio file are rewrapped into one MP4 whose samples are the same bytes.
import test from "node:test";
import assert from "node:assert/strict";
import { muxMp4 } from "../src/core/media-mp4.js";
import { mp4Box, mp4FullBox } from "../src/core/media-mp4-boxes.js";
import { readBoxes } from "../src/core/media-read.js";
import { demuxMp4, remuxMp4 } from "../src/core/media-demux.js";

const AVCC = Uint8Array.of(1, 0x64, 0, 0x1f, 0xff, 0xe1, 0, 4, 0x67, 0x64, 0, 0x1f, 1, 0, 4, 0x68, 0xee, 0x3c, 0x80);
const ASC = Uint8Array.of(0x12, 0x10);
const data = (tag, i) => Uint8Array.from({ length: 20 + ((i * 7) % 13) }, (_, k) => (tag * 31 + i * 5 + k) & 255);
const videoChunks = Array.from({ length: 12 }, (_, i) => ({ track: "video", timestampUs: i * 40000, durationUs: 40000, key: i % 6 === 0, data: data(1, i) }));
const audioChunks = Array.from({ length: 20 }, (_, i) => ({ track: "audio", timestampUs: (i * 1024 * 1e6) / 48000, data: data(2, i) }));
const video = { codec: "avc1", width: 640, height: 360, description: AVCC };
const audio = { codec: "mp4a", channels: 2, sampleRate: 48000, description: ASC };

const be32 = (v) => Uint8Array.of(v >>> 24, (v >> 16) & 255, (v >> 8) & 255, v & 255);
const cat = (list) => { const o = new Uint8Array(list.reduce((s, x) => s + x.length, 0)); let p = 0; for (const x of list) { o.set(x, p); p += x.length; } return o; };

// A fragmented file: the plain file's moov as the init segment, then one moof and mdat per group.
function fragmented(plain, chunks, timescale, perFragment) {
  const moov = readBoxes(plain).find((b) => b.type === "moov");
  const parts = [plain.subarray(0, readBoxes(plain)[0].size), plain.subarray(moov.start, moov.start + moov.size)];
  const ticks = (us) => Math.round((us * timescale) / 1e6);
  for (let i = 0, seq = 1; i < chunks.length; i += perFragment, seq++) {
    const group = chunks.slice(i, i + perFragment);
    const trunBody = (offset) => cat([be32(group.length), be32(offset), ...group.flatMap((c, k) => {
      const next = group[k + 1] ? group[k + 1].timestampUs : c.timestampUs + (c.durationUs || (1024 * 1e6) / 48000);
      return [be32(ticks(next) - ticks(c.timestampUs)), be32(c.data.length), be32(c.key === false ? 0x10000 : 0)];
    })]);
    const build = (offset) => mp4Box("moof", [mp4FullBox("mfhd", 0, 0, [be32(seq)]), mp4Box("traf", [
      mp4FullBox("tfhd", 0, 0x20000, [be32(1)]), mp4FullBox("tfdt", 1, 0, [be32(0), be32(ticks(group[0].timestampUs))]),
      mp4FullBox("trun", 0, 0x1 | 0x100 | 0x200 | 0x400, [trunBody(offset)])])]);
    const size = build(0).length;
    parts.push(build(size + 8), mp4Box("mdat", group.map((c) => c.data)));
  }
  return cat(parts);
}

test("samples read from a plain MP4 are the bytes that were written", () => {
  const d = demuxMp4(muxMp4({ video, chunks: videoChunks }));
  assert.equal(d.tracks.length, 1);
  assert.equal(d.tracks[0].entry.codec, "avc1");
  assert.deepEqual([d.tracks[0].entry.width, d.tracks[0].entry.height], [640, 360]);
  assert.deepEqual([...d.tracks[0].entry.description], [...AVCC]);
  const s = d.samples.get(d.tracks[0].id);
  assert.equal(s.length, 12);
  s.forEach((x, i) => { assert.deepEqual([...d.bytes.subarray(x.offset, x.offset + x.size)], [...videoChunks[i].data]); assert.equal(x.key, videoChunks[i].key); });
});

test("samples read from fragments match, with keyframes from the sample flags", () => {
  const plain = muxMp4({ video, chunks: videoChunks });
  const d = demuxMp4(fragmented(plain, videoChunks, 90000, 5));
  const s = d.samples.get(d.tracks[0].id);
  assert.equal(s.length, 12);
  s.forEach((x, i) => { assert.deepEqual([...d.bytes.subarray(x.offset, x.offset + x.size)], [...videoChunks[i].data]); assert.equal(x.key, videoChunks[i].key); });
  assert.equal(s[11].dts, 11 * 3600);
});

test("a video file and an audio file become one MP4 with both tracks", () => {
  const v = fragmented(muxMp4({ video, chunks: videoChunks }), videoChunks, 90000, 4);
  const a = fragmented(muxMp4({ audio, chunks: audioChunks }), audioChunks, 48000, 8);
  assert.equal(demuxMp4(a).tracks[0].entry.sampleRate, 48000);
  assert.deepEqual([...demuxMp4(a).tracks[0].entry.description], [...ASC]);
  const out = demuxMp4(remuxMp4([v, a]));
  assert.deepEqual(out.tracks.map((t) => t.kind).sort(), ["audio", "video"]);
  for (const t of out.tracks) {
    const want = t.kind === "video" ? videoChunks : audioChunks, got = out.samples.get(t.id);
    assert.equal(got.length, want.length, t.kind);
    got.forEach((x, i) => assert.deepEqual([...out.bytes.subarray(x.offset, x.offset + x.size)], [...want[i].data]));
  }
});

test("a codec the muxer cannot write is refused in words, so the caller keeps the files apart", () => {
  const plain = muxMp4({ video: { codec: "vp09", width: 64, height: 64 }, chunks: videoChunks });
  assert.throws(() => remuxMp4([plain]), /vp09.*cannot rewrap/);
  assert.throws(() => demuxMp4(Uint8Array.of(0, 0, 0, 8, 0x6d, 0x64, 0x61, 0x74)), /no movie header/);
});

test("a DASH stream with separate video and sound becomes one MP4; protected streams stop first", async () => {
  const { assembleStream, MediaProtected } = await import("../src/core/media-assemble.js");
  const files = { "https://v.example/a/v.mp4": muxMp4({ video, chunks: videoChunks }), "https://v.example/a/s.mp4": muxMp4({ audio, chunks: audioChunks }) };
  const mpd = `<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static"><Period>
    <AdaptationSet contentType="video" mimeType="video/mp4"><Representation id="v" bandwidth="1"><BaseURL>v.mp4</BaseURL></Representation></AdaptationSet>
    <AdaptationSet contentType="audio" mimeType="audio/mp4"><Representation id="a" bandwidth="1"><BaseURL>s.mp4</BaseURL></Representation></AdaptationSet></Period></MPD>`;
  const asked = [];
  const get = async (url, { as } = {}) => { asked.push(url); if (as === "text") return url.endsWith(".mpd") ? mpd : PROTECTED_M3U8; return { bytes: files[url], type: "video/mp4" }; };
  const got = await assembleStream({ type: "dash", url: "https://v.example/a/DASHPlaylist.mpd" }, { get });
  assert.equal(got.files.length, 1);
  assert.deepEqual(demuxMp4(got.files[0].bytes).tracks.map((t) => t.kind).sort(), ["audio", "video"]);
  asked.length = 0;
  await assert.rejects(assembleStream({ type: "hls", url: "https://v.example/a/x.m3u8" }, { get }), MediaProtected);
  assert.deepEqual(asked, ["https://v.example/a/x.m3u8"], "nothing past the playlist is fetched");
  const drm = mpd.replace("<Period>", '<Period><ContentProtection schemeIdUri="urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed"/>');
  await assert.rejects(assembleStream({ type: "dash", url: "https://v.example/b.mpd" }, { get: async () => drm }), /Widevine/);
});
const PROTECTED_M3U8 = "#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI=\"k\"\n#EXTINF:4,\nseg1.ts\n#EXT-X-ENDLIST\n";
