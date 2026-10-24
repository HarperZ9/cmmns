// Tests for the GIF decoder. The GIFs are built byte by byte here with a small LZW encoder, so
// every expected pixel, delay, disposal result and loop count is known before decoding.
import test from "node:test";
import assert from "node:assert/strict";
import { decodeGif, isGif } from "../src/core/media-gif.js";

// GIF LZW: codes grow from minSize + 1 bits to 12; a clear code restarts when the table fills.
function lzwEncode(indices, minSize) {
  const clear = 1 << minSize, eoi = clear + 1;
  const out = [];
  let acc = 0, nacc = 0, size = minSize + 1, next = eoi + 1;
  let dict = new Map();
  const put = (code) => {
    acc |= code << nacc;
    nacc += size;
    while (nacc >= 8) {
      out.push(acc & 255);
      acc >>>= 8;
      nacc -= 8;
    }
  };
  put(clear);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = prefix * 256 + k;
    if (dict.has(key)) {
      prefix = dict.get(key);
      continue;
    }
    put(prefix);
    if (next < 4096) {
      dict.set(key, next++);
      if (next > 1 << size && size < 12) size++;
    } else {
      put(clear);
      dict = new Map();
      next = eoi + 1;
      size = minSize + 1;
    }
    prefix = k;
  }
  put(prefix);
  put(eoi);
  if (nacc > 0) out.push(acc & 255);
  return out;
}

const u16 = (v) => [v & 255, v >> 8];
const subBlocks = (bytes) => {
  const out = [];
  for (let i = 0; i < bytes.length; i += 255) {
    const part = bytes.slice(i, i + 255);
    out.push(part.length, ...part);
  }
  return [...out, 0];
};
const tableBits = (colours) => Math.max(0, Math.ceil(Math.log2(colours)) - 1);
const padTable = (rgb) => {
  const n = 2 << tableBits(rgb.length / 3);
  return [...rgb, ...new Array(n * 3 - rgb.length).fill(0)];
};

// frames: [{ x, y, w, h, indices, delayCs, disposal, transparent, local, interlaced }]
function encodeGif({ width, height, global, loop, frames, minSize = 2 }) {
  const bytes = [..."GIF89a"].map((c) => c.charCodeAt(0));
  bytes.push(...u16(width), ...u16(height), 0x80 | tableBits(global.length / 3), 0, 0, ...padTable(global));
  if (loop !== undefined) bytes.push(0x21, 0xff, 11, ..."NETSCAPE2.0".split("").map((c) => c.charCodeAt(0)), 3, 1, ...u16(loop), 0);
  for (const f of frames) {
    const t = f.transparent ?? -1;
    bytes.push(0x21, 0xf9, 4, ((f.disposal ?? 0) << 2) | (t >= 0 ? 1 : 0), ...u16(f.delayCs ?? 0), Math.max(t, 0), 0);
    const packed = (f.local ? 0x80 | tableBits(f.local.length / 3) : 0) | (f.interlaced ? 0x40 : 0);
    bytes.push(0x2c, ...u16(f.x), ...u16(f.y), ...u16(f.w), ...u16(f.h), packed);
    if (f.local) bytes.push(...padTable(f.local));
    bytes.push(minSize, ...subBlocks(lzwEncode(f.indices, minSize)));
  }
  bytes.push(0x3b);
  return Uint8Array.from(bytes);
}

const RED = [255, 0, 0, 255], GREEN = [0, 255, 0, 255], BLUE = [0, 0, 255, 255], WHITE = [255, 255, 255, 255], CLEAR = [0, 0, 0, 0];
const GLOBAL = [255, 0, 0, 0, 255, 0, 0, 0, 255, 9, 9, 9];
const px = (frame, width, x, y) => Array.from(frame.rgba.subarray((y * width + x) * 4, (y * width + x) * 4 + 4));

function threeFrames() {
  return encodeGif({
    width: 4, height: 4, global: GLOBAL, loop: 3,
    frames: [
      { x: 0, y: 0, w: 4, h: 4, indices: new Array(16).fill(0), delayCs: 5, disposal: 1 },
      { x: 1, y: 1, w: 2, h: 2, indices: [1, 3, 3, 2], delayCs: 0, disposal: 2, transparent: 3 },
      { x: 0, y: 0, w: 1, h: 1, indices: [0], delayCs: 1, local: [255, 255, 255, 1, 2, 3] },
    ],
  });
}

