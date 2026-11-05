// Share and campaign parameters leave stored addresses; signatures, timestamps and media stay.
import { test } from "node:test";
import assert from "node:assert/strict";
import { stripTracking, hostTrackers, watchFromThumb } from "../src/core/url-clean.js";
import { postMeta, sidecarMarkdown, sidecarJson } from "../src/core/media-meta.js";
import { sourceText, videoRecord } from "../src/core/video-bundle.js";

test("share parameters come out on the hosts that use them for tracking", () => {
  assert.equal(stripTracking("https://youtu.be/abcdefghijk?si=Zq1X9shareid"), "https://youtu.be/abcdefghijk");
  assert.equal(stripTracking("https://www.youtube.com/watch?v=abcdefghijk&si=Zq1&pp=ygU"), "https://www.youtube.com/watch?v=abcdefghijk");
  assert.equal(stripTracking("https://x.com/a/status/123?s=20&t=AbC"), "https://x.com/a/status/123");
  assert.equal(stripTracking("https://www.instagram.com/p/XYZ/?igsh=MWx0"), "https://www.instagram.com/p/XYZ/");
  assert.equal(stripTracking("https://pith.science/p/1?utm_source=x&utm_medium=social&utm_campaign=c&social_variant=1"),
    "https://pith.science/p/1?social_variant=1");
});

test("controls: parameters that carry meaning stay", () => {
  // redd.it media signs its addresses with s=; dropping it breaks the file address.
  const reddit = "https://packaged-media.redd.it/o89jj/pb/m2-res_1080p.mp4?m=DASH&v=1&e=17&s=abc123";
  assert.equal(stripTracking(reddit), reddit);
  // YouTube t= is the time in the video.
  assert.equal(stripTracking("https://www.youtube.com/watch?v=abcdefghijk&t=95s&si=Q"), "https://www.youtube.com/watch?v=abcdefghijk&t=95s");
  // s= and t= on other hosts are their own business.
  assert.equal(stripTracking("https://example.org/search?s=term&t=2"), "https://example.org/search?s=term&t=2");
  assert.equal(stripTracking("https://x.com/search?q=cats&src=typed_query"), "https://x.com/search?q=cats&src=typed_query");
});

test("an address with nothing to remove comes back byte for byte", () => {
  for (const u of ["https://example.org/a?b=1#frag", "https://EXAMPLE.org/%7Euser", "not a url", "mailto:a@example.org?utm_source=x", null, ""])
    assert.equal(stripTracking(u), u);
  assert.equal(stripTracking("https://example.org/p?utm_source=x#sec"), "https://example.org/p#sec");
});

test("host rules match subdomains, not look-alike hosts", () => {
  assert.ok(hostTrackers("m.youtube.com").has("si"));
  assert.ok(!hostTrackers("notyoutube.com").has("si"));
  assert.equal(stripTracking("https://notx.com/a?s=20"), "https://notx.com/a?s=20");
});

test("a sidecar stores clean addresses and keeps the post text and media address as written", () => {
  const text = "Read this https://pith.science/p/1?utm_source=x&utm_medium=social";
  const media = "https://packaged-media.redd.it/a/pb/m2.mp4?m=1&s=sig";
  const m = postMeta({
    site: "x", text, postUrl: "https://x.com/a/status/123?s=20&t=AbC", mediaUrl: media,
    links: ["https://youtu.be/abcdefghijk?si=share"], cards: [{ url: "https://example.org/a?fbclid=IwAR", title: "Card" }],
    quoted: { text: "q", url: "https://x.com/b/status/9?s=46" },
  });
  assert.equal(m.postUrl, "https://x.com/a/status/123");
  assert.equal(m.mediaUrl, media);
  assert.equal(m.text, text);
  assert.deepEqual(m.links, ["https://youtu.be/abcdefghijk", "https://pith.science/p/1"]);
  assert.equal(m.cards[0].url, "https://example.org/a");
  assert.equal(m.quoted.url, "https://x.com/b/status/9");
  const md = sidecarMarkdown(m, ["a.mp4"]);
  assert.ok(md.includes('post: "https://x.com/a/status/123"'));
  assert.ok(md.includes(text), "the post text stays verbatim");
  assert.ok(!/[?&](si|utm_medium)=/.test(md.replace(text, "")), "no share parameter outside the verbatim text");
  assert.equal(JSON.parse(sidecarJson(m, ["a.mp4"])).postUrl, "https://x.com/a/status/123");
});

test("a video bundle records the watch address without share parameters", () => {
  assert.equal(videoRecord({ url: "https://www.youtube.com/watch?v=abcdefghijk&si=share" }).url, "https://www.youtube.com/watch?v=abcdefghijk");
  assert.match(sourceText({ url: "https://youtu.be/abcdefghijk?si=share", how: "test" }), /^Source: https:\/\/youtu\.be\/abcdefghijk\n/);
});

test("a YouTube thumbnail saved from the home page records its watch address", () => {
  const media = "https://i.ytimg.com/vi/N-psPlviSSY/hqdefault.jpg?sqp=-oay&rs=AOn4";
  const m = postMeta({ site: "youtube.com", mediaUrl: media, pageUrl: "https://www.youtube.com/", title: "(74) YouTube" });
  assert.equal(m.postUrl, "https://www.youtube.com/watch?v=N-psPlviSSY");
  assert.equal(m.mediaUrl, media);
  assert.ok(sidecarMarkdown(m, ["a.avif"]).includes('post: "https://www.youtube.com/watch?v=N-psPlviSSY"'));
});

test("controls: no watch address from a thumbnail off YouTube, a non-thumbnail, or over a post", () => {
  assert.equal(watchFromThumb("https://i.ytimg.com/vi/N-psPlviSSY/hqdefault.jpg", "https://example.org/blog"), null);
  assert.equal(watchFromThumb("https://yt3.ggpht.com/abc/photo.jpg", "https://www.youtube.com/"), null);
  assert.equal(watchFromThumb("https://i.ytimg.com/vi_webp/N-psPlviSSY/maxresdefault.webp", "https://m.youtube.com/feed"), "https://www.youtube.com/watch?v=N-psPlviSSY");
  const own = postMeta({ postUrl: "https://www.youtube.com/watch?v=aaaaaaaaaaa", mediaUrl: "https://i.ytimg.com/vi/bbbbbbbbbbb/hqdefault.jpg", pageUrl: "https://www.youtube.com/watch?v=aaaaaaaaaaa" });
  assert.equal(own.postUrl, "https://www.youtube.com/watch?v=aaaaaaaaaaa");
  assert.equal(postMeta({ mediaUrl: "https://i.ytimg.com/vi/N-psPlviSSY/hqdefault.jpg" }).postUrl, null);
});
