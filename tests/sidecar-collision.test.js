// Planted test for the name-collision defect: two posts with the same handle, day and first words
// ask for the same file name. "uniquify" saves the second as "name (1).jpg", and its sidecar must
// list that file, never the first post's "name.jpg". The page script and the worker run together
// over a simulated chrome.downloads (tests/downloads-sim.js), in Chrome's and Firefox's manner.
// Control: with DAYLIGHT_SIM_SRC pointing at a checkout from before the fix, the collision tests fail.
import test from "node:test";
import assert from "node:assert/strict";
import { makeBrowser, post, listed } from "./downloads-sim.js";

const DIR = "Daylight/x/", STEM = "horacioaltuna_2026-10-28_frederic-pillot";
const settings = { mediaEmbed: false, mediaSidecar: true };

for (const flavour of ["chrome", "firefox"]) {
  test(`${flavour}: a single save with no collision is unchanged`, async () => {
    const b = makeBrowser({ flavour, settings });
    const r = await b.save.start(post("1"), { quiet: true });
    assert.equal(r.ok, true, r.line);
    await b.settle();
    assert.deepEqual([...b.files.keys()].sort(), [`${DIR}${STEM}.jpg`, `${DIR}${STEM}.md`]);
    const md = b.md(`${DIR}${STEM}.md`);
    assert.deepEqual(listed(md), [`${STEM}.jpg`]);
    assert.match(md, new RegExp(`^- File: ${STEM}\\.jpg$`, "m"));
  });

  test(`${flavour}: the second of two colliding saves lists its own (1) file`, async () => {
    const b = makeBrowser({ flavour, settings });
    await b.save.start(post("1"), { quiet: true });
    const r = await b.save.start(post("2"), { quiet: true });
    assert.equal(r.ok, true, r.line);
    await b.settle();
    assert.deepEqual([...r.names], [`${STEM} (1).jpg`]);
    const md = b.md(`${DIR}${STEM} (1).md`);
    assert.deepEqual(listed(md), [`${STEM} (1).jpg`], "the sidecar names the file this save wrote");
    assert.match(md, new RegExp(`^- File: ${STEM} \\(1\\)\\.jpg$`, "m"));
    assert.doesNotMatch(md, new RegExp(`${STEM}\\.jpg`), "the other post's file is never named");
    assert.match(md, /status\/2/);
    // The first post's sidecar is untouched and still names its own file.
    assert.deepEqual(listed(b.md(`${DIR}${STEM}.md`)), [`${STEM}.jpg`]);
  });

  test(`${flavour}: a gallery saved again lists its (1) files under a (1) sidecar`, async () => {
    const b = makeBrowser({ flavour, settings });
    const gallery = async (indexes) => {
      const names = [];
      let meta = null;
      for (const index of indexes) {
        const r = await b.save.start(post("3", { media: `https://pbs.twimg.com/media/G${index}?format=jpg&name=orig` }), { index, total: 4, quiet: true, oneSidecar: true, again: true });
        assert.equal(r.ok, true, r.line);
        names.push(...r.names);
        meta = meta || r.meta;
      }
      await b.save.postSidecar(meta, names);
      await b.settle();
      return names;
    };
    assert.deepEqual(await gallery([0, 1, 2, 3]), [1, 2, 3, 4].map((n) => `${STEM}-${n}.jpg`));
    assert.deepEqual(await gallery([0, 2]), [`${STEM}-1 (1).jpg`, `${STEM}-3 (1).jpg`]);
    assert.deepEqual(listed(b.md(`${DIR}${STEM}.md`)), [1, 2, 3, 4].map((n) => `${STEM}-${n}.jpg`));
    assert.deepEqual(listed(b.md(`${DIR}${STEM} (1).md`)), [`${STEM}-1 (1).jpg`, `${STEM}-3 (1).jpg`]);
  });

  test(`${flavour}: one image of a saved gallery, saved alone, gets a sidecar beside its own file`, async () => {
    const b = makeBrowser({ flavour, settings });
    const t = post("4", { media: "https://pbs.twimg.com/media/G2?format=jpg&name=orig" });
    await b.save.start(t, { index: 2, total: 4, quiet: true });
    const r = await b.save.start(t, { index: 2, total: 4, quiet: true, again: true });
    await b.settle();
    assert.deepEqual([...r.names], [`${STEM}-3 (1).jpg`]);
    assert.deepEqual(listed(b.md(`${DIR}${STEM}-3 (1).md`)), [`${STEM}-3 (1).jpg`]);
  });
}

test("sidecarStem keeps the browser's suffix and drops the gallery's -1", async () => {
  const { PB } = makeBrowser({ settings });
  assert.equal(PB.sidecarStem(["a-1.jpg", "a-2.jpg"]), "a");
  assert.equal(PB.sidecarStem(["a-1 (1).jpg", "a-3 (1).jpg"]), "a (1)");
  assert.equal(PB.sidecarStem(["a-1 (1).jpg"]), "a-1 (1)");
  assert.equal(PB.sidecarStem(["a.jpg"]), "a");
  assert.equal(PB.fileBase("C:\\Users\\r\\Downloads\\x\\a (1).jpg"), "a (1).jpg");
  assert.equal(PB.fileBase("/home/r/Downloads/x/a.jpg"), "a.jpg");
});
