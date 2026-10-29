// Planted test for the name-collision defect: two posts with the same handle, day and first words
// once asked for the same file name, so "uniquify" saved the second as "name (1).jpg" and a note could
// name the first post's file. Each name now carries the post id, so different posts never collide; a
// post saved again still gets "(1)" names, and its sidecar must list those. The page script and the
// worker run together over a simulated chrome.downloads (tests/downloads-sim.js), in Chrome's and
// Firefox's manner. Control: with CMMNS_SIM_SRC (or DAYLIGHT_SIM_SRC) pointing at a checkout from
// before the fix, the collision tests fail.
import test from "node:test";
import assert from "node:assert/strict";
import { makeBrowser, post, listed } from "./downloads-sim.js";

const DIR = "CMMNS/x/", STEM = "horacioaltuna_2026-10-28_frederic-pillot";
const settings = { mediaEmbed: false, mediaSidecar: true };
const id = (n) => `${STEM}_${n}`;
const gal = (n, i) => `${STEM}-${i}_${n}`;
const suffixed = (b) => [...b.files.keys()].filter((k) => / \(\d+\)\./.test(k));

// Saves the given images of post `n` as one gallery (one sidecar for the post), as the inline button does.
async function gallery(b, n, indexes, total = 4, text = undefined) {
  const names = [];
  let meta = null;
  for (const index of indexes) {
    const t = post(n, { media: `https://pbs.twimg.com/media/G${n}x${index}?format=jpg&name=orig` });
    if (text !== undefined) t.meta.text = text;
    const r = await b.save.start(t, { index, total, quiet: true, oneSidecar: true, again: true });
    assert.equal(r.ok, true, r.line);
    names.push(...r.names);
    meta = meta || r.meta;
  }
  await b.save.postSidecar(meta, names);
  await b.settle();
  return names;
}

for (const flavour of ["chrome", "firefox"]) {
  test(`${flavour}: a single save is named after its post and its sidecar names it`, async () => {
    const b = makeBrowser({ flavour, settings });
    const r = await b.save.start(post("1"), { quiet: true });
    assert.equal(r.ok, true, r.line);
    await b.settle();
    assert.deepEqual([...b.files.keys()].sort(), [`${DIR}${id(1)}.jpg`, `${DIR}${id(1)}.md`]);
    const md = b.md(`${DIR}${id(1)}.md`);
    assert.deepEqual(listed(md), [`${id(1)}.jpg`]);
    assert.match(md, new RegExp(`^- File: ${id(1)}\\.jpg$`, "m"));
  });

  test(`${flavour}: two posts with the same first words get their own names, no (1), each note its own file`, async () => {
    const b = makeBrowser({ flavour, settings });
    const one = await b.save.start(post("1"), { quiet: true });
    const two = await b.save.start(post("2"), { quiet: true });
    assert.equal(one.ok && two.ok, true, two.line);
    await b.settle();
    assert.deepEqual([...one.names, ...two.names], [`${id(1)}.jpg`, `${id(2)}.jpg`]);
    assert.deepEqual(suffixed(b), [], "the browser never had to add a (1)");
    for (const n of [1, 2]) {
      const md = b.md(`${DIR}${id(n)}.md`);
      assert.deepEqual(listed(md), [`${id(n)}.jpg`], "each note names its own post's file");
      assert.match(md, new RegExp(`status/${n}\\b`));
      assert.ok(b.files.has(`${DIR}${id(n)}.jpg`), "the named file exists");
    }
  });

  test(`${flavour}: posts with no text (slug "post"), two images each, pair every note with its images`, async () => {
    const b = makeBrowser({ flavour, settings });
    const a = await gallery(b, "11", [0, 1], 2, "");
    const c = await gallery(b, "12", [0, 1], 2, "");
    const s = (n, i) => `horacioaltuna_2026-10-28_post${i ? "-" + i : ""}_${n}`;
    assert.deepEqual(a, [`${s(11, 1)}.jpg`, `${s(11, 2)}.jpg`]);
    assert.deepEqual(c, [`${s(12, 1)}.jpg`, `${s(12, 2)}.jpg`]);
    assert.equal(new Set([...a, ...c]).size, 4, "four images, four names");
    assert.deepEqual(suffixed(b), [], "no browser suffix on any file");
    assert.deepEqual(listed(b.md(`${DIR}${s(11)}.md`)), a);
    assert.deepEqual(listed(b.md(`${DIR}${s(12)}.md`)), c);
    // Every file a note lists was written under that exact name, with that post's image in it.
    for (const [n, names] of [["11", a], ["12", c]]) for (const [i, f] of names.entries()) {
      const bytes = b.files.get(DIR + f);
      assert.ok(bytes, f);
      assert.match(new TextDecoder().decode(bytes), new RegExp(`G${n}x${i}\\?`), `${f} holds image ${i + 1} of post ${n}`);
    }
  });

  test(`${flavour}: two images of one post saved one at a time each get their own name and note`, async () => {
    const b = makeBrowser({ flavour, settings });
    const names = [];
    for (const index of [0, 1]) {
      const r = await b.save.start(post("5", { media: `https://pbs.twimg.com/media/I${index}?format=jpg&name=orig` }), { index, total: 2, quiet: true });
      assert.equal(r.ok, true, r.line);
      names.push(...r.names);
    }
    await b.settle();
    assert.deepEqual(names, [`${gal(5, 1)}.jpg`, `${gal(5, 2)}.jpg`]);
    assert.deepEqual(listed(b.md(`${DIR}${gal(5, 1)}.md`)), [`${gal(5, 1)}.jpg`]);
    assert.deepEqual(listed(b.md(`${DIR}${gal(5, 2)}.md`)), [`${gal(5, 2)}.jpg`]);
  });

  test(`${flavour}: the same post saved again lists its own (1) file`, async () => {
    const b = makeBrowser({ flavour, settings });
    await b.save.start(post("1"), { quiet: true });
    const r = await b.save.start(post("1"), { quiet: true, again: true });
    assert.equal(r.ok, true, r.line);
    await b.settle();
    assert.deepEqual([...r.names], [`${id(1)} (1).jpg`]);
    const md = b.md(`${DIR}${id(1)} (1).md`);
    assert.deepEqual(listed(md), [`${id(1)} (1).jpg`], "the sidecar names the file this save wrote");
    assert.match(md, new RegExp(`^- File: ${id(1)} \\(1\\)\\.jpg$`, "m"));
    // The first save's sidecar is untouched and still names its own file.
    assert.deepEqual(listed(b.md(`${DIR}${id(1)}.md`)), [`${id(1)}.jpg`]);
  });

  test(`${flavour}: a gallery saved again lists its (1) files under a (1) sidecar`, async () => {
    const b = makeBrowser({ flavour, settings });
    assert.deepEqual(await gallery(b, "3", [0, 1, 2, 3]), [1, 2, 3, 4].map((i) => `${gal(3, i)}.jpg`));
    assert.deepEqual(await gallery(b, "3", [0, 2]), [`${gal(3, 1)} (1).jpg`, `${gal(3, 3)} (1).jpg`]);
    assert.deepEqual(listed(b.md(`${DIR}${id(3)}.md`)), [1, 2, 3, 4].map((i) => `${gal(3, i)}.jpg`));
    assert.deepEqual(listed(b.md(`${DIR}${id(3)} (1).md`)), [`${gal(3, 1)} (1).jpg`, `${gal(3, 3)} (1).jpg`]);
  });

  test(`${flavour}: one image of a saved gallery, saved alone, gets a sidecar beside its own file`, async () => {
    const b = makeBrowser({ flavour, settings });
    const t = post("4", { media: "https://pbs.twimg.com/media/G2?format=jpg&name=orig" });
    await b.save.start(t, { index: 2, total: 4, quiet: true });
    const r = await b.save.start(t, { index: 2, total: 4, quiet: true, again: true });
    await b.settle();
    assert.deepEqual([...r.names], [`${gal(4, 3)} (1).jpg`]);
    assert.deepEqual(listed(b.md(`${DIR}${gal(4, 3)} (1).md`)), [`${gal(4, 3)} (1).jpg`]);
  });
}

