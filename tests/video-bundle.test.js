// Save video in full: the transcript in two forms, chapters and comments from the page's own data,
// and the bundle `cmmns media fetch --full` writes from yt-dlp's files. Nothing here runs yt-dlp or
// touches the network.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { vttSegments, timedTranscript, plainTranscript, panelSegments, dataSegments, clockOf, secondsOf } from "../src/core/video-transcript.js";
import { dataChapters, pageComments, ytDlpComments, videoRecord, sha256Sums } from "../src/core/video-bundle.js";
import { captureThread } from "../src/core/capture-thread.js";
import { writeBundle, fullPlan, pickCaptions } from "../bin/lib/video-full.mjs";
import { fetchPlan } from "../bin/lib/media-fetch.mjs";

// Machine captions as YouTube serves them: each cue repeats the line before and grows the next.
const AUTO_VTT = `WEBVTT
Kind: captions
Language: en

00:00:00.000 --> 00:00:02.000 align:start position:0%
what if<00:00:00.500><c> there</c>

00:00:02.000 --> 00:00:02.010
what if there

00:00:02.010 --> 00:00:04.000
what if there
is no hard<00:00:03.000><c> problem</c>

00:00:04.000 --> 00:00:06.000
is no hard problem
hey &amp; welcome
`;

test("machine captions keep each spoken line once, with its start time", () => {
  const segs = vttSegments(AUTO_VTT);
  assert.deepEqual(segs.map((s) => s.text), ["what if there", "is no hard problem", "hey & welcome"]);
  assert.deepEqual(segs.map((s) => s.start), [0, 2.01, 4]);
  assert.equal(timedTranscript(segs), "[00:00:00] what if there\n[00:00:02] is no hard problem\n[00:00:04] hey & welcome\n");
  assert.equal(plainTranscript(segs), "what if there is no hard problem hey & welcome\n");
});

test("a pause of three seconds starts a new paragraph in the plain transcript", () => {
  const p = plainTranscript([{ start: 0, end: 1, text: "One." }, { start: 5, end: 6, text: "Two." }]);
  assert.equal(p, "One.\n\nTwo.\n");
});

test("times read both ways, and the panel and its data give the same segments", () => {
  assert.equal(clockOf(3725), "01:02:05");
  assert.equal(secondsOf("1:02:05"), 3725);
  assert.equal(secondsOf("2:03.500"), 123.5);
  assert.equal(secondsOf("soon"), null);
  assert.deepEqual(panelSegments(["0:05 Hello there", "not a line"]), [{ start: 5, end: null, text: "Hello there" }]);
  const json = { a: [{ transcriptSegmentRenderer: { startMs: "5000", endMs: "6500", snippet: { runs: [{ text: "Hello " }, { text: "there" }] } } }] };
  assert.deepEqual(dataSegments(json), [{ start: 5, end: 6.5, text: "Hello there" }]);
});

test("chapters come from the page's own data, each once, in order", () => {
  const json = { x: [
    { macroMarkersListItemRenderer: { title: { simpleText: "Silica" }, onTap: { watchEndpoint: { startTimeSeconds: 95 } } } },
    { macroMarkersListItemRenderer: { title: { simpleText: "Intro" }, onTap: { watchEndpoint: { startTimeSeconds: 0 } } } },
    { chapterRenderer: { title: { simpleText: "Silica" }, timeRangeStartMillis: 95000 } },
  ] };
  assert.deepEqual(dataChapters(json), [{ start: 0, title: "Intro" }, { start: 95, title: "Silica" }]);
});

const entity = (id, text, likes, replies = null) => ({ commentEntityPayload: { properties: { commentId: id, content: { content: text }, publishedTime: "1 day ago" },
  author: { displayName: "@someone" }, toolbar: { likeCountNotliked: likes, replyCount: replies } } });

test("a reply from the page's data stays under the comment it answers, with its likes", () => {
  const json = { items: [entity("UgTop1", "The observer is assumed, not explained.", "20", "1"), entity("UgTop1.Rep1", "Ipseity cases show the tagging.", "2")] };
  const flat = pageComments(json, "VID123");
  assert.equal(flat.find((c) => c.id === "UgTop1.Rep1").parent, "UgTop1");
  const t = captureThread({ site: "youtube", post: { url: "https://www.youtube.com/watch?v=VID123", id: "VID123" }, comments: flat });
  assert.equal(t.comments.length, 1, "one top comment");
  assert.equal(t.comments[0].replies.length, 1, "the reply is attached, not a second top comment");
  assert.equal(t.comments[0].replies[0].id, "UgTop1.Rep1");
  assert.equal(t.comments[0].score, 20);
  assert.equal(t.comments[0].replies[0].score, 2);
  assert.equal(t.comments[0].permalink, "https://www.youtube.com/watch?v=VID123&lc=UgTop1");
});

