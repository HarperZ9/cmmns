// Save all likes: the kernels (src/core/likes.js). The route by address and by page structure, X's
// JSON to posts, the file picked for each media entry, dedupe before any request, names that the page
// and the command line agree on, like.js from the archive, the missing report, and the record that
// lets a run continue after a reload: 200 simulated likes with duplicates and earlier saves.
import test from "node:test";
import assert from "node:assert/strict";
import * as L from "../src/core/likes.js";
import { makePost, likesJson, timelineAnswer } from "./likes-fixture.js";

test("the likes list is found by its address, old and new, and by its structure", () => {
  assert.deepEqual(L.likesRoute("https://x.com/i/history/likes"), { site: "x", kind: "likes", user: null });
  assert.deepEqual(L.likesRoute("https://x.com/MeditInColor/likes"), { site: "x", kind: "likes", user: "MeditInColor" });
  assert.deepEqual(L.likesRoute("https://x.com/i/somewhere/new", { title: "History / X", selectedTab: "Likes" }), { site: "x", kind: "likes", user: null });
  for (const u of ["https://x.com/i/history/bookmarks", "https://x.com/MeditInColor", "https://x.com/i/likes", "https://example.org/a/likes"]) assert.equal(L.likesRoute(u), null, u);
  assert.equal(L.likesRoute("https://x.com/i/history", { title: "History / X", selectedTab: "Bookmarks" }), null, "the Bookmarks tab is not the likes");
});

test("parse and pick: pictures at name=orig, videos at the highest-bitrate MP4, streams kept apart", () => {
  const p = makePost("1850000000000000001", { media: [{ type: "photo", url: "https://pbs.twimg.com/media/AbC?format=png&name=small" }] });
  const [post] = L.parseLikes(likesJson([p], null));
  assert.equal(post.id, "1850000000000000001");
  assert.equal(L.pickLikeFile(post.media[0]).url, "https://pbs.twimg.com/media/AbC?format=jpg&name=orig", "the JSON's .jpg address, upgraded once");
  assert.deepEqual(L.pickLikeFile({ type: "photo", url: "https://pbs.twimg.com/media/Q1.png" }), { kind: "image", url: "https://pbs.twimg.com/media/Q1?format=png&name=orig", ext: "png" });
  assert.deepEqual(L.pickLikeFile({ type: "video", mp4: "https://video.twimg.com/v/hi.mp4", hls: "https://video.twimg.com/v/pl.m3u8" }), { kind: "video", url: "https://video.twimg.com/v/hi.mp4", ext: "mp4" });
  assert.equal(L.pickLikeFile({ type: "video", hls: "https://video.twimg.com/v/pl.m3u8" }).url, null);
  const v = L.parseLikes(likesJson([makePost("7", { media: [{ type: "video", mp4: "https://video.twimg.com/a/b.mp4" }] })], null))[0];
  assert.equal(L.manifestLine(v).files[0].url, "https://video.twimg.com/a/b.mp4");
});

test("names carry the post id, number gallery items, and match between runs", () => {
  const post = { id: "42", handle: "painter", posted: "2026-03-02T10:00:00.000Z", text: "Blue first, then the gold.", media: [{ type: "photo", url: "https://pbs.twimg.com/media/A.jpg" }, { type: "photo", url: "https://pbs.twimg.com/media/B.jpg" }] };
  const a = L.manifestLine(post), b = L.manifestLine(post);
  assert.deepEqual(a.files.map((f) => f.name), ["painter_2026-03-02_blue-first-then-the-gold-1_42.jpg", "painter_2026-03-02_blue-first-then-the-gold-2_42.jpg"]);
  assert.equal(a.sidecar, "painter_2026-03-02_blue-first-then-the-gold_42.md");
  assert.deepEqual(a.files, b.files);
  assert.equal(L.likeMeta(post).from, "x-likes", "the sidecar says it came from the likes");
});

// 200 likes over ten timeline pages: 15 posts also appear on a later page (X redraws them), 30 were
// saved before (priors), so 155 are new.
test("200 simulated likes: duplicates and earlier saves are skipped by one lookup each", () => {
  const posts = Array.from({ length: 200 }, (_, i) => makePost(String(1800000000000000000n + BigInt(i))));
  const known = new Set(posts.slice(170).map((p) => L.postKey(p.id))), lines = new Set();
  const counts = { new: 0, duplicate: 0 };
  const pages = [];
  for (let c = 0; c < 200; c += 20) pages.push(timelineAnswer(posts, c).json);
  pages.push(likesJson(posts.slice(40, 55), null));   // redrawn posts
  for (const json of pages) for (const p of L.parseLikes(json)) {
    const r = L.admit(known, lines, p);
    counts[r.kind]++;
    if (r.kind === "new") lines.add(p.id);
  }
  assert.deepEqual(counts, { new: 170, duplicate: 45 });
  assert.equal(lines.size, 170);
});

