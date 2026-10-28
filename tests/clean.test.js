// Share clean (src/core/clean.js). Each fixture in tests/fixtures/clean/ was built by
// scripts/clean-fixtures.py with metadata in every place its format allows, each value holding a
// DLSECRET marker. A byte scan proves no marker survives cleaning, and a structural comparison
// proves the picture, frames and samples are the same bytes (nothing was re-encoded).
// scripts/qa/clean_check.py adds a decoded-frame comparison with Pillow and ffmpeg.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inflateRawSync, inflateSync } from "node:zlib";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { shareClean, cleanFormat, cleanName, cleanLineage, CLEAN_LINEAGE_FORMAT } from "../src/core/clean.js";
import { embedDescription, readDescription } from "../src/core/media-embed.js";
import { decodeGif } from "../src/core/media-gif.js";
import { demuxMp4 } from "../src/core/media-demux.js";
import { readEbml } from "../src/core/media-read.js";
import { zipNames } from "../src/core/clean-zip.js";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "clean");
const MARKERS = JSON.parse(readFileSync(join(DIR, "markers.json"), "utf8"));
const load = (f) => new Uint8Array(readFileSync(join(DIR, f)));

// Every zip entry's bytes, decompressed, so markers inside office documents are found too.
function zipParts(b) {
  const buf = Buffer.from(b), out = [];
  for (let p = 0; p + 30 < buf.length && buf.readUInt32LE(p) === 0x04034b50;) {
    const method = buf.readUInt16LE(p + 8), size = buf.readUInt32LE(p + 18), nl = buf.readUInt16LE(p + 26), xl = buf.readUInt16LE(p + 28);
    const data = buf.subarray(p + 30 + nl + xl, p + 30 + nl + xl + size);
    out.push(method === 8 ? inflateRawSync(data) : data);
    p += 30 + nl + xl + size;
  }
  return out;
}
const views = (b) => [Buffer.from(b), ...(cleanFormat(b) === "office" ? zipParts(b) : [])];
const carries = (b, m) => views(b).some((v) => v.includes(Buffer.from(m)) || v.includes(Buffer.from(m, "utf16le").swap16()));

for (const [file, markers] of Object.entries(MARKERS)) {
  test(`Share clean removes every planted value from ${file}`, async () => {
    const before = load(file);
    for (const m of markers) assert.ok(carries(before, m), `${file}: fixture should carry ${m}`);
    const r = await shareClean(before);
    assert.equal(r.ok, true, r.reason);
    for (const m of markers) assert.ok(!carries(r.bytes, m), `${file}: ${m} survived cleaning`);
    assert.ok(r.removed.length > 0, "the report names what was removed");
    for (const m of markers) assert.ok(!r.removed.join(" ").includes(m), "the report names fields, never their values");
    const again = await shareClean(r.bytes);
    assert.equal(again.ok, true);
    assert.deepEqual(again.removed, [], "a clean copy has nothing left to remove");
  });
}

test("EXIF and GPS are gone from the JPEG, and the coded picture is the same bytes", async () => {
  const before = load("photo.jpg"), r = await shareClean(before), b = Buffer.from(r.bytes);
  for (const tag of ["Exif\0\0", "http://ns.adobe.com/xap", "Photoshop 3.0", "8BIM"]) assert.ok(!b.includes(Buffer.from(tag)), tag);
  // Tables, frame header and scan data: what a decoder reads to make pixels.
  const decodable = (x) => { const s = Buffer.from(x), out = []; let at = 2; while (at < s.length) { const m = s[at + 1]; if (m === 0xd9) break; const len = s.readUInt16BE(at + 2); if (m === 0xda) { out.push(s.subarray(at, s.lastIndexOf(Buffer.of(0xff, 0xd9)))); break; } if ([0xdb, 0xc4, 0xc0, 0xc1, 0xc2, 0xdd].includes(m)) out.push(s.subarray(at, at + 2 + len)); at += 2 + len; } return Buffer.concat(out); };
  assert.ok(decodable(before).equals(decodable(r.bytes)));
  assert.ok(Buffer.from(r.bytes).includes(Buffer.from("ICC_PROFILE")), "the colour profile stays, with its text blanked");
});

