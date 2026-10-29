// The words that come with a saved file: the sidecar for an X post with alt text, a quote post and a
// Reddit gallery item, the "<handle>_<date>_<words>" names, the caption for Copy with caption, and
// the description written into JPEG, PNG, WebP, GIF and MP4 without touching the pictures or samples.
import test from "node:test";
import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { postMeta, sidecarMarkdown, sidecarJson, metaName, captionText, embedText, textTags } from "../src/core/media-meta.js";
import { embedDescription, readDescription } from "../src/core/media-embed.js";
import { muxMp4 } from "../src/core/media-mp4.js";
import { demuxMp4 } from "../src/core/media-demux.js";
import { encodeGif } from "../src/core/media-gif-encode.js";
import { decodeGif } from "../src/core/media-gif.js";

const NOW = "2026-10-25T12:00:00.000Z";
const xPost = postMeta({ site: "x", text: "Glazing trick: thin the slip 1:3.\nThen fire low. #ceramics https://ex.ample/guide.", authorName: "Mara K", handle: "@marak",
  postUrl: "https://x.com/marak/status/1957913446118285360", mediaUrl: "https://pbs.twimg.com/media/A?format=jpg&name=orig", postedAt: "2026-10-20T08:15:00Z",
  alt: "A bowl with a blue rim", thread: ["Part 2: let it cool overnight."] }, NOW);

test("an X post's sidecar keeps the text exactly, the alt text, the thread and where it came from", () => {
  const md = sidecarMarkdown(xPost, "marak_2026-10-20_glazing-trick-thin-the-slip-1-3-then-fire-low.jpg");
  assert.ok(md.startsWith('---\nformat: "daylight.sidecar/1"\nfiles: ["marak_2026-10-20_glazing'), "front matter first");
  assert.ok(md.includes("\n---\n\n# Mara K @marak\n"));
  assert.ok(md.includes("> Glazing trick: thin the slip 1:3.\n> Then fire low. #ceramics https://ex.ample/guide."), "line breaks kept");
  assert.match(md, /Continued by the author:\n\n> Part 2: let it cool overnight\./);
  assert.match(md, /Alt text: A bowl with a blue rim/);
  for (const line of ["- Post: https://x.com/marak/status/1957913446118285360", "- Posted (UTC): 2026-10-20T08:15:00.000Z", "- Saved (UTC): 2026-10-25T12:00:00.000Z", "- Hashtags: #ceramics", "- Links: https://ex.ample/guide"]) assert.ok(md.includes(line), line);
  assert.equal(JSON.parse(sidecarJson(xPost, "f.jpg")).author.handle, "marak");
  assert.equal(metaName(xPost, "jpg"), "marak_2026-10-20_glazing-trick-thin-the-slip-1-3-then-fire-low_1957913446118285360.jpg");
  assert.equal(captionText(xPost), "Glazing trick: thin the slip 1:3.\nThen fire low. #ceramics https://ex.ample/guide.\n\n@marak https://x.com/marak/status/1957913446118285360");
});

test("a quote post's sidecar carries the quoted post; X's placeholder alt text is dropped", () => {
  const q = postMeta({ site: "x", text: "This is the method I use.", handle: "lee", postUrl: "https://x.com/lee/status/2", alt: "Image",
    quoted: { text: "How do you keep glaze from crawling?", url: "https://x.com/ana/status/1", author: "ana" } }, NOW);
  const md = sidecarMarkdown(q);
  assert.match(md, /Quoting @ana \(https:\/\/x\.com\/ana\/status\/1\):\n\n> How do you keep glaze from crawling\?/);
  assert.equal(q.alt, null);
});