test("a reply whose parent was not loaded is marked, never passed off as a top comment", () => {
  const t = captureThread({ site: "youtube", comments: pageComments({ a: [entity("UgGone.Rep9", "replying to a missing one", "0")] }) });
  assert.equal(t.comments[0].parentMissing, true);
});

const INFO = {
  id: "abc123def45", title: "Glaze chemistry", description: "Silica and flux.", uploader: "Clay Lab", uploader_id: "@claylab", channel: "Clay Lab",
  upload_date: "20261002", webpage_url: "https://www.youtube.com/watch?v=abc123def45", duration: 600, view_count: 1000, like_count: 50, comment_count: 3,
  chapters: [{ start_time: 0, title: "Intro" }, { start_time: 95, title: "Silica" }], subtitles: { en: [{ ext: "vtt" }] },
  formats: [{ url: "https://rr1---sn.googlevideo.com/videoplayback?ip=203.0.113.9&sig=x" }],
  comments: [
    { id: "C1", parent: "root", text: "Strong talk, but the flux ratio claim needs a source.", like_count: 12, author: "@a", timestamp: 1793664000 },
    { id: "C1.R1", parent: "C1", text: "The source is in the description.", like_count: 3, author: "@b" },
    { id: "C2", parent: "root", text: "Loved it", like_count: 1, author: "@c", is_pinned: true },
  ],
};

test("yt-dlp's comments become one tree: replies attached, likes kept", () => {
  const t = captureThread({ site: "youtube", comments: ytDlpComments(INFO), expected: 3, cap: 3 });
  assert.equal(t.comments.length, 2);
  assert.equal(t.comments[0].replies[0].text, "The source is in the description.");
  assert.equal(t.comments[0].score, 12);
  assert.equal(t.completeness.complete, true);
});

function stage(withMedia) {
  const dir = mkdtempSync(join(tmpdir(), "cmmns-full-"));
  writeFileSync(join(dir, `${INFO.id}.info.json`), JSON.stringify(INFO));
  writeFileSync(join(dir, `${INFO.id}.en.vtt`), "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nSilica first.\n\n00:00:03.000 --> 00:00:05.000\nThen flux.\n");
  writeFileSync(join(dir, `${INFO.id}.en-orig.vtt`), AUTO_VTT);
  if (withMedia) writeFileSync(join(dir, `${INFO.id}.mp4`), Buffer.from("not really a video"));
  return dir;
}
const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

test("the bundle holds every part, and SHA256SUMS matches each file", () => {
  const dir = stage(true);
  const r = writeBundle(dir, INFO, INFO.webpage_url, { savedAt: "2026-11-03T00:00:00Z", version: "2026.10.01" });
  assert.equal(r.captions.kind, "manual", "a manual track wins over the machine one");
  assert.equal(r.media, `${INFO.id}.mp4`);
  for (const f of [".transcript.txt", ".transcript.plain.txt", ".thread.json", ".video.json", ".md"]) assert.ok(existsSync(join(dir, INFO.id + f)), f);
  assert.ok(!readdirSync(dir).some((f) => f.endsWith(".info.json")), "yt-dlp's raw info, with its signed stream addresses, is not kept");
  const sums = readFileSync(join(dir, "SHA256SUMS"), "utf8").trim().split("\n");
  assert.ok(sums.length >= 8);
  for (const line of sums) { const [hex, name] = line.split(" *"); assert.equal(sha(join(dir, name)), hex, name); }
  const src = readFileSync(join(dir, "SOURCE.txt"), "utf8");
  assert.match(src, /local research copy/);
  assert.match(src, /manual captions \(en\), 3 comments with replies/);
  const rec = JSON.parse(readFileSync(join(dir, `${INFO.id}.video.json`), "utf8"));
  assert.deepEqual(rec.chapters.map((c) => c.at), ["00:00:00", "00:01:35"]);
  assert.ok(!JSON.stringify(rec).includes("googlevideo"), "no stream address, which carries the viewer's IP, in the record");
  assert.equal(readFileSync(join(dir, `${INFO.id}.transcript.txt`), "utf8"), "[00:00:01] Silica first.\n[00:00:03] Then flux.\n");
});

