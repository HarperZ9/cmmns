// Bytes the page made, when the browser cannot read the page's own blob address (Chrome, for a
// blob made on x.com). Before the handoff the bytes went to the worker as one number array: a 30 MB
// video became a message of about 107 MB, over Chrome's limit, and the tab froze while it was built.
// The handoff sends 4 MB pieces and the worker puts them back together.
import test from "node:test";
import assert from "node:assert/strict";
import { makeBrowser } from "./downloads-sim.js";

const bytesOf = (n) => { const b = new Uint8Array(n); for (let i = 0; i < n; i++) b[i] = (i * 2654435761) >>> 24; return b; };

for (const flavour of ["chrome", "firefox"]) {
  test(`${flavour}: a 9 MB file the page made is saved whole when the page's blob address is refused`, async () => {
    let refusedOnce = false;
    const refuse = (u) => (u.startsWith("blob:") && !refusedOnce ? ((refusedOnce = true), "FILE_FAILED") : null);
    const b = makeBrowser({ flavour, refuse });
    const want = bytesOf(9 * 1048576 + 123);
    const name = await b.save.saveBytes(want, "video/mp4", "clip.mp4", { dest: { site: "x.com" } });
    await b.settle();
    assert.ok(refusedOnce, "the page's own address was tried first");
    const got = [...b.files.entries()].find(([k]) => k.endsWith(name));
    assert.ok(got, `the file was written as ${name}`);
    assert.equal(got[1].length, want.length);
    assert.deepEqual(got[1], want, "every byte arrives in order");
  });
}

test("control: the page's own blob address, when it works, saves without a handoff", async () => {
  const b = makeBrowser({ flavour: "chrome" });
  const want = bytesOf(1000);
  const name = await b.save.saveBytes(want, "image/png", "a.png", { dest: { site: "x.com" } });
  await b.settle();
  assert.equal(b.started.length, 1, "one download, no second try");
  assert.ok([...b.files.keys()].some((k) => k.endsWith(name)));
});
