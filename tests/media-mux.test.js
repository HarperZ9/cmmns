// Tests for the WebM and Ogg Opus muxers: the files are read back with the structure readers
// and every block, cue and page is checked against the synthetic chunks that went in. When
// ffprobe is on PATH, it also reads a muxed WebM and MP4 and must report the expected streams.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { muxWebM, opusHead } from "../src/core/media-webm.js";
import { muxOggOpus, oggCrc32 } from "../src/core/media-ogg.js";
import { muxMp4 } from "../src/core/media-mp4.js";
import { readEbml, readEbmlUint, readEbmlFloat, readEbmlText, readOggPages } from "../src/core/media-read.js";

function payload(tag, i, len) {
  const b = new Uint8Array(len);
  for (let k = 0; k < len; k++) b[k] = (tag * 31 + i * 7 + k) & 255;
  b[0] = tag;
  b[1] = i & 255;
  return b;
}

// Video at 30 fps with a keyframe every 30 frames, Opus every 20 ms, shuffled together.
function avChunks(seconds) {
  const out = [];
  for (let i = 0; i < seconds * 30; i++) {
    out.push({ track: "video", timestampUs: Math.round(i * 33333.33), key: i % 30 === 0, data: payload(1, i, i % 30 ? 120 + (i % 7) : 900) });
  }
  for (let i = 0; i < seconds * 50; i++) {
    out.push({ track: "audio", timestampUs: i * 20000, durationUs: 20000, key: true, data: payload(2, i, 60 + (i % 5)) });
  }
  return out.reverse();
}

const byId = (list, id) => list.filter((e) => e.id === id);
const one = (list, id) => byId(list, id)[0];

function assertSizesFit(list, parentEnd) {
  for (const el of list) {
    assert.ok(el.end <= parentEnd, `element ${el.id} at ${el.start} ends past its parent`);
    if (el.children) assertSizesFit(el.children, el.end);
  }
}

// Returns every SimpleBlock as { track, time, key, data } in file order.
function webmBlocks(bytes, clusters) {
  const blocks = [];
  for (const cl of clusters) {
    const base = readEbmlUint(bytes, one(cl.children, "E7"));
    for (const sb of byId(cl.children, "A3")) {
      const d = bytes.subarray(sb.dataStart, sb.end);
      const rel = (d[1] << 8) | d[2];
      blocks.push({ track: d[0] & 0x7f, time: base + (rel > 32767 ? rel - 65536 : rel), key: Boolean(d[3] & 0x80), data: d.subarray(4) });
    }
  }
  return blocks;
}

test("WebM with VP9 video and Opus audio reads back block for block", () => {
  const chunks = avChunks(3);
  const head = opusHead({ channels: 2, sampleRate: 48000 });
  const vp9Private = Uint8Array.of(1, 1, 0, 2, 1, 10);
  const bytes = muxWebM({
    video: { codec: "V_VP9", width: 640, height: 360, codecPrivate: vp9Private },
    audio: { codec: "A_OPUS", sampleRate: 48000, channels: 2, codecPrivate: head },
    chunks, durationUs: 3000000,
  });
  const tree = readEbml(bytes);
  assert.deepEqual(tree.map((e) => e.id), ["1A45DFA3", "18538067"]);
  assertSizesFit(tree, bytes.length);
  const header = tree[0].children;
  assert.equal(readEbmlText(bytes, one(header, "4282")), "webm");
  assert.equal(readEbmlUint(bytes, one(header, "4287")), 4);
  assert.equal(readEbmlUint(bytes, one(header, "4285")), 2);
  const seg = tree[1];
  const info = one(seg.children, "1549A966").children;
  assert.equal(readEbmlUint(bytes, one(info, "2AD7B1")), 1000000);
  assert.equal(readEbmlFloat(bytes, one(info, "4489")), 3000);
  assert.equal(readEbmlText(bytes, one(info, "4D80")), "CMMNS");
  const entries = byId(one(seg.children, "1654AE6B").children, "AE");
  assert.equal(entries.length, 2);
  assert.deepEqual(entries.map((e) => readEbmlText(bytes, one(e.children, "86"))), ["V_VP9", "A_OPUS"]);
  const priv = entries.map((e) => bytes.slice(one(e.children, "63A2").dataStart, one(e.children, "63A2").end));
  assert.deepEqual(priv, [vp9Private, head]);
  assert.equal(readEbmlUint(bytes, one(one(entries[0].children, "E0").children, "B0")), 640);

  const clusters = byId(seg.children, "1F43B675");
  assert.equal(clusters.length, 3, "one cluster per video keyframe");
  const blocks = webmBlocks(bytes, clusters);
  assert.equal(blocks.length, chunks.length);
  const rank = (c) => (c.track === "video" ? 0 : 1);
  const sorted = chunks.slice().sort((a, b) => a.timestampUs - b.timestampUs || rank(a) - rank(b));
  blocks.forEach((b, i) => {
    const c = sorted[i];
    assert.equal(b.track, c.track === "video" ? 1 : 2);
    assert.equal(b.key, c.key);
    assert.equal(b.time, Math.round(c.timestampUs / 1000));
    assert.deepEqual(b.data, c.data);
    if (i) assert.ok(b.time >= blocks[i - 1].time, "timecodes never go back");
  });
  for (const cl of clusters) {
    const first = webmBlocks(bytes, [cl])[0];
    assert.deepEqual([first.track, first.key], [1, true], "each cluster opens on a video keyframe");
  }

  const cues = byId(one(seg.children, "1C53BB6B").children, "BB");
  assert.equal(cues.length, 3);
  cues.forEach((cp, i) => {
    const pos = one(cp.children, "B7").children;
    assert.equal(readEbmlUint(bytes, one(pos, "F7")), 1);
    assert.equal(seg.dataStart + readEbmlUint(bytes, one(pos, "F1")), clusters[i].start);
    assert.equal(readEbmlUint(bytes, one(cp.children, "B3")), readEbmlUint(bytes, one(clusters[i].children, "E7")));
  });
  const seeks = byId(one(seg.children, "114D9B74").children, "4DBB");
  for (const s of seeks) {
    const target = Array.from(bytes.subarray(one(s.children, "53AB").dataStart, one(s.children, "53AB").end), (x) => x.toString(16).padStart(2, "0")).join("").toUpperCase();
    const at = seg.dataStart + readEbmlUint(bytes, one(s.children, "53AC"));
    assert.equal(one(seg.children, target).start, at, `SeekHead points at ${target}`);
  }
});