test("a Reddit gallery item names its place, its subreddit, title and self-text", () => {
  const r = postMeta({ site: "reddit", title: "Three ways to wedge clay", text: "Spiral wedging works best for me.\n\nRam's head second.", handle: "u/potter_j",
    subreddit: "r/Pottery", postUrl: "https://www.reddit.com/r/Pottery/comments/abc/three_ways/", postedAt: "2026-10-01T10:00:00Z", index: 1, total: 4 }, NOW);
  const md = sidecarMarkdown(r);
  assert.ok(md.includes("\n# u/potter_j (item 2 of 4)\n"));
  assert.ok(md.includes('\nitem: "2 of 4"\n'));
  const all = sidecarMarkdown(r, ["a-1.jpg", "a-2.jpg"]);
  assert.ok(all.includes('files: ["a-1.jpg","a-2.jpg"]') && all.includes("- Files: 1. a-1.jpg, 2. a-2.jpg") && !all.includes("item 2 of 4"), "one sidecar for a whole gallery");
  assert.match(md, /\*\*Three ways to wedge clay\*\*/);
  assert.match(md, /> Spiral wedging works best for me\.\n>\n> Ram's head second\./);
  assert.match(md, /- Subreddit: r\/Pottery/);
  assert.equal(metaName(r, "png"), "u-potter-j_2026-10-01_spiral-wedging-works-best-for-me-ram-s-head-2_abc.png");
  assert.deepEqual(textTags("see #one and #two, #one again").hashtags, ["#one", "#two"]);
});

const desc = embedText(xPost);

test("JPEG: XMP goes in after the JFIF header and the rest of the file is unchanged", () => {
  const jfif = Uint8Array.of(0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0);
  const rest = Uint8Array.of(0xff, 0xdb, 0, 3, 7, 0xff, 0xd9);
  const jpg = Uint8Array.from([0xff, 0xd8, ...jfif, ...rest]);
  const out = embedDescription(jpg, "image/jpeg", { description: desc, creator: "@marak", source: xPost.postUrl });
  assert.equal(readDescription(out), desc);
  assert.deepEqual([...out.subarray(0, 20)], [...jpg.subarray(0, 20)]);
  assert.deepEqual([...out.subarray(out.length - rest.length)], [...rest]);
  assert.equal(embedDescription(out, "image/jpeg", { description: "again" }), null, "existing XMP is left alone");
});

test("PNG: an iTXt XMP chunk with a valid CRC follows IHDR", () => {
  const chunk = (type, data) => { const t = Buffer.concat([Buffer.from(type), data]); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); return Buffer.concat([len, t, Buffer.alloc(4)]); };
  const ihdr = Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
  const png = new Uint8Array(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(Buffer.from([0, 255, 0, 0]))), chunk("IEND", Buffer.alloc(0))]));
  const out = embedDescription(png, "image/png", { description: desc });
  assert.equal(readDescription(out), desc);
  assert.equal(String.fromCharCode(...out.subarray(33 + 4, 33 + 8)), "iTXt");
  const len = new DataView(out.buffer).getUint32(33), crc = new DataView(out.buffer).getUint32(33 + 8 + len);
  let c = 0xffffffff;
  for (const x of out.subarray(37, 41 + len)) { c ^= x; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; }
  assert.equal(crc, (c ^ 0xffffffff) >>> 0, "chunk CRC");
  assert.deepEqual([...out.subarray(out.length - png.length + 33)], [...png.subarray(33)], "IDAT and IEND unchanged");
});

test("WebP: a lossless file gains VP8X with the XMP flag and an XMP chunk; the RIFF size is right", () => {
  const vp8l = Uint8Array.of(0x2f, 0x0f, 0xc0, 0x03, 0x10, 1, 2, 3);   // 16 by 16, alpha bit set
  const le = (v) => [v & 255, (v >> 8) & 255, (v >> 16) & 255, v >>> 24];
  const riff = Uint8Array.from([..."RIFF"].map((c) => c.charCodeAt(0)).concat(le(4 + 8 + vp8l.length), ..."WEBPVP8L".split("").map((c) => c.charCodeAt(0)), le(vp8l.length), ...vp8l));
  const out = embedDescription(riff, "image/webp", { description: desc });
  assert.equal(String.fromCharCode(...out.subarray(12, 16)), "VP8X");
  assert.equal(out[20] & 0x14, 0x14, "XMP and alpha flags");
  assert.equal(out[24] | (out[25] << 8), 15, "canvas width - 1");
  assert.equal(new DataView(out.buffer).getUint32(4, true), out.length - 8);
  assert.equal(readDescription(out), desc);
});

