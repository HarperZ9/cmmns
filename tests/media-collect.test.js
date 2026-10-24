// Collections and hash lineage (src/core/media-collect.js): a saved file keeps its hash, source
// and time; every converted copy keeps its own hash and a chain of steps back to the original;
// checkLineage finds a broken or forged chain; a case row carries what `daylight case` checks.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mediaSha256, mediaKindOf, fileNameFor, savedRecord, derivedRecord, checkLineage, caseInboxRow, sizeLine, normTags, filterItems } from "../src/core/media-collect.js";

const bytes = (s) => new TextEncoder().encode(s);
const nodeSha = (b) => createHash("sha256").update(b).digest("hex");
const SRC = { mime: "image/png", url: "https://img.example.org/path/Harbour%20photo.png?x=1", page: "https://news.example.org/story", pageTitle: "Story" };

test("the browser hash equals Node's SHA-256", async () => {
  for (const s of ["", "abc", "x".repeat(100000)]) assert.equal(await mediaSha256(bytes(s)), nodeSha(bytes(s)));
});

test("hash lineage: original, compressed, then converted, each step linked by hash", async () => {
  const a = bytes("original image bytes"), b = bytes("smaller"), c = bytes("webp");
  const [ha, hb, hc] = await Promise.all([a, b, c].map(mediaSha256));
  const orig = savedRecord({ ...SRC, bytes: a.length }, { sha256: ha, collection: { type: "moodboard", id: "mb-1" }, tags: "Harbour, Night ,harbour", now: "2026-10-23T10:00:00.000Z" });
  assert.equal(orig.original, ha);
  assert.deepEqual(orig.tags, ["harbour", "night"]);
  assert.deepEqual(orig.lineage, []);
  const small = derivedRecord(orig, { bytes: b.length, mime: "image/jpeg", sha256: hb, step: { op: "compress", params: { quality: 0.7 }, tool: "canvas" }, now: "2026-10-23T10:01:00.000Z" });
  const webp = derivedRecord(small, { bytes: c.length, mime: "image/webp", sha256: hc, step: { op: "convert", params: { to: "image/webp" }, tool: "canvas" }, now: "2026-10-23T10:02:00.000Z" });
  assert.equal(webp.original, ha, "the original hash is kept through every step");
  assert.deepEqual(webp.lineage.map((l) => [l.op, l.from, l.to]), [["compress", ha, hb], ["convert", hb, hc]]);
  assert.equal(webp.lineage[0].bytesBefore, a.length);
  assert.equal(webp.lineage[0].bytesAfter, b.length);
  assert.equal(webp.derivedFrom, small.id);
  assert.equal(webp.source.url, SRC.url, "the source travels with the copy");
  assert.deepEqual(checkLineage([orig, small, webp]), []);
});

test("hash lineage: a forged or broken chain is reported", async () => {
  const [ha, hb, hc, hx] = await Promise.all(["a", "b", "c", "x"].map((s) => mediaSha256(bytes(s))));
  const orig = savedRecord({ ...SRC, bytes: 1 }, { sha256: ha, collection: { type: "case" } });
  const one = derivedRecord(orig, { bytes: 1, mime: "image/webp", sha256: hb, step: { op: "convert" } });
  const two = derivedRecord(one, { bytes: 1, mime: "image/webp", sha256: hc, step: { op: "compress" } });
  const swapped = { ...two, sha256: hx };
  assert.match(checkLineage([orig, one, swapped]).map((p) => p.problem).join(";"), /last step does not end at this file's hash/);
  const gap = { ...two, lineage: [two.lineage[0], { ...two.lineage[1], from: hx }] };
  assert.match(checkLineage([gap]).map((p) => p.problem).join(";"), /step 2 does not start where step 1 ended/);
  const rebased = { ...one, original: hx };
  assert.match(checkLineage([rebased]).map((p) => p.problem).join(";"), /first step does not start at the original/);
  assert.match(checkLineage([{ ...orig, original: hx }]).map((p) => p.problem).join(";"), /original hash differs/);
});

test("a save needs a collection and a real hash", () => {
  assert.throws(() => savedRecord(SRC, { sha256: "0".repeat(64), collection: null }), /case or a moodboard/);
  assert.throws(() => savedRecord(SRC, { sha256: "abc", collection: { type: "case" } }), /SHA-256/);
  assert.throws(() => savedRecord(SRC, { sha256: "0".repeat(64), collection: { type: "moodboard", id: "" } }), /case or a moodboard/);
});

test("a case row carries the address, page, time, hash and lineage for the case command", async () => {
  const h = await mediaSha256(bytes("v"));
  const r = savedRecord({ ...SRC, mime: "video/mp4", bytes: 1, stream: { type: "hls", manifest: "https://x.org/m.m3u8" } }, { sha256: h, collection: { type: "case" }, now: "2026-10-23T11:00:00.000Z" });
  const row = caseInboxRow(r);
  assert.equal(row.url, SRC.url);
  assert.equal(row.page, SRC.page);
  assert.equal(row.added, "2026-10-23T11:00:00.000Z");
  assert.deepEqual([row.media.kind, row.media.sha256, row.media.stream], ["video", h, "hls"]);
});

test("names, kinds, sizes and filters", () => {
  assert.equal(mediaKindOf("image/gif"), "gif");
  assert.equal(mediaKindOf("", "https://x.org/a.m3u8?t=1"), "video");
  assert.equal(mediaKindOf("audio/ogg; codecs=opus"), "audio");
  assert.equal(mediaKindOf("text/html", "https://x.org/"), null);
  const name = fileNameFor({ source: { url: SRC.url }, sha256: "ab".repeat(32), mime: "image/png" });
  assert.equal(name, "Harbour-photo-abababababab.png");
  assert.equal(fileNameFor({ source: { url: "https://x.org/../../etc/passwd" }, sha256: "cd".repeat(32), mime: "x/y" }), "passwd-cdcdcdcdcdcd.bin");
  assert.equal(sizeLine(2516582, 624640), "2.4 MB to 610 KB, 75% smaller");
  assert.equal(sizeLine(1000, 1100), "1000 bytes to 1 KB, 10% larger");
  assert.deepEqual(normTags(["A", "a", " b  c "]), ["a", "b c"]);
  const items = [{ collection: { type: "moodboard", id: "m" }, kind: "image", tags: ["red"], note: "door", source: { savedAt: "2", url: "u" } },
    { collection: { type: "moodboard", id: "m" }, kind: "video", tags: [], note: "", source: { savedAt: "3", url: "v" } },
    { collection: { type: "case", id: "case" }, kind: "image", tags: ["red"], note: "", source: { savedAt: "1", url: "w" } }];
  assert.equal(filterItems(items, { collection: { type: "moodboard", id: "m" } }).length, 2);
  assert.equal(filterItems(items, { tag: "red" }).length, 2);
  assert.equal(filterItems(items, { q: "DOOR" }).length, 1);
  assert.deepEqual(filterItems(items).map((i) => i.source.savedAt), ["3", "2", "1"], "newest first");
});