test("sidecarStem keeps the browser's suffix and drops the gallery's -1, with or without a post id", async () => {
  const { PB } = makeBrowser({ settings });
  assert.equal(PB.sidecarStem(["a-1.jpg", "a-2.jpg"]), "a");
  assert.equal(PB.sidecarStem(["a-1 (1).jpg", "a-3 (1).jpg"]), "a (1)");
  assert.equal(PB.sidecarStem(["a-1 (1).jpg"]), "a-1 (1)");
  assert.equal(PB.sidecarStem(["a.jpg"]), "a");
  assert.equal(PB.sidecarStem(["a-1_77.jpg", "a-2_77.jpg"]), "a_77");
  assert.equal(PB.sidecarStem(["a-1_77 (1).jpg", "a-3_77 (1).jpg"]), "a_77 (1)");
  assert.equal(PB.sidecarStem(["slip-1-3-1_77.jpg", "slip-1-3-2_77.jpg"]), "slip-1-3_77");
  assert.equal(PB.sidecarStem(["a-1_77.jpg"]), "a-1_77");
  assert.equal(PB.fileBase("C:\\Users\\r\\Downloads\\x\\a (1).jpg"), "a (1).jpg");
  assert.equal(PB.fileBase("/home/r/Downloads/x/a.jpg"), "a.jpg");
});

test("postTag: the post id from each site's address, else a stable short hash", async () => {
  const { PB } = makeBrowser({ settings });
  const tag = (postUrl) => PB.postTag({ postUrl });
  assert.equal(tag("https://x.com/doberes/status/2115566794098549198"), "2115566794098549198");
  assert.equal(tag("https://www.reddit.com/r/Pottery/comments/1abc2d/three_ways/"), "1abc2d");
  assert.equal(tag("https://bsky.app/profile/a.bsky.social/post/3kxyzabc"), "3kxyzabc");
  assert.equal(tag("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(tag("https://www.instagram.com/p/C0deX_1/"), "C0deX_1");
  assert.equal(tag("https://mastodon.social/@ana/112233445566"), "112233445566");
  const h = tag("https://example.org/gallery/page");
  assert.match(h, /^[0-9a-f]{8}$/);
  assert.equal(tag("https://example.org/gallery/page"), h, "the same address, the same tag");
  assert.notEqual(tag("https://example.org/gallery/other"), h);
  assert.match(PB.postTag({ mediaUrl: "https://cdn.example.org/a.jpg" }), /^[0-9a-f]{8}$/);
  assert.equal(PB.postTag({}), null);
  const m = { author: { handle: "a" }, postedAt: "2026-10-28T00:00:00Z", text: "hi", postUrl: "https://x.com/a/status/9" };
  assert.equal(PB.metaName(m, "jpg"), "a_2026-10-28_hi_9.jpg");
  assert.equal(PB.metaName(m, "jpg", "lib7"), "a_2026-10-28_hi_lib7.jpg", "a library's own tag replaces the post id");
});