test("audio-only WebM opens a cluster at least every 5 s and cues every cluster", () => {
  const chunks = [];
  for (let i = 0; i < 600; i++) chunks.push({ track: "audio", timestampUs: i * 20000, key: true, data: payload(3, i, 40) });
  const bytes = muxWebM({ audio: { codec: "A_OPUS", sampleRate: 48000, channels: 1, codecPrivate: opusHead({ channels: 1, sampleRate: 48000, preSkip: 312 }) }, chunks });
  const tree = readEbml(bytes);
  assertSizesFit(tree, bytes.length);
  const seg = tree[1];
  const entries = byId(one(seg.children, "1654AE6B").children, "AE");
  assert.equal(entries.length, 1);
  assert.equal(readEbmlUint(bytes, one(entries[0].children, "D7")), 1);
  assert.equal(readEbmlUint(bytes, one(entries[0].children, "56AA")), 6500000, "CodecDelay is pre-skip in ns");
  const clusters = byId(seg.children, "1F43B675");
  const times = clusters.map((cl) => readEbmlUint(bytes, one(cl.children, "E7")));
  assert.deepEqual(times, [0, 5000, 10000]);
  const blocks = webmBlocks(bytes, clusters);
  assert.equal(blocks.length, 600);
  assert.ok(blocks.every((b) => b.track === 1 && b.key));
  assert.equal(byId(one(seg.children, "1C53BB6B").children, "BB").length, 3);
});

test("Ogg CRC matches the published CRC-32 (cksum polynomial) check value", () => {
  // CRC-32/CKSUM of "123456789" is 0x765e7680; it differs from Ogg's CRC only by the final xor.
  const crc = oggCrc32(new TextEncoder().encode("123456789"));
  assert.equal((crc ^ 0xffffffff) >>> 0, 0x765e7680);
});

// Rebuilds packets from the lacing values of every audio page.
function oggPackets(bytes, pages) {
  const packets = [];
  let cur = [];
  for (const p of pages) {
    let at = p.bodyStart;
    for (const v of p.lacing) {
      cur.push(bytes.subarray(at, at + v));
      at += v;
      if (v < 255) {
        packets.push(Uint8Array.from(cur.flatMap((x) => Array.from(x))));
        cur = [];
      }
    }
  }
  return packets;
}

