// One-click download: the file's type from its own bytes, safe file names, the largest srcset
// candidate, full-size addresses, the plan for each target (protected media refused), the GIF
// writer read back by the toolkit's own decoder, and MP4 rewrapping of separate video and audio.
import test from "node:test";
import assert from "node:assert/strict";
import { sniffMime, chooseType, downloadName, slug } from "../src/core/media-name.js";
import { parseSrcset, largestSource, fullSizeUrl, downloadPlan, referenceOf, REFERENCE_LABEL } from "../src/core/media-pick.js";
import { PROTECTED_LINE } from "../src/core/media-protect.js";
import { encodeGif, gifPalette } from "../src/core/media-gif-encode.js";
import { decodeGif } from "../src/core/media-gif.js";
import { tweetsIn } from "../src/core/xdata.js";

const bytes = (...xs) => Uint8Array.from(xs.flatMap((x) => (typeof x === "string" ? [...x].map((c) => c.charCodeAt(0)) : x)));

test("the type comes from the file's first bytes", () => {
  const cases = [
    [bytes([0x89], "PNG\r\n\x1a\n", [0, 0, 0, 0]), "image/png"], [bytes([0xff, 0xd8, 0xff, 0xe0], "JFIF"), "image/jpeg"],
    [bytes("GIF89a", [1, 0, 1, 0]), "image/gif"], [bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 "), "image/webp"],
    [bytes([0, 0, 0, 0x1c], "ftypavif", [0, 0, 0, 0]), "image/avif"], [bytes([0, 0, 0, 0x18], "ftypisom", [0, 0, 0, 0]), "video/mp4"],
    [bytes([0, 0, 0, 0x18], "ftypqt  ", [0, 0, 0, 0]), "video/quicktime"], [bytes([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x82, 0x84], "webm"), "video/webm"],
    [bytes("OggS", [0, 2, 0, 0]), "audio/ogg"], [bytes("ID3", [4, 0, 0]), "audio/mpeg"], [bytes([0xff, 0xf1, 0x50, 0x80]), "audio/aac"],
    [bytes("<?xml version=\"1.0\"?><svg xmlns=\"http://www.w3.org/2000/svg\">"), "image/svg+xml"], [bytes("#EXTM3U\n#EXT-X-VERSION:3"), "application/vnd.apple.mpegurl"],
  ];
  for (const [b, want] of cases) assert.equal(sniffMime(b), want, want);
  assert.equal(sniffMime(bytes("hello world")), null);
});

test("a WebP served from a .jpg address is saved as .webp; the header and address are fallbacks", () => {
  const webp = bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 ");
  assert.deepEqual(chooseType({ bytes: webp, contentType: "image/jpeg", url: "https://cdn.example/a.jpg" }), { mime: "image/webp", ext: "webp", from: "bytes" });
  assert.deepEqual(chooseType({ contentType: "image/avif; q=1", url: "https://cdn.example/a.jpg" }), { mime: "image/avif", ext: "avif", from: "header" });
  assert.deepEqual(chooseType({ contentType: "application/octet-stream", url: "https://i.imgur.com/abc.gifv" }), { mime: "video/mp4", ext: "mp4", from: "address" });
  assert.equal(chooseType({ contentType: "", url: "https://x.example/blob" }).ext, "bin");
});

test("file names come from the title and the media's own name, safe on every system", () => {
  assert.equal(downloadName({ title: "Cats: a / history?", url: "https://i.redd.it/abc123.jpeg", ext: "jpg" }), "Cats-a-history-abc123.jpg");
  assert.equal(downloadName({ title: "Gallery", url: "https://i.redd.it/x.png", index: 2, total: 5, ext: "png" }), "Gallery-x-3.png");
  assert.equal(downloadName({ title: "", url: "https://media.giphy.com/media/abc/giphy.webp", ext: "webp" }), "media.webp");
  assert.equal(downloadName({ title: "Nachrichten über Wasser", url: "https://v.redd.it/q/DASH_720.mp4", ext: "mp4" }), "Nachrichten-über-Wasser.mp4");
  assert.equal(slug("CON"), "_CON");
  for (const n of [downloadName({ title: "../../etc/passwd", ext: "txt" }), downloadName({ title: "a\\b:c*d", ext: "png" })]) assert.doesNotMatch(n, /[\\/:*?"<>|]|\.\./);
});

test("srcset: commas inside addresses survive, and the largest candidate wins", () => {
  const list = parseSrcset("https://res.cloudinary.com/x/w_400,h_300/a.jpg 400w, https://res.cloudinary.com/x/w_1600,h_1200/a.jpg 1600w");
  assert.deepEqual(list.map((c) => [c.url.split("/")[4], c.w]), [["w_400,h_300", 400], ["w_1600,h_1200", 1600]]);
  const img = { src: "https://upload.wikimedia.org/a/220px-X.jpg", currentSrc: "https://upload.wikimedia.org/a/220px-X.jpg", layoutWidth: 220,
    srcset: "//upload.wikimedia.org/a/330px-X.jpg 1.5x, //upload.wikimedia.org/a/440px-X.jpg 2x" };
  assert.equal(largestSource(img, { base: "https://en.wikipedia.org/wiki/X" }), "https://upload.wikimedia.org/a/440px-X.jpg");
  const pic = { src: "a.jpg", layoutWidth: 300, sources: [{ srcset: "big.jxl 3000w", type: "image/jxl" }, { srcset: "mid.webp 1200w, small.webp 600w", type: "image/webp" }] };
  assert.equal(largestSource(pic, { base: "https://e.example/", supports: (t) => t !== "image/jxl" }), "https://e.example/mid.webp");
});

test("full-size addresses on X and Reddit", () => {
  assert.equal(fullSizeUrl("https://pbs.twimg.com/media/GxYz123?format=webp&name=small"), "https://pbs.twimg.com/media/GxYz123?format=webp&name=orig");
  assert.equal(fullSizeUrl("https://pbs.twimg.com/media/GxYz123.png:large"), "https://pbs.twimg.com/media/GxYz123?format=png&name=orig");
  assert.equal(fullSizeUrl("https://preview.redd.it/abc.jpeg?width=640&s=1f"), "https://i.redd.it/abc.jpeg");
  assert.equal(fullSizeUrl("https://i.imgur.com/a6vwc0X_lq.mp4"), "https://i.imgur.com/a6vwc0X.mp4");
  assert.equal(fullSizeUrl("https://external-preview.redd.it/abc.jpeg?s=1"), "https://external-preview.redd.it/abc.jpeg?s=1");
});

test("protected media is refused with the toolkit's sentence; a reference may be kept", () => {
  const plan = downloadPlan({ kind: "video", url: null, protected: "The page plays this media through Encrypted Media Extensions (DRM).", streams: [{ type: "dash", url: "https://e.example/m.mpd" }] });
  assert.equal(plan.action, "refuse");
  assert.equal(plan.line, PROTECTED_LINE);
  assert.equal(plan.reference, true);
  assert.equal(downloadPlan({ kind: "video", protected: "x" }, { asGif: true }).action, "refuse");
  const ref = referenceOf({ page: "https://e.example/film", title: "Film", poster: "https://e.example/p.jpg", images: ["blob:https://e.example/1", "https://e.example/p.jpg"], previews: ["https://e.example/trailer.m3u8"] }, "2026-10-25T00:00:00Z");
  assert.equal(ref.label, REFERENCE_LABEL);
  assert.deepEqual(ref.images, ["https://e.example/p.jpg"]);
});

test("plans for plain files, page bytes, streams and GIFs", () => {
  assert.deepEqual(downloadPlan({ kind: "image", url: "https://pbs.twimg.com/media/A?format=jpg&name=small" }), { action: "url", url: "https://pbs.twimg.com/media/A?format=jpg&name=orig" });
  assert.equal(downloadPlan({ kind: "image", url: "data:image/png;base64,AAAA" }).action, "bytes");
  assert.equal(downloadPlan({ kind: "image", canvas: true }).action, "canvas");
  assert.equal(downloadPlan({ kind: "video", url: "blob:https://x.com/1", streams: [{ type: "hls", url: "https://video.twimg.com/a.m3u8" }] }).action, "stream");
  assert.equal(downloadPlan({ kind: "video", url: "blob:https://x.com/1", streams: [] }).action, "none");
  assert.deepEqual(downloadPlan({ kind: "video", url: "https://media.giphy.com/a.mp4", gifUrl: "https://media.giphy.com/a.gif" }, { asGif: true }), { action: "url", url: "https://media.giphy.com/a.gif" });
  assert.deepEqual(downloadPlan({ kind: "video", url: "https://video.twimg.com/tweet_video/A.mp4" }, { asGif: true }), { action: "gif", from: "video", url: "https://video.twimg.com/tweet_video/A.mp4" });
});

function frame(w, h, fn) {
  const rgba = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [r, g, b] = fn(x, y); rgba.set([r, g, b, 255], (y * w + x) * 4); }
  return rgba;
}

test("the GIF writer's output reads back through the toolkit's decoder", () => {
  const colours = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 255]];
  const frames = [0, 1, 2].map((k) => ({ rgba: frame(20, 10, (x, y) => colours[(x + y + k) % 4]), delayMs: 80 }));
  const gif = decodeGif(encodeGif({ width: 20, height: 10, frames }));
  assert.equal(gif.width, 20);
  assert.equal(gif.frames.length, 3);
  assert.equal(gif.frames[1].delayMs, 80);
  for (let k = 0; k < 3; k++) assert.deepEqual([...gif.frames[k].rgba], [...frames[k].rgba]);
});