test("GIF: a comment block before the trailer; every frame decodes the same", () => {
  const frames = [0, 1].map((k) => ({ rgba: Uint8Array.from({ length: 4 * 4 * 4 }, (_, i) => (i % 4 === 3 ? 255 : (i * 40 + k * 90) & 255)), delayMs: 100 }));
  const gif = encodeGif({ width: 4, height: 4, frames });
  const out = embedDescription(gif, "image/gif", { description: desc });
  assert.equal(readDescription(out), desc);
  assert.deepEqual(decodeGif(out).frames.map((f) => [...f.rgba]), decodeGif(gif).frames.map((f) => [...f.rgba]));
});

test("MP4: the comment goes in moov and every sample still reads back the same bytes", () => {
  const chunks = Array.from({ length: 9 }, (_, i) => ({ track: "video", timestampUs: i * 40000, durationUs: 40000, key: i % 3 === 0, data: Uint8Array.from({ length: 30 + i }, (_, k) => (i * 17 + k) & 255) }));
  const avcc = Uint8Array.of(1, 0x64, 0, 0x1f, 0xff, 0xe1, 0, 4, 0x67, 0x64, 0, 0x1f, 1, 0, 4, 0x68, 0xee, 0x3c, 0x80);
  const mp4 = muxMp4({ video: { codec: "avc1", width: 64, height: 64, description: avcc }, chunks });
  const out = embedDescription(mp4, "video/mp4", { description: desc, creator: "@marak" });
  assert.equal(readDescription(out), desc);
  const d = demuxMp4(out), s = d.samples.get(d.tracks[0].id);
  s.forEach((x, i) => assert.deepEqual([...d.bytes.subarray(x.offset, x.offset + x.size)], [...chunks[i].data]));
  assert.equal(embedDescription(out, "video/mp4", { description: "again" }), null, "a file with its own udta is left alone");
});

test("a long post cut short by the page says so; the whole text from X's own field is kept whole", async () => {
  const long = "Isso é valiosíssimo em especial para quem estuda. ".repeat(80);
  const { tweetsIn } = await import("../src/core/xdata.js");
  const [t] = tweetsIn({ data: { __typename: "Tweet", rest_id: "1", legacy: { full_text: long.slice(0, 270) }, note_tweet: { note_tweet_results: { result: { text: long } } } } });
  assert.equal(t.text.length, 2000, "the lenses keep reading 2,000 characters");
  assert.equal(t.fullText, long, "the whole long post is kept apart");
  const cut = postMeta({ site: "x", handle: "a", text: long.slice(0, 300), textComplete: false }, NOW);
  const md = sidecarMarkdown(cut);
  assert.ok(md.includes("\ntext_complete: false\n"));
  assert.ok(md.includes("The page showed only the start of this text"));
  assert.ok(!sidecarMarkdown(postMeta({ site: "x", text: long }, NOW)).includes("text_complete"));
});

test("a study save says so, with its optional note, and further notes get their own heading", () => {
  const s = postMeta({ site: "x", handle: "a", text: "Wood ash glaze test tiles.", study: true, studyNote: "  the crawl   pattern  ", notes: [{ label: "Chapters", text: "00:00 Intro" }] }, NOW);
  const md = sidecarMarkdown(s, "a.jpg");
  assert.ok(md.includes("\nstudy: true\n") && md.includes('\nnote: "the crawl pattern"\n'));
  assert.ok(md.includes("What draws me to this: the crawl pattern"));
  assert.ok(md.includes("## Chapters\n\n00:00 Intro"));
  assert.ok(!sidecarMarkdown(postMeta({ site: "x", text: "x" }, NOW)).includes("study:"));
});