test("Ogg Opus pages: CRCs, BOS and EOS, granules and a packet spanning pages", () => {
  const packets = [];
  for (let i = 0; i < 120; i++) packets.push({ data: payload(4, i, i === 60 ? 70000 : 80 + (i % 9)), durationSamples: 960 });
  const bytes = muxOggOpus({ sampleRate: 48000, channels: 2, preSkip: 3840, packets });
  const pages = readOggPages(bytes);
  assert.equal(pages.reduce((n, p) => n + p.size, 0), bytes.length);
  assert.ok(pages.every((p) => p.crcOk), "every page CRC verifies");
  assert.deepEqual(pages.map((p) => p.sequence), pages.map((_, i) => i));
  assert.ok(pages[0].bos && pages.slice(1).every((p) => !p.bos));
  assert.ok(pages[pages.length - 1].eos && pages.slice(0, -1).every((p) => !p.eos));
  assert.deepEqual(bytes.slice(pages[0].bodyStart, pages[0].bodyStart + pages[0].bodySize), opusHead({ channels: 2, sampleRate: 48000 }));
  const tags = new TextDecoder().decode(bytes.subarray(pages[1].bodyStart, pages[1].bodyStart + pages[1].bodySize));
  assert.ok(tags.startsWith("OpusTags") && tags.includes("CMMNS"));
  assert.equal(pages[0].granule, 0);
  assert.equal(pages[pages.length - 1].granule, 120 * 960, "granules count decoded samples, pre-skip included");
  const trimmed = readOggPages(muxOggOpus({ channels: 2, preSkip: 3840, packets, totalSamples: 110000 }));
  assert.equal(trimmed[trimmed.length - 1].granule, 3840 + 110000, "end trim is preSkip plus the source length");
  assert.ok(trimmed.every((p) => p.crcOk));
  const got = oggPackets(bytes, pages.slice(2));
  assert.equal(got.length, 120);
  got.forEach((d, i) => assert.deepEqual(d, packets[i].data));
  const big = pages.findIndex((p) => p.lacing.length === 255 && p.lacing[254] === 255);
  assert.ok(big > 1, "the 70,000-byte packet fills a page of 255 lacing values");
  assert.ok(pages[big + 1].continued, "the next page continues the packet");
  // The big packet is 274 full segments plus one of 130 bytes, split across the two pages.
  const tail = pages[big].lacing.length - 1 - pages[big].lacing.findLastIndex((v) => v < 255);
  const nextLacing = pages[big + 1].lacing;
  const lead = nextLacing.findIndex((v) => v < 255);
  assert.equal(tail + lead, 274);
  assert.equal(nextLacing[lead], 70000 - 274 * 255);
  const granules = pages.slice(2).map((p) => p.granule).filter((g) => g !== -1);
  granules.forEach((g, i) => assert.ok(i === 0 || g > granules[i - 1], "granules increase"));
  assert.equal(pages[big].granule === -1, false, "packets ended on that page before the big one");
});

function ffprobe(path) {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_streams", "-of", "json", path], { encoding: "utf8" });
  assert.equal(r.status, 0, `ffprobe failed: ${r.stderr}`);
  return JSON.parse(r.stdout).streams;
}

test("ffprobe reads the muxed WebM and MP4 streams", (t) => {
  if (spawnSync("ffprobe", ["-version"]).error) {
    t.skip("ffprobe not found");
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), "daylight-mux-"));
  try {
    const head = opusHead({ channels: 2, sampleRate: 48000 });
    const webm = muxWebM({ video: { codec: "V_VP9", width: 640, height: 360 }, audio: { codec: "A_OPUS", sampleRate: 48000, channels: 2, codecPrivate: head }, chunks: avChunks(2) });
    writeFileSync(join(dir, "a.webm"), webm);
    const ws = ffprobe(join(dir, "a.webm"));
    assert.deepEqual(ws.map((s) => s.codec_type).sort(), ["audio", "video"]);
    assert.deepEqual(ws.map((s) => s.codec_name).sort(), ["opus", "vp9"]);
    const avcC = Uint8Array.of(1, 0x42, 0xc0, 0x1e, 0xff, 0xe1, 0, 4, 0x67, 0x42, 0xc0, 0x1e, 1, 0, 2, 0x68, 0xce);
    const chunks = avChunks(2).map((c) => (c.track === "audio" ? { ...c, durationUs: undefined, timestampUs: Math.round((c.data[1] * 1024 * 1e6) / 48000) } : c));
    const mp4 = muxMp4({ video: { codec: "avc1", width: 640, height: 360, description: avcC }, audio: { codec: "mp4a", sampleRate: 48000, channels: 2, description: Uint8Array.of(0x11, 0x90) }, chunks });
    writeFileSync(join(dir, "a.mp4"), mp4);
    const ms = ffprobe(join(dir, "a.mp4"));
    const tagOf = (type) => ms.find((s) => s.codec_type === type);
    assert.equal(tagOf("video").codec_tag_string, "avc1");
    assert.equal(tagOf("audio").codec_tag_string, "mp4a");
    assert.equal(Number(tagOf("video").nb_frames), 60);
    assert.equal(Number(tagOf("audio").nb_frames), 100);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