test("a large many-coloured frame survives the LZW table resets", () => {
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) >> 16 & 255;
  const f = { rgba: frame(160, 120, () => [rnd() & 0xf8, rnd() & 0xf8, rnd() & 0xf8]), delayMs: 40 };
  const pal = gifPalette([f]);
  assert.ok(pal.length <= 256 && pal.length > 200);
  const back = decodeGif(encodeGif({ width: 160, height: 120, frames: [f] })).frames[0].rgba;
  let err = 0;
  for (let i = 0; i < back.length; i += 4) err += Math.abs(back[i] - f.rgba[i]) + Math.abs(back[i + 1] - f.rgba[i + 1]) + Math.abs(back[i + 2] - f.rgba[i + 2]);
  assert.ok(err / (160 * 120 * 3) < 40, `mean error ${err / (160 * 120 * 3)}`);
});

test("X media keeps its highest-bitrate MP4 and its HLS playlist", () => {
  const json = { data: { tweet: { __typename: "Tweet", rest_id: "1957913446118285360", legacy: { full_text: "gif", extended_entities: { media: [{ id_str: "1957913400000000000", type: "animated_gif", media_url_https: "https://pbs.twimg.com/tweet_video_thumb/A.jpg",
    video_info: { variants: [{ content_type: "application/x-mpegURL", url: "https://video.twimg.com/a.m3u8" }, { content_type: "video/mp4", bitrate: 256000, url: "https://video.twimg.com/low.mp4" }, { content_type: "video/mp4", bitrate: 2176000, url: "https://video.twimg.com/high.mp4" }] } },
    { id_str: "1957913400000000001", type: "photo", media_url_https: "https://pbs.twimg.com/media/B.jpg" }] } } } } };
  const [t] = tweetsIn(json);
  assert.equal(t.media[0].mp4, "https://video.twimg.com/high.mp4");
  assert.equal(t.media[0].hls, "https://video.twimg.com/a.m3u8");
  assert.equal("mp4" in t.media[1], false);
});
