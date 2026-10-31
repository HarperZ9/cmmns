// Whole saves (src/core/capture-thread.js, src/core/instagram-data.js, src/core/media-meta.js): the
// comment tree and its completeness numbers, Instagram's own post record read in full, the sidecar's
// thread rows, and the settings that bound the expansion. The page side runs in a real Chrome in
// tests/full-capture.browser.test.js.
import test from "node:test";
import assert from "node:assert/strict";
import { captureThread, commentTree, completeness, commentsMarkdown, countOf, expandPace, threadSummary } from "../src/core/capture-thread.js";
import { igItemsIn, igCommentsIn, igPostMeta, igShortcode } from "../src/core/instagram-data.js";
import { postMeta, sidecarMarkdown, sidecarJson } from "../src/core/media-meta.js";
import { normalizeSettings } from "../src/core/settings.js";
import { tweetsIn } from "../src/core/xdata.js";
import { IG_POST } from "./full-capture-fixtures.js";

const flat = [
  { id: "c1", parent: null, depth: 0, author: "u/ann", text: "Top.", score: "12", postedAt: "2026-10-20T21:04:00.000000+0000" },
  { id: "c2", parent: "c1", depth: 1, author: "u/bo", text: "Reply\nwith two lines.", score: 3 },
  { id: "c3", parent: "c2", depth: 2, author: "u/cy", text: "Deeper.", score: "1,204" },
  { id: "c4", parent: "gone", depth: 3, author: "u/di", text: "Parent not on the page." },
  { id: "c5", parent: null, depth: 0, author: "u/ed", text: "Second top." },
];

test("comments nest under their parents, and an orphan is kept at the top with its parent marked missing", () => {
  const tree = commentTree(flat);
  assert.deepEqual(tree.map((c) => c.id), ["c1", "c4", "c5"]);
  assert.deepEqual([tree[0].replies[0].id, tree[0].replies[0].replies[0].id, tree[0].replies[0].replies[0].depth], ["c2", "c3", 2]);
  assert.equal(tree[1].parentMissing, true);
  assert.equal(tree[1].depth, 0);
  assert.equal(tree[1].siteDepth, 3);
  assert.equal(tree[0].replies[0].replies[0].score, 1204);
  assert.equal(tree[0].postedAt, "2026-10-20T21:04:00.000Z");
  assert.equal(tree[0].replies[0].text, "Reply\nwith two lines.");
});

test("a comment read twice is kept once, and a parent cycle cannot loop", () => {
  const tree = commentTree([{ id: "a", parent: "b", text: "x" }, { id: "b", parent: "a", text: "y" }, { id: "a", parent: "b", text: "x2" }]);
  assert.equal(tree.length + tree.reduce((n, c) => n + c.replies.length, 0), 2);
});

test("completeness counts expected against captured, and says when the cap stopped the expansion", () => {
  assert.deepEqual(pick(completeness({ expected: 6, captured: 6 })), { expected: 6, captured: 6, missing: 0, capHit: false, moreStubs: 0, complete: true });
  assert.deepEqual(pick(completeness({ expected: "40", captured: 10, cap: 10, capHit: true, stubs: 2 })), { expected: 40, captured: 10, missing: 30, capHit: true, moreStubs: 2, complete: false });
  assert.equal(completeness({ expected: null, captured: 5 }).complete, "unknown");
  assert.equal(completeness({ expected: null, captured: 5, stubs: 1 }).complete, false);
  // The site's count can include deleted comments: short of it, and said so.
  assert.match(completeness({ expected: 8, captured: 6 }).countNote, /deleted, removed or hidden/);
  assert.equal(countOf("1.2K"), "1.2K");
  assert.equal(completeness({ expected: "1.2K", captured: 3 }).expected, null);
});
const pick = (c) => ({ expected: c.expected, captured: c.captured, missing: c.missing, capHit: c.capHit, moreStubs: c.moreStubs, complete: c.complete });

test("the thread record carries the tree, the count of every comment in it, and a readable form", () => {
  const t = captureThread({ site: "reddit", post: { url: "https://www.reddit.com/r/a/comments/x1/s/", id: "x1" }, comments: flat, expected: 7, cap: 200, stubs: 1, expanded: 2, source: "the rendered page" });
  assert.equal(t.format, "cmmns.capture-thread/2");
  assert.equal(t.completeness.captured, 5);
  assert.equal(t.completeness.missing, 2);
  assert.equal(t.completeness.complete, false);
  const md = commentsMarkdown(t).join("\n");
  assert.match(md, /Captured 5 of 7 comments; after opening 2 "more" controls; 1 "more replies" control was left unopened\./);
  assert.match(md, /^- \*\*u\/ann\*\* \(12 points, 2026-10-20T21:04:00\.000Z\)\n  > Top\.$/m);
  assert.match(md, /^    - \*\*u\/cy\*\* \(1204 points\)\n      > Deeper\.$/m);
  assert.match(md, /^  - \*\*u\/bo\*\* \(3 points\)\n    > Reply\n    > with two lines\.$/m);
  assert.deepEqual(threadSummary(t, "a.thread.json"), { file: "a.thread.json", expected: 7, expectedCounts: "all", captured: 5, capturedDirect: 2, capturedNested: 3, continuations: null, complete: false, capHit: false, cap: 200, moreStubs: 1 });
});

