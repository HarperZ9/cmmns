// Whole saves in a real (headless) Chrome on simulated pages (tests/full-capture-fixtures.js): a Reddit
// post brings its nested comments, opening "2 more replies" at the test's pace; the cap stops the
// opening and says so; an Instagram carousel brings every item at full size, its video, alt text,
// caption and comments; a likes-page thumbnail that cannot be opened is saved with a note that it
// is not the whole post; an X post brings its replies as a tree, its quote and its final link
// addresses. Every request is recorded: a save asks no host for anything but the post's own files.
// The markup is the shape the readers read; the sites' live markup is not checked here.
import test from "node:test";
import assert from "node:assert/strict";
import { browserSkip } from "./browser.js";
import { page, withPage } from "./capture-page.js";
import { REDDIT_PAGE, IG_PAGE, IG_LIKES, X_PAGE, YT_PAGE } from "./full-capture-fixtures.js";

const opts = { skip: browserSkip, timeout: 120000 };
const R = "/r/ColorTheory/comments/abc123/ochre/";
// Only the page, the extension's scripts and the post's own media files; never another address.
function onlyOwn(requests, origin, media) {
  const other = requests.filter((u) => !u.startsWith(origin + "/") && !media.some((m) => u.startsWith(m)));
  assert.deepEqual(other, [], "no request beyond the page and the post's own files");
  assert.ok(!requests.some((u) => /\.json(\?|$)|\/api\/|graphql/.test(u)), "no data address was asked for");
}
const flatIds = (list) => list.flatMap((c) => [c.id, ...flatIds(c.replies)]);

test("a Reddit save brings every comment as a tree, opening \"more replies\" at a person's pace", opts, () => withPage({ [R]: page("Ochre study", REDDIT_PAGE) }, async (s) => {
  await s.open("https://www.reddit.com" + R);
  const r = await s.js("PBQuickSave.start(PBQuickSites.postMedia(document.querySelector('shreddit-post')).items[0]).then((x) => x.ok)");
  assert.equal(r, true);
  await s.until("__dl.some((d) => /\\.thread\\.json$/.test(d.filename))");
  const thread = JSON.parse((await s.file("\\.thread\\.json$")).text), md = (await s.file("\\.md$")).text;
  assert.equal(thread.format, "cmmns.capture-thread/1");
  assert.deepEqual(flatIds(thread.comments), ["t1_c1", "t1_c2", "t1_c3", "t1_c4", "t1_c5", "t1_c6"]);
  const c3 = thread.comments[0].replies[0].replies[0];
  assert.deepEqual([c3.author, c3.depth, c3.score, c3.postedAt, c3.permalink], ["u/cy", 2, 4, "2026-10-22T10:00:00.000Z", "https://www.reddit.com/r/ColorTheory/comments/abc123/ochre/c3/"]);
  assert.deepEqual(c3.links, ["https://example.org/why"]);
  assert.deepEqual({ ...thread.completeness, countNote: undefined, reason: undefined }, { expected: 6, captured: 6, missing: 0, cap: 200, capHit: false, moreStubs: 0, expanded: 1, complete: true, countNote: undefined, reason: undefined });
  assert.match(md, /^thread_file: ".+\.thread\.json"$/m);
  assert.match(md, /^comments_captured: 6$/m);
  assert.match(md, /Captured 6 of 6 comments; after opening 1 "more" control\./);
  assert.match(md, /^  - \*\*u\/ed\*\* \(3 points, 2026-10-21T10:00:00\.000Z\)/m);
  assert.match(md, /- Links: .*https:\/\/example\.org\/ochre/);
  onlyOwn(s.requests, "https://www.reddit.com", ["https://i.redd.it/"]);
}));