test("the PNG keeps its image data and loses every text, time and EXIF chunk", async () => {
  const chunks = (x) => { const s = Buffer.from(x), out = []; for (let at = 8; at + 12 <= s.length;) { const len = s.readUInt32BE(at); out.push([s.toString("latin1", at + 4, at + 8), s.subarray(at + 8, at + 8 + len)]); at += 12 + len; } return out; };
  const before = load("picture.png"), r = await shareClean(before);
  const types = chunks(r.bytes).map(([t]) => t);
  for (const t of ["tEXt", "zTXt", "iTXt", "eXIf", "tIME"]) assert.ok(!types.includes(t), t);
  const idat = (x) => inflateSync(Buffer.concat(chunks(x).filter(([t]) => t === "IDAT").map(([, d]) => d)));
  assert.ok(idat(before).equals(idat(r.bytes)), "decoded scanlines are identical");
  const icc = (x) => inflateSync(chunks(x).find(([t]) => t === "iCCP")[1].subarray(13));
  assert.ok(!icc(r.bytes).includes(Buffer.from("DLSECRET-ICCMAKER", "utf16le").swap16()));
  assert.ok(icc(before).includes(Buffer.from("DLSECRET-ICCMAKER", "utf16le").swap16()));
});

test("the GIF decodes to the same frames, with the same timing and loop", async () => {
  const before = load("anim.gif"), r = await shareClean(before);
  const a = decodeGif(before), b = decodeGif(r.bytes);
  assert.equal(a.frames.length, b.frames.length);
  assert.ok(a.frames.length >= 2);
  assert.equal(a.loop, b.loop);
  a.frames.forEach((f, i) => { assert.equal(f.delayMs, b.frames[i].delayMs); assert.ok(Buffer.from(f.rgba).equals(Buffer.from(b.frames[i].rgba)), `frame ${i}`); });
});

test("the WebP keeps its lossless image chunk byte for byte", async () => {
  const chunk = (x, t) => { const s = Buffer.from(x); for (let at = 12; at + 8 <= s.length;) { const len = s.readUInt32LE(at + 4); if (s.toString("latin1", at, at + 4) === t) return s.subarray(at, at + 8 + len); at += 8 + len + (len & 1); } return null; };
  const before = load("picture.webp"), r = await shareClean(before);
  assert.ok(chunk(before, "VP8L").equals(chunk(r.bytes, "VP8L")));
  assert.equal(chunk(r.bytes, "EXIF"), null);
  assert.equal(chunk(r.bytes, "XMP "), null);
  assert.equal(chunk(r.bytes, "VP8X")[8] & 0x0c, 0, "the EXIF and XMP flags are cleared");
});

for (const file of ["clip.mp4", "clip.mov"]) {
  test(`${file}: every sample is the same bytes, the file the same length, and the times are zero`, async () => {
    const before = load(file), r = await shareClean(before);
    assert.equal(r.bytes.length, before.length, "nothing moved, so every chunk offset stays valid");
    const a = demuxMp4(before), b = demuxMp4(r.bytes);
    assert.equal(a.tracks.length, 2, "video and audio");
    assert.deepEqual(b.tracks.map((t) => t.entry), a.tracks.map((t) => t.entry), "same decoder configuration");
    for (const t of a.tracks) {
      const sa = a.samples.get(t.id), sb = b.samples.get(t.id);
      assert.ok(sa.length > 5);
      assert.equal(sa.length, sb.length);
      sa.forEach((s, k) => assert.ok(Buffer.from(before.subarray(s.offset, s.offset + s.size)).equals(Buffer.from(r.bytes.subarray(sb[k].offset, sb[k].offset + sb[k].size))), `track ${t.id} sample ${k}`));
    }
    const mvhd = Buffer.from(r.bytes).indexOf("mvhd");
    assert.ok(Buffer.from(r.bytes).subarray(mvhd + 8, mvhd + 16).every((x) => x === 0), "mvhd creation and modification times are zero");
  });
}

test("clip.webm: every block is the same bytes and the tags are a Void element", async () => {
  const before = load("clip.webm"), r = await shareClean(before);
  assert.equal(r.bytes.length, before.length);
  const blocks = (x) => { const out = []; const walk = (l) => { for (const e of l) { if (e.id === "A3" || e.id === "A1") out.push(Buffer.from(x.subarray(e.dataStart, e.end))); if (e.children) walk(e.children); } }; walk(readEbml(x)); return out; };
  const a = blocks(before), b = blocks(r.bytes);
  assert.ok(a.length > 5);
  assert.equal(a.length, b.length);
  a.forEach((x, i) => assert.ok(x.equals(b[i]), `block ${i}`));
  const seg = readEbml(r.bytes).find((e) => e.id === "18538067");
  assert.ok(!seg.children.some((e) => e.id === "1254C367"), "no Tags element left");
});