test("like.js from X's archive is the checklist, and the missing report lists what is not saved", () => {
  const js = `window.YTD.like.part0 = ${JSON.stringify([{ like: { tweetId: "1", fullText: "a", expandedUrl: "https://twitter.com/i/web/status/1" } }, { like: { tweetId: "2" } }, { like: { tweetId: "3" } }])}`;
  const list = L.parseArchiveLikes(js);
  assert.deepEqual(list.map((x) => x.id), ["1", "2", "3"]);
  assert.deepEqual(L.missingLikes(list, new Set([L.postKey("2")])), ["1", "3"]);
  assert.throws(() => L.parseArchiveLikes("not an archive"), /not X's like\.js/);
});

test("the record survives a reload: checkpoint, resume offered, counts kept", () => {
  let s = L.likesState(null, "2026-10-30T00:00:00.000Z");
  s.counts.found = 37; s.lines.push({ id: "9" });
  s = L.checkpoint(s, { lastId: "9", scrollY: 12345.6, status: "running" }, "2026-10-30T00:01:00.000Z");
  const kept = JSON.parse(JSON.stringify(s)), again = L.likesState(kept);
  assert.equal(L.resumable(again), true);
  assert.deepEqual([again.counts.found, again.checkpoint.lastId, again.checkpoint.scrollY], [37, "9", 12346]);
  assert.equal(L.resumable(L.checkpoint(again, { status: "stopped" })), false, "a run stopped on purpose is not offered again");
  assert.equal(L.checkpoint(again, { scrollY: 1, status: "paused" }).checkpoint.lastId, "9", "the last id is kept when a checkpoint has none");
  assert.equal(L.likesState({ format: "other" }).counts.found, 0, "a record of another format starts over");
});

test("the manifest round-trips, and a line still being written is skipped", () => {
  const lines = [L.manifestLine(makePost("5")), L.manifestLine(makePost("6"))];
  const text = L.manifestText(lines) + '{"id":"7","fil';
  assert.deepEqual(L.parseManifest(text).map((l) => l.id), ["5", "6"]);
});

test("the stage clock reports ms per item for each stage", () => {
  const c = L.stageClock();
  c.add("fetch", 300, 3); c.add("hash", 6, 3);
  assert.deepEqual(c.rows().map((r) => [r.stage, r.perItem]), [["fetch", 100], ["hash", 2]]);
  assert.match(c.table(), /\| fetch \| 3 \| 300 \| 100 \|/);
});

test("study-board filters: from my likes (with earlier saves of liked posts) and a posted-date range", () => {
  const liked = new Set(["111"]);
  const fromRun = { from: "x-likes", post: "https://x.com/a/status/222", posted: "2026-05-02T10:00:00.000Z" };
  const prior = { post: "https://x.com/a/status/111", posted: "2026-04-30T23:00:00.000Z" };
  const other = { post: "https://x.com/a/status/333", posted: "2026-05-01T00:00:00.000Z" };
  assert.deepEqual([fromRun, prior, other].map((f) => L.savesFilter(f, { likes: true, liked })), [true, true, false]);
  assert.deepEqual([fromRun, prior, other].map((f) => L.savesFilter(f, { since: "2026-05-01", until: "2026-05-01" })), [false, false, true]);
  assert.equal(L.savesFilter({ posted: null }, { since: "2026-01-01" }), false, "an undated note is outside any range");
  assert.equal(L.savesFilter({ posted: null }, {}), true, "no filter keeps everything");
});

test("the scroll pace: careful by default, every pace jittered, catching up moves further but waits as long", async () => {
  const src = (await import("node:fs")).readFileSync(new URL("../src/ext/likes-scroll.js", import.meta.url), "utf8");
  const g = {}; new Function("globalThis", "document", src)(g, { querySelectorAll: () => [] });
  const S = g.PBLikesScroll, lo = () => 0, hi = () => 0.999;
  assert.deepEqual(S.step(lo, 1, "careful"), { by: 1, wait: 2400 });
  assert.equal(S.step(hi, 1, "careful").wait, 6296);
  assert.equal(S.step(lo, 1, "nonsense").wait, 2400, "an unknown pace is careful");
  assert.ok(S.step(lo, 1, "brisk").wait < S.step(lo, 1, "reading").wait && S.step(lo, 1, "reading").wait < S.step(lo, 1, "careful").wait);
  assert.equal(S.step(lo, 1, "careful", true).wait, 2400, "catching up waits as long");
  assert.ok(S.step(lo, 1, "careful", true).by > S.step(lo, 1, "careful").by);
  assert.match(S.stopWhy({ error: "Something went wrong. Try reloading." }), /^X showed .*stopped to protect the account/);
  assert.match(S.PACE_NOTE, /rate-limited or flagged/);
});