test("the cap stops the opening, and the record says how many are missing", opts, () => withPage({ [R]: page("Ochre study", REDDIT_PAGE, { threadCap: 4 }) }, async (s) => {
  await s.open("https://www.reddit.com" + R);
  await s.js("PBQuickText.run('note', { raw: { ...PBQuickSites.postMetaOf(document.querySelector('shreddit-post')), kind: 'text' } }).then((x) => x.ok)");
  await s.until("__dl.some((d) => /\\.thread\\.json$/.test(d.filename))");
  const c = JSON.parse((await s.file("\\.thread\\.json$")).text).completeness;
  assert.deepEqual([c.expected, c.captured, c.missing, c.cap, c.capHit, c.moreStubs, c.expanded, c.complete], [6, 4, 2, 4, true, 1, 0, false]);
  assert.equal(await s.js("!!document.querySelector('#more')"), true, "the control was left alone");
  assert.match((await s.file("\\.md$")).text, /Captured 4 of 6 comments; the cap of 4 stopped loading more; 1 "more replies" control was left unopened\./);
}));

test("source protection keeps only the comments the page shows and says why", opts, () => withPage({ [R]: page("Ochre study", REDDIT_PAGE, { protection: true }) }, async (s) => {
  await s.open("https://www.reddit.com" + R);
  await s.js("PBQuickText.run('note', { raw: { ...PBQuickSites.postMetaOf(document.querySelector('shreddit-post')), kind: 'text' } }).then((x) => x.ok)");
  await s.until("__dl.some((d) => /\\.thread\\.json$/.test(d.filename))");
  const c = JSON.parse((await s.file("\\.thread\\.json$")).text).completeness;
  assert.deepEqual([c.captured, c.expanded, c.complete], [4, 0, false]);
  assert.match(c.reason, /source protection is on/);
  assert.equal(await s.js("!!document.querySelector('#more')"), true);
}));

test("an Instagram save brings every carousel item at full size, the video, alt text, caption and comments", opts, () => withPage({ "/p/CAR0usel1/": page("Instagram", IG_PAGE) }, async (s) => {
  await s.open("https://www.instagram.com/p/CAR0usel1/");
  const r = await s.js("PBQuickSave.start(PBQuickResolve.fromElement(document.getElementById('pic'))).then((x) => ({ ok: x.ok, names: x.names }))");
  assert.equal(r.ok, true);
  await s.until("__dl.some((d) => /\\.md$/.test(d.filename))");
  const dl = await s.downloads(), md = (await s.file("\\.md$")).text, thread = JSON.parse((await s.file("\\.thread\\.json$")).text);
  assert.deepEqual(dl.filter((d) => !d.text).map((d) => d.filename.replace(/^.*\./, "")), ["png", "mp4"]);
  assert.ok(dl.every((d) => d.site === "instagram"));
  assert.match(md, /> Ochre beside blue\.\n> Two frames\./);
  assert.match(md, /^handle: "painter"$/m);
  assert.match(md, /^posted: "2026-10-20T12:00:00\.000Z"$/m);
  assert.match(md, /1\. image 1080x1080: https:\/\/scontent\.cdninstagram\.com\/v\/t51\/AAA_n\.jpg\?stp=dst-jpg_e35_p1080x1080\n {3}Alt text: A painted wall in ochre\./);
  assert.match(md, /2\. video 720x1280: https:\/\/scontent\.cdninstagram\.com\/o1\/v\/t2\/BBB_video\.mp4/);
  assert.match(md, /Engagement at save: likes 41, comments 3/);
  assert.match(md, /The site marks this post as edited\./);
  assert.deepEqual(flatIds(thread.comments), ["900", "901", "902"]);
  assert.equal(thread.comments[0].replies[0].author, "@bo");
  assert.deepEqual([thread.completeness.expected, thread.completeness.captured, thread.completeness.complete], [3, 3, true]);
  // The files come from the full-size addresses; the thumbnail is only the picture the page drew.
  const full = ["https://scontent.cdninstagram.com/v/t51/AAA_n.jpg?stp=dst-jpg_e35_p1080x1080", "https://scontent.cdninstagram.com/o1/v/t2/BBB_video.mp4"];
  for (const u of full) assert.ok(s.requests.includes(u), u);
  onlyOwn(s.requests, "https://www.instagram.com", [...full, "https://scontent.cdninstagram.com/v/t51/AAA_n.jpg?stp=dst-jpg_e15_s240x240"]);
}));