test("without the media file the bundle says so, and the note still lists the record", () => {
  const dir = stage(false);
  const r = writeBundle(dir, INFO, INFO.webpage_url, { savedAt: "2026-11-03T00:00:00Z" });
  assert.equal(r.media, null);
  assert.match(readFileSync(join(dir, "SOURCE.txt"), "utf8"), /Media file: not saved/);
  assert.match(readFileSync(join(dir, `${INFO.id}.md`), "utf8"), /comments_captured: 3/);
});

test("the machine track is read when no manual one exists", () => {
  assert.deepEqual(pickCaptions(["v.en.vtt", "v.en-orig.vtt"], { subtitles: {} }, "v"), { file: "v.en-orig.vtt", lang: "en-orig", kind: "auto" });
  assert.equal(pickCaptions(["v.info.json"], {}, "v"), null);
});

test("the full plan asks for comments, captions and, unless refused, the video", () => {
  const p = fullPlan("https://www.youtube.com/watch?v=abc", { comments: "50" }, "/home/a");
  assert.ok(p.args.includes("--write-comments") && p.args.includes("--write-auto-subs"));
  assert.ok(p.args.includes("youtube:max_comments=50,all,all,all;comment_sort=top"));
  assert.equal(p.args.at(-2), "--", "the address can never be read as an option");
  assert.ok(!p.args.includes("--skip-download"));
  const nov = fullPlan("https://www.youtube.com/watch?v=abc", { "no-video": true }, "/home/a");
  assert.ok(nov.args.includes("--skip-download") && !nov.video);
  assert.ok(!fullPlan("https://www.youtube.com/watch?v=abc", { comments: "0" }, "/home/a").args.includes("--write-comments"));
});

test("--name puts the media file beside an extension save of the same video", () => {
  const p = fetchPlan("https://www.youtube.com/watch?v=abc", { name: "claylab_2026-10-02_glaze_abc/../x" }, "/home/a");
  const out = p.args[p.args.indexOf("-o") + 1];
  assert.ok(out.endsWith("claylab_2026-10-02_glaze_abc-..-x.%(ext)s"), out);
});

test("SHA256SUMS skips an entry with no proper hash, and a record keeps the copy note", () => {
  assert.equal(sha256Sums([{ name: "a", sha256: "0".repeat(64) }, { name: "b", sha256: "zz" }]), `${"0".repeat(64)} *a\n`);
  assert.match(videoRecord({ media: "v.mp4" }).media.note, /never|not upload/i);
});

// The page's data is filed under the video the page shows when it arrives, so a save after YouTube
// swaps videos never carries the previous video's comments.
test("comments the page received for one video are not saved with the next", async () => {
  const core = { ...(await import("../src/core/video-bundle.js")), ...(await import("../src/core/video-transcript.js")) };
  const vm = await import("node:vm");
  let listener = null, href = "https://www.youtube.com/watch?v=AAAAAAAAAAA";
  const ctx = { location: { hostname: "www.youtube.com", get href() { return href; } }, window: { addEventListener: (_, f) => { listener = f; } }, PB: core, Map, Object, JSON, setTimeout, document: {} };
  ctx.globalThis = ctx;
  ctx.PBYouTube = { videoId: () => new URL(href).searchParams.get("v"), chapters: () => [] };
  ctx.window.self = ctx.window;
  vm.runInNewContext(readFileSync(join(import.meta.dirname, "..", "src", "ext", "yt-full.js"), "utf8"), ctx);
  const send = (json) => listener({ source: ctx.window, data: { source: "radar-yt", json } });
  send({ a: [entity("UgOld", "about the old video", "5")] });
  href = "https://www.youtube.com/watch?v=BBBBBBBBBBB";
  send({ a: [entity("UgNew", "about the new video", "1")] });
  assert.deepEqual(Array.from(ctx.PBYtFull.pageComments("BBBBBBBBBBB"), (c) => c.id), ["UgNew"]);
  assert.deepEqual(Array.from(ctx.PBYtFull.pageComments("AAAAAAAAAAA"), (c) => c.id), ["UgOld"]);
});

test("a pinned comment from the channel keeps both marks", () => {
  const [c] = ytDlpComments({ id: "v", comments: [{ id: "P", parent: "root", text: "ours", is_pinned: true, author_is_uploader: true }] });
  assert.equal(c.flair, "pinned, channel owner");
});