test("composites frames with transparency, disposal 2 and a local colour table", () => {
  const bytes = threeFrames();
  assert.equal(isGif(bytes), true);
  const gif = decodeGif(bytes);
  assert.equal(gif.width, 4);
  assert.equal(gif.height, 4);
  assert.equal(gif.loop, 3);
  assert.deepEqual(gif.frames.map((f) => f.delayMs), [50, 100, 100], "0 and 10 ms delays become 100 ms");
  assert.deepEqual(gif.frames.map((f) => [f.x, f.y, f.w, f.h]), [[0, 0, 4, 4], [1, 1, 2, 2], [0, 0, 1, 1]]);
  const [a, b, c] = gif.frames;
  for (let i = 0; i < 16; i++) assert.deepEqual(px(a, 4, i % 4, i >> 2), RED);
  assert.equal(b.rgba.length, 4 * 4 * 4);
  assert.deepEqual(px(b, 4, 1, 1), GREEN);
  assert.deepEqual(px(b, 4, 2, 1), RED, "transparent index shows the frame below");
  assert.deepEqual(px(b, 4, 1, 2), RED);
  assert.deepEqual(px(b, 4, 2, 2), BLUE);
  assert.deepEqual(px(c, 4, 0, 0), WHITE, "local table colour 0 is white");
  for (const [x, y] of [[1, 1], [2, 1], [1, 2], [2, 2]]) assert.deepEqual(px(c, 4, x, y), CLEAR, "disposal 2 cleared the rect");
  assert.deepEqual(px(c, 4, 3, 3), RED, "pixels outside the disposed rect stay");
});

test("disposal 3 restores the canvas from before the frame", () => {
  const gif = decodeGif(encodeGif({
    width: 2, height: 2, global: GLOBAL,
    frames: [
      { x: 0, y: 0, w: 2, h: 2, indices: [0, 0, 0, 0], delayCs: 4 },
      { x: 0, y: 0, w: 1, h: 1, indices: [1], delayCs: 4, disposal: 3 },
      { x: 1, y: 1, w: 1, h: 1, indices: [2], delayCs: 4 },
    ],
  }));
  assert.equal(gif.loop, null, "no NETSCAPE block means no loop count");
  assert.deepEqual(px(gif.frames[1], 2, 0, 0), GREEN);
  assert.deepEqual(px(gif.frames[2], 2, 0, 0), RED, "restored after disposal 3");
  assert.deepEqual(px(gif.frames[2], 2, 1, 1), BLUE);
  assert.deepEqual(gif.frames.map((f) => f.delayMs), [40, 40, 40]);
});

test("interlaced rows land in the right place", () => {
  const order = [0, 4, 2, 6, 1, 3, 5, 7];
  const palette = [];
  for (let i = 0; i < 8; i++) palette.push(i * 30, 255 - i * 30, i);
  const indices = order.flatMap((row) => [row, row]);
  const gif = decodeGif(encodeGif({ width: 2, height: 8, global: palette, minSize: 3, frames: [{ x: 0, y: 0, w: 2, h: 8, indices, interlaced: true, delayCs: 10 }] }));
  for (let y = 0; y < 8; y++) {
    assert.deepEqual(px(gif.frames[0], 2, 1, y), [y * 30, 255 - y * 30, y, 255], `row ${y}`);
  }
});

test("LZW with 256 colours grows to 12-bit codes and survives a full table", () => {
  const palette = [];
  for (let i = 0; i < 256; i++) palette.push(i, 255 - i, (i * 7) & 255);
  let seed = 12345;
  const indices = Array.from({ length: 96 * 96 }, () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed >> 16) & 255;
  });
  const gif = decodeGif(encodeGif({ width: 96, height: 96, global: palette, minSize: 8, frames: [{ x: 0, y: 0, w: 96, h: 96, indices }] }));
  const f = gif.frames[0];
  for (let i = 0; i < indices.length; i++) {
    const k = indices[i];
    if (f.rgba[i * 4] !== k || f.rgba[i * 4 + 1] !== 255 - k || f.rgba[i * 4 + 3] !== 255) assert.fail(`pixel ${i} decoded wrong`);
  }
});

test("a truncated GIF returns the frames decoded before the cut", () => {
  const bytes = threeFrames();
  const cut = bytes.length - 6;
  const gif = decodeGif(bytes.subarray(0, cut));
  assert.equal(gif.frames.length, 2);
  assert.deepEqual(px(gif.frames[1], 4, 2, 2), BLUE);
  const early = decodeGif(bytes.subarray(0, 66));
  assert.equal(early.frames.length, 0, "cut inside the first frame data");
  assert.equal(early.loop, 3, "the loop block before the cut is kept");
});

test("isGif rejects other bytes and decodeGif refuses them", () => {
  assert.equal(isGif(Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 13, 10)), false);
  assert.equal(isGif(new TextEncoder().encode("GIF87a")), true);
  assert.throws(() => decodeGif(new TextEncoder().encode("not a gif")), /not a GIF/);
});
