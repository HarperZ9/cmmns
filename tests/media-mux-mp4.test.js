// Tests for the MP4 muxer: box order (moov before mdat), and sample tables read back by hand
// so that every stco/stsc/stsz entry is checked against the exact chunk bytes inside mdat.
import test from "node:test";
import assert from "node:assert/strict";
import { muxMp4 } from "../src/core/media-mp4.js";
import { readBoxes } from "../src/core/media-read.js";

const u32 = (b, at) => ((b[at] << 24) >>> 0) + (b[at + 1] << 16) + (b[at + 2] << 8) + b[at + 3];
const fourcc = (b, at) => String.fromCharCode(...b.subarray(at, at + 4));

function payload(tag, i, len) {
  const b = new Uint8Array(len);
  for (let k = 0; k < len; k++) b[k] = (tag * 13 + i * 5 + k * 3) & 255;
  return b;
}

const find = (list, type) => list.find((b) => b.type === type);
const path = (box, ...types) => types.reduce((b, t) => b && find(b.children, t), box);

// Full-box tables that start with an entry count after version and flags.
function table(bytes, box, width) {
  const at = box.start + box.headerSize + 4;
  const count = u32(bytes, at);
  const rows = [];
  for (let i = 0; i < count; i++) {
    const row = [];
    for (let k = 0; k < width; k++) row.push(u32(bytes, at + 4 + (i * width + k) * 4));
    rows.push(row);
  }
  return rows;
}

function sampleSizes(bytes, stsz) {
  const at = stsz.start + stsz.headerSize + 4;
  const count = u32(bytes, at + 4);
  return Array.from({ length: count }, (_, i) => u32(bytes, at + 8 + i * 4));
}

// Expands stsc and stco into one file offset per sample.
function sampleOffsets(bytes, stbl, sizes) {
  const stsc = table(bytes, find(stbl.children, "stsc"), 3);
  const stco = table(bytes, find(stbl.children, "stco"), 1).map((r) => r[0]);
  const offsets = [];
  let s = 0;
  stco.forEach((chunkOffset, ci) => {
    const entry = stsc.filter((e) => e[0] <= ci + 1).pop();
    let at = chunkOffset;
    for (let k = 0; k < entry[1]; k++) {
      offsets.push(at);
      at += sizes[s++];
    }
  });
  return offsets;
}

function avInput() {
  const chunks = [];
  for (let i = 0; i < 60; i++) chunks.push({ track: "video", timestampUs: Math.round(i * 33333.33), key: i % 30 === 0, data: payload(1, i, i % 30 ? 150 + i : 1200) });
  for (let i = 0; i < 94; i++) chunks.push({ track: "audio", timestampUs: Math.round((i * 1024 * 1e6) / 48000), key: true, data: payload(2, i, 90 + (i % 11)) });
  const avcC = Uint8Array.of(1, 0x42, 0xc0, 0x1e, 0xff, 0xe1, 0, 4, 0x67, 0x42, 0xc0, 0x1e, 1, 0, 2, 0x68, 0xce);
  return {
    video: { codec: "avc1", width: 320, height: 240, description: avcC },
    audio: { codec: "mp4a", sampleRate: 48000, channels: 2, description: Uint8Array.of(0x11, 0x90) },
    chunks: chunks.reverse(),
  };
}

// Checks one track's sample tables against its chunks; returns its timescale and seconds.
function checkTrack(bytes, trak, name, input, mdat) {
  const hdlr = path(trak, "mdia", "hdlr");
  assert.equal(fourcc(bytes, hdlr.start + 16), name === "video" ? "vide" : "soun");
  const stbl = path(trak, "mdia", "minf", "stbl");
  const expected = input.chunks.filter((c) => c.track === name).sort((a, b) => a.timestampUs - b.timestampUs);
  const sizes = sampleSizes(bytes, find(stbl.children, "stsz"));
  assert.deepEqual(sizes, expected.map((c) => c.data.length));
  sampleOffsets(bytes, stbl, sizes).forEach((off, i) => {
    assert.ok(off >= mdat.start + 8 && off + sizes[i] <= mdat.start + mdat.size, "sample lies inside mdat");
    assert.deepEqual(bytes.subarray(off, off + sizes[i]), expected[i].data, `${name} sample ${i} bytes`);
  });
  const mdhd = path(trak, "mdia", "mdhd");
  const timescale = u32(bytes, mdhd.start + 20);
  const duration = u32(bytes, mdhd.start + 24);
  const stts = table(bytes, find(stbl.children, "stts"), 2);
  assert.equal(stts.reduce((n, [count, delta]) => n + count * delta, 0), duration);
  const ticks = (us) => Math.round((us * timescale) / 1e6);
  const last = expected.length - 1;
  const lastDelta = ticks(expected[last].timestampUs) - ticks(expected[last - 1].timestampUs);
  assert.equal(duration, ticks(expected[last].timestampUs) + lastDelta, "last sample repeats the previous duration");
  assert.equal(find(stbl.children, "ctts"), undefined, "no composition offsets, no ctts");
  const stss = find(stbl.children, "stss");
  if (name === "video") assert.deepEqual(table(bytes, stss, 1).map((r) => r[0]), [1, 31]);
  else assert.equal(stss, undefined);
  return { timescale, seconds: duration / timescale };
}