test("the expansion waits at a person's pace", () => {
  for (let n = 0; n < 30; n++) { const w = expandPace(Math.random, n); assert.ok(w >= 1200 && w <= 8000, String(w)); }
  assert.equal(expandPace(() => 0, 1), 1200);
});

test("Instagram's own post record gives every carousel item at full size, the video, alt text, caption, time and counts", () => {
  const [it] = igItemsIn(IG_POST);
  assert.equal(it.shortcode, "CAR0usel1");
  assert.equal(it.caption, "Ochre beside blue.\nTwo frames.");
  assert.equal(it.postedAt, "2026-10-20T12:00:00.000Z");
  assert.equal(it.edited, true);
  assert.deepEqual(it.media.map((m) => [m.kind, m.url, m.alt, m.width]), [
    ["image", "https://scontent.cdninstagram.com/v/t51/AAA_n.jpg?stp=dst-jpg_e35_p1080x1080", "A painted wall in ochre.", 1080],
    ["video", "https://scontent.cdninstagram.com/o1/v/t2/BBB_video.mp4", null, 720],
  ]);
  assert.equal(it.media[1].poster, "https://scontent.cdninstagram.com/v/t51/BBB_n.jpg?stp=dst-jpg_e35_p720x1280");
  const m = igPostMeta(it);
  assert.deepEqual([m.site, m.handle, m.postUrl, m.engagement.likes, m.engagement.comments, m.location], ["instagram", "painter", "https://www.instagram.com/p/CAR0usel1/", 41, 3, "Seattle"]);
  assert.equal(m.items.length, 2);
});

test("Instagram comments are found under comment keys, with replies joined to their parent, and a caption is never a comment", () => {
  const cs = igCommentsIn(IG_POST);
  assert.deepEqual(cs.map((c) => [c.id, c.parent, c.author]).sort(), [["900", null, "ann"], ["901", "900", "bo"], ["902", null, "cy"]]);
  assert.equal(cs.find((c) => c.id === "900").postedAt, "2026-10-20T13:00:00.000Z");
  assert.equal(igShortcode("/reel/AbCdE12/"), "AbCdE12");
  assert.equal(igShortcode("/your_activity/interactions/likes/"), null);
});

test("the sidecar names the thread file, carries the counts, the per-item alt text and the comments; the .json holds the counts, not the tree", () => {
  const thread = captureThread({ site: "instagram", comments: [{ id: "1", author: "@ann", text: "Lovely." }], expected: 1 });
  const meta = { ...postMeta({ ...igPostMeta(igItemsIn(IG_POST)[0]) }), threadCapture: thread, threadFile: "p.thread.json" };
  const md = sidecarMarkdown(meta, ["p-1.jpg", "p-2.mp4"]);
  assert.match(md, /^thread_file: "p\.thread\.json"$/m);
  assert.match(md, /^comments_expected: 1$/m);
  assert.match(md, /^comments_complete: true$/m);
  assert.match(md, /^edited: true$/m);
  assert.match(md, /## Media\n\n1\. image 1080x1080: https:\/\/scontent\.cdninstagram\.com\/v\/t51\/AAA_n\.jpg\?stp=dst-jpg_e35_p1080x1080\n {3}Alt text: A painted wall in ochre\./);
  assert.match(md, /## Comments\n\nCaptured 1 of 1 comment\./);
  const json = JSON.parse(sidecarJson(meta, ["p-1.jpg"]));
  assert.equal(json.threadCapture, undefined);
  assert.deepEqual([json.thread.file, json.thread.captured, json.thread.complete], ["p.thread.json", 1, true]);
});

test("X's data keeps each t.co address with the address it stands for, and each picture's alt text", () => {
  const [t] = tweetsIn({ data: { __typename: "Tweet", rest_id: "7", legacy: { full_text: "See https://t.co/abc", entities: { urls: [{ url: "https://t.co/abc", expanded_url: "https://example.org/ochre" }] },
    extended_entities: { media: [{ id_str: "1", type: "photo", media_url_https: "https://pbs.twimg.com/media/A.jpg", ext_alt_text: "Ochre swatch" }] } } } });
  assert.deepEqual(t.urls, [{ short: "https://t.co/abc", expanded: "https://example.org/ochre" }]);
  assert.equal(t.media[0].alt, "Ochre swatch");
});

test("comment capture is on by default with a cap of 200, and source protection holds the expansion off", () => {
  const d = normalizeSettings(null);
  assert.deepEqual([d.threadCapture, d.threadExpand, d.threadCap], [true, true, 200]);
  assert.equal(normalizeSettings({ threadCap: 99999 }).threadCap, 5000);
  assert.equal(normalizeSettings({ threadCap: -3 }).threadCap, 0);
  const p = normalizeSettings({ protection: true, threadExpand: true });
  assert.deepEqual([p.threadCapture, p.threadExpand], [true, false]);
});
