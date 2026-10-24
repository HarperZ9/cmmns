// `daylight media convert|compress` (bin/lib/media.mjs, media-args.mjs): the ffmpeg arguments for
// each similar-format pair, plain refusals, and, where ffmpeg is installed, a real conversion whose
// lineage file holds the right hashes.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { ffmpegPlan, bits, kindOfExt } from "../bin/lib/media-args.mjs";
import { runMedia, findFfmpeg } from "../bin/lib/media.mjs";

const sha = (b) => createHash("sha256").update(b).digest("hex");

test("ffmpeg plans for each similar-format pair", () => {
  assert.deepEqual(ffmpegPlan("convert", "png", { to: "webp", quality: "0.8" }).args, ["-frames:v", "1", "-c:v", "libwebp", "-quality", "80"]);
  assert.deepEqual(ffmpegPlan("convert", "jpeg", { to: "png", "max-side": "1024" }).args.slice(0, 2), ["-vf", "scale=w=1024:h=1024:force_original_aspect_ratio=decrease"]);
  const gif = ffmpegPlan("convert", "gif", { to: "mp4" });
  assert.ok(gif.args.includes("libx264") && gif.args.includes("-an") && gif.args.includes("+faststart"));
  const v = ffmpegPlan("compress", "mp4", { "max-height": "480" });
  assert.equal(v.to, "mp4");
  assert.deepEqual(v.args.slice(0, 2), ["-vf", "scale=-2:'min(ih,480)'"]);
  assert.ok(v.args.includes("aac") && v.args.includes("1000000"));
  assert.equal(ffmpegPlan("convert", "mov", { to: "webm" }).args.includes("libvpx-vp9"), true);
  assert.deepEqual(ffmpegPlan("convert", "wav", { to: "ogg" }).args, ["-vn", "-c:a", "libopus", "-b:a", "96000"]);
  assert.equal(ffmpegPlan("compress", "wav", {}).to, "ogg", "compressing audio keeps it audio, in Opus");
  assert.equal(bits("2M"), 2000000);
  assert.equal(bits("96k"), 96000);
  assert.equal(kindOfExt(".GIF"), "gif");
});

test("pairs that are not similar, and bad options, are refused with what to do", () => {
  assert.throws(() => ffmpegPlan("convert", "png", { to: "mp4" }), /image converts to png, jpg, webp, avif/);
  assert.throws(() => ffmpegPlan("convert", "wav", { to: "mp4" }), /audio converts to/);
  assert.throws(() => ffmpegPlan("convert", "png", {}), /--to/);
  assert.throws(() => ffmpegPlan("convert", "txt", { to: "png" }), /none of these/);
  assert.throws(() => ffmpegPlan("convert", "png", { to: "webp", quality: "5" }), /--quality/);
  assert.throws(() => bits("fast"), /Not a bitrate/);
});

test("without ffmpeg the command says how to get it, and names the extension's own converter", () => {
  const d = mkdtempSync(join(tmpdir(), "dc-media-"));
  writeFileSync(join(d, "a.png"), "x");
  assert.throws(() => runMedia("convert", join(d, "a.png"), { to: "webp" }, { FFMPEG: join(d, "no-such-ffmpeg") }), /ffmpeg was not found.*Convert page/);
  assert.throws(() => runMedia("convert", join(d, "missing.png"), { to: "webp" }), /No such file/);
});

test("with ffmpeg: a real conversion keeps the original and writes both hashes in its lineage", (t) => {
  const ff = findFfmpeg();
  if (!ff) { t.skip("ffmpeg not found"); return; }
  const d = mkdtempSync(join(tmpdir(), "dc-media-"));
  const src = join(d, "pattern.png");
  const made = spawnSync(ff.bin, ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc=s=320x240", "-frames:v", "1", src]);
  assert.equal(made.status, 0);
  const before = readFileSync(src);
  const r = runMedia("convert", src, { to: "jpg", quality: "0.6" });
  assert.ok(existsSync(r.out) && r.out.endsWith(".jpg"));
  assert.deepEqual(readFileSync(src), before, "the original is unchanged");
  const L = JSON.parse(readFileSync(r.out + ".lineage.json", "utf8"));
  assert.equal(L.original, sha(before));
  assert.equal(L.file.sha256, sha(readFileSync(r.out)));
  assert.equal(L.steps[0].from, L.original);
  assert.equal(L.steps[0].to, L.file.sha256);
  assert.match(L.steps[0].tool, /ffmpeg/);
  const again = runMedia("convert", src, { to: "jpg" });
  assert.notEqual(again.out, r.out, "a second run never overwrites the first");
});