test("the PDF keeps its length and its page, and the embedded photo loses its EXIF", async () => {
  const before = load("doc.pdf"), r = await shareClean(before), s = Buffer.from(r.bytes).toString("latin1");
  assert.equal(r.bytes.length, before.length, "the cross-reference offsets stay valid");
  assert.match(s, /q 40 0 0 30 20 20 cm \/Im1 Do Q/);
  assert.ok(!s.includes("Exif\0\0"));
  assert.ok(r.removed.some((x) => /embedded photo/.test(x)));
});

test("office documents keep their body and every part, with empty property parts", async () => {
  for (const f of ["letter.docx", "note.odt"]) {
    const before = load(f), r = await shareClean(before);
    assert.deepEqual(zipNames(r.bytes), zipNames(before), `${f}: same parts in the same order`);
    if (f === "letter.docx") assert.ok(zipParts(r.bytes).some((p) => p.includes(Buffer.from("Body text stays."))));
    assert.ok(r.notes.some((n) => /Comment authors/.test(n)), "says what it does not reach");
  }
  assert.equal(Buffer.from((await shareClean(load("note.odt"))).bytes).toString("latin1", 30, 38), "mimetype", "ODF mimetype stays first");
});

test("CMMNS's own embedded description is removed from every format it writes", async () => {
  const desc = { description: "DLSECRET-DAYLIGHT post words", creator: "@DLSECRET-HANDLE", source: "https://x.com/a/status/1" };
  for (const [f, mime] of [["photo.jpg", "image/jpeg"], ["picture.png", "image/png"], ["picture.webp", "image/webp"], ["anim.gif", "image/gif"], ["clip.mp4", "video/mp4"]]) {
    const plain = (await shareClean(load(f))).bytes, embedded = embedDescription(plain, mime, desc);
    assert.ok(embedded, `${f}: description embedded`);
    assert.match(readDescription(embedded), /DLSECRET-DAYLIGHT/);
    const r = await shareClean(embedded);
    assert.equal(r.ok, true, r.reason);
    assert.equal(readDescription(r.bytes), null, f);
    assert.ok(!Buffer.from(r.bytes).includes(Buffer.from("DLSECRET")), f);
  }
});

test("a file Share clean cannot read is refused, never passed through as clean", async () => {
  const r = await shareClean(new TextEncoder().encode("just some text, not a media file"));
  assert.equal(r.ok, false);
  assert.match(r.reason, /^not cleaned/);
  const broken = load("photo.jpg").slice(0, 300);
  const b = await shareClean(broken);
  assert.ok(!b.ok || !Buffer.from(b.bytes).includes(Buffer.from("DLSECRET")));
  const objStream = new TextEncoder().encode("%PDF-1.5\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R /Info 9 0 R >>\n%%EOF\n");
  const p = await shareClean(objStream);
  assert.equal(p.ok, false);
  assert.match(p.reason, /compressed object stream/);
});

test("the lineage ties the clean copy to its original and is never inside the clean file", async () => {
  const before = load("photo.jpg"), r = await shareClean(before), l = await cleanLineage(before, r, "2026-10-25T00:00:00Z");
  assert.equal(l.format, CLEAN_LINEAGE_FORMAT);
  assert.equal(l.original.bytes, before.length);
  assert.equal(l.clean.bytes, r.bytes.length);
  assert.notEqual(l.original.sha256, l.clean.sha256);
  assert.ok(!Buffer.from(r.bytes).includes(Buffer.from(l.original.sha256)), "the original's hash is not in the shared file");
  assert.match(cleanName(r.format, l.clean.sha256, "jpg"), /^clean-[0-9a-f]{12}\.jpg$/);
});

test("cleaning never changes the caller's bytes, even a Node Buffer", async () => {
  for (const f of Object.keys(MARKERS)) {
    const buf = readFileSync(join(DIR, f)), copy = Buffer.from(buf);
    await shareClean(buf);
    assert.ok(buf.equals(copy), f);
  }
});