function checkSampleEntries(bytes, traks, input) {
  const stsd = path(traks[0], "mdia", "minf", "stbl", "stsd");
  const entryAt = stsd.start + 16;
  assert.equal(fourcc(bytes, entryAt + 4), "avc1");
  assert.equal(u32(bytes, entryAt + 32) >>> 16, 320);
  assert.equal(fourcc(bytes, entryAt + 8 + 78 + 4), "avcC");
  assert.deepEqual(bytes.subarray(entryAt + 8 + 78 + 8, entryAt + 8 + 78 + 8 + 17), input.video.description);
  const audioStsd = path(traks[1], "mdia", "minf", "stbl", "stsd");
  const esdsAt = audioStsd.start + 16 + 36;
  assert.equal(fourcc(bytes, esdsAt + 4), "esds");
  const esds = bytes.subarray(esdsAt, esdsAt + u32(bytes, esdsAt));
  const asc = esds.findIndex((v, i) => v === 0x05 && esds[i + 1] === 2);
  assert.deepEqual(Array.from(esds.subarray(asc + 2, asc + 4)), [0x11, 0x90]);
}

test("MP4 with avc1 and mp4a: fast start layout and exact sample tables", () => {
  const input = avInput();
  const bytes = muxMp4(input);
  const top = readBoxes(bytes);
  assert.deepEqual(top.map((b) => b.type), ["ftyp", "moov", "mdat"]);
  assert.equal(top.reduce((n, b) => n + b.size, 0), bytes.length);
  assert.equal(fourcc(bytes, 8), "isom");
  assert.equal(new TextDecoder().decode(bytes.subarray(16, 32)), "isomiso2avc1mp41");
  const traks = top[1].children.filter((b) => b.type === "trak");
  assert.equal(traks.length, 2);
  const results = traks.map((trak, i) => checkTrack(bytes, trak, i === 0 ? "video" : "audio", input, top[2]));
  assert.deepEqual(results.map((r) => r.timescale), [90000, 48000]);
  const mvhd = find(top[1].children, "mvhd");
  assert.equal(u32(bytes, mvhd.start + 20), 1000);
  assert.equal(u32(bytes, mvhd.start + 24), Math.round(Math.max(...results.map((r) => r.seconds)) * 1000));
  checkSampleEntries(bytes, traks, input);
});

test("decode timestamps produce a ctts with the composition offsets", () => {
  const order = [0, 3, 1, 2];
  const chunks = order.map((p, d) => ({ track: "video", timestampUs: p * 40000, decodeTimestampUs: d * 40000 - 40000, key: d === 0, data: payload(5, d, 50) }));
  const bytes = muxMp4({ video: { codec: "avc1", width: 16, height: 16, description: avInput().video.description }, chunks });
  const stbl = path(readBoxes(bytes)[1], "trak", "mdia", "minf", "stbl");
  const ctts = table(bytes, find(stbl.children, "ctts"), 2);
  const offsets = ctts.flatMap(([count, v]) => Array(count).fill(v));
  assert.deepEqual(offsets, order.map((p, d) => (p - d + 1) * 3600));
});

test("Opus in MP4 writes an Opus sample entry with dOps at 48 kHz", () => {
  const chunks = [];
  for (let i = 0; i < 50; i++) chunks.push({ track: "audio", timestampUs: i * 20000, durationUs: 20000, key: true, data: payload(3, i, 70) });
  const bytes = muxMp4({ audio: { codec: "Opus", sampleRate: 48000, channels: 2, preSkip: 312 }, chunks });
  const top = readBoxes(bytes);
  assert.deepEqual(top.map((b) => b.type), ["ftyp", "moov", "mdat"]);
  const minf = path(top[1], "trak", "mdia", "minf");
  assert.ok(find(minf.children, "smhd") && !find(minf.children, "vmhd"));
  const stbl = find(minf.children, "stbl");
  const entryAt = find(stbl.children, "stsd").start + 16;
  assert.equal(fourcc(bytes, entryAt + 4), "Opus");
  const dopsAt = entryAt + 36;
  assert.equal(fourcc(bytes, dopsAt + 4), "dOps");
  assert.deepEqual(Array.from(bytes.subarray(dopsAt + 8, dopsAt + 19)), [0, 2, 0x01, 0x38, 0, 0, 0xbb, 0x80, 0, 0, 0]);
  const mdhd = path(top[1], "trak", "mdia", "mdhd");
  assert.equal(u32(bytes, mdhd.start + 20), 48000);
  assert.equal(u32(bytes, mdhd.start + 24), 50 * 960);
  assert.deepEqual(table(bytes, find(stbl.children, "stts"), 2), [[50, 960]]);
  const elst = path(top[1], "trak", "edts", "elst");
  assert.deepEqual(table(bytes, elst, 3)[0], [Math.round(((50 * 960 - 312) * 1000) / 48000), 312, 0x10000], "edit list skips the pre-skip");
  assert.equal(u32(bytes, find(top[1].children, "mvhd").start + 24), 994);
});

test("vp09 gets a vpcC; av01 without an av1C record and unknown codecs throw clearly", () => {
  const chunks = [{ track: "video", timestampUs: 0, key: true, data: payload(6, 0, 30) }];
  const bytes = muxMp4({ video: { codec: "vp09", width: 64, height: 64, profile: 0, level: 21, bitDepth: 10 }, chunks });
  const stsd = path(readBoxes(bytes)[1], "trak", "mdia", "minf", "stbl", "stsd");
  const vpcc = stsd.start + 16 + 86;
  assert.equal(fourcc(bytes, vpcc + 4), "vpcC");
  assert.deepEqual(Array.from(bytes.subarray(vpcc + 8, vpcc + 20)), [1, 0, 0, 0, 0, 21, 0xa2, 1, 1, 1, 0, 0]);
  assert.throws(() => muxMp4({ video: { codec: "av01", width: 64, height: 64 }, chunks }), /av1C/);
  assert.throws(() => muxMp4({ video: { codec: "hvc1", width: 64, height: 64 }, chunks }), /unsupported video codec/);
  assert.throws(() => muxMp4({ audio: { codec: "Opus", sampleRate: 48000, channels: 2 }, chunks }), /missing track/);
});