test("a likes-page thumbnail whose post cannot be opened is saved with a note that it is not the whole post", opts, () => withPage({ "/your_activity/interactions/likes/": page("Instagram", IG_LIKES) }, async (s) => {
  await s.open("https://www.instagram.com/your_activity/interactions/likes/");
  await s.js("PBQuickSave.start(PBQuickResolve.fromElement(document.getElementById('tile'))).then((x) => x.ok)");
  await s.until("__dl.some((d) => /\\.md$/.test(d.filename))");
  assert.deepEqual(await s.js("__msgs.filter((m) => m === 'pb-cap-open')"), ["pb-cap-open"], "the post was asked to open first");
  const md = (await s.file("\\.md$")).text;
  assert.match(md, /## Not the whole post\n\nThis page showed only a thumbnail, and the post could not be opened to save it whole \(no background tab in this test\)\. The post: https:\/\/www\.instagram\.com\/p\/LIKED0001\//);
  assert.match(md, /^post: "https:\/\/www\.instagram\.com\/p\/LIKED0001\/"$/m);
  assert.doesNotMatch(md, /Followers/, "the profile's description is never taken for the post's words");
}));

test("an X save brings the replies as a tree, the quote with its picture's alt text, and final link addresses", opts, () => withPage({ "/painter/status/100": page("X", X_PAGE) }, async (s) => {
  await s.open("https://x.com/painter/status/100");
  await s.until("PBQuickSites.xData().size >= 5");
  await s.js("PBQuickText.run('note', { raw: { ...PBQuickSites.postMetaOf(document.querySelector('article')), kind: 'text' } }).then((x) => x.ok)");
  await s.until("__dl.some((d) => /\\.thread\\.json$/.test(d.filename))");
  const md = (await s.file("\\.md$")).text, thread = JSON.parse((await s.file("\\.thread\\.json$")).text);
  assert.match(md, /> Ochre study https:\/\/example\.org\/ochre/);
  assert.doesNotMatch(md, /t\.co\//);
  assert.match(md, /Quoting @quoted \(https:\/\/x\.com\/quoted\/status\/50\):\n\n> The older one\.\n\n- Quoted image: https:\/\/pbs\.twimg\.com\/media\/Q\?format=jpg&name=orig \(Alt text: A swatch card\)/);
  assert.deepEqual(thread.comments.map((c) => [c.id, c.author, c.replies.map((r) => r.id)]), [["101", "@ann", ["102"]], ["103", "@bo", ["104"]]]);
  assert.deepEqual([thread.completeness.expected, thread.completeness.captured, thread.completeness.expanded, thread.completeness.complete], [4, 4, 1, true]);
  assert.equal(thread.comments[0].score, 7);
  onlyOwn(s.requests, "https://x.com", []);
}));


test("a YouTube reference brings the top comments and their opened replies, with YouTube's redirect links resolved", opts, () => withPage({ "/watch": page("Video - YouTube", YT_PAGE) }, async (s) => {
  await s.open("https://www.youtube.com/watch?v=abcdefghijk");
  const t = await s.js("PBFullCapture.capture({ site: 'youtube', postUrl: 'https://www.youtube.com/watch?v=abcdefghijk&t=3s' }, PB.normalizeSettings(null))");
  assert.deepEqual(flatIds(t.comments), ["Ug1", "Ug2", "Ug2.r1"]);
  assert.deepEqual([t.comments[1].author, t.comments[1].score, t.comments[1].timeShown, t.comments[1].links], ["@bo", 3, "2 days ago", ["https://example.org/lens"]]);
  assert.equal(t.comments[1].replies[0].text, "A 35 mm.");
  assert.deepEqual([t.completeness.expected, t.completeness.captured, t.completeness.expanded, t.completeness.complete], [3, 3, 1, true]);
  onlyOwn(s.requests, "https://www.youtube.com", []);
}));
