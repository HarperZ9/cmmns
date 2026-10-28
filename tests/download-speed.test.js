// The save path's delays and silent failures (3.9.1), over the simulated browser in
// tests/downloads-sim.js. Each case names the defect it plants; a control beside it shows the
// unaffected path still works. With CMMNS_SIM_SRC pointing at a checkout from before the fix, the
// defect cases fail and the controls pass.
import test from "node:test";
import assert from "node:assert/strict";
import { makeBrowser, post } from "./downloads-sim.js";

const PIC = "https://pbs.twimg.com/media/M1?format=jpg&name=orig";
const VIDEO = "https://video.twimg.com/ext_tw_video/1/pu/vid/1280x720/clip.mp4";
const MP4 = Uint8Array.from([0, 0, 0, 0x18, ...new TextEncoder().encode("ftypisom"), 0, 0, 2, 0, ...new TextEncoder().encode("isomiso2"), 0, 0, 0, 8, ...new TextEncoder().encode("mdat")]);
const video = () => ({ ...post("9"), kind: "video", url: VIDEO });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const flavour of ["chrome", "firefox"]) {
  test(`${flavour}: a download the browser stops is reported as not saved, with its reason`, async () => {
    const b = makeBrowser({ flavour, settings: { mediaEmbed: false }, refuse: (u) => (u.startsWith("https://pbs.twimg.com/") ? "SERVER_FORBIDDEN" : null) });
    const r = await b.save.start(post("1"), { quiet: true });
    assert.equal(r.ok, false, "a stopped download is not a success");
    assert.match(r.line, /stopped the download: the site refused it \(403\)/);
  });

  test(`${flavour}: control: the same save with nothing stopped succeeds`, async () => {
    const b = makeBrowser({ flavour, settings: { mediaEmbed: false } });
    const r = await b.save.start(post("1"), { quiet: true });
    assert.equal(r.ok, true, r.line);
  });
}

test("a video over 32 MB goes straight to the browser, never read into the page first", async () => {
  const b = makeBrowser({ settings: { mediaEmbed: true }, media: { [VIDEO]: MP4 }, types: { [VIDEO]: "video/mp4" }, sizes: { [VIDEO]: 120 * 1048576 } });
  const r = await b.save.start(video(), { quiet: true });
  assert.equal(r.ok, true, r.line);
  assert.equal(b.started[0], VIDEO, "the browser downloads the address itself");
  assert.deepEqual(b.requests.filter((q) => q.url === VIDEO && !q.range), [], "no full read of the video in the page");
});

test("control: a 4 MB video is still read so the post's words go inside it", async () => {
  const b = makeBrowser({ settings: { mediaEmbed: true }, media: { [VIDEO]: MP4 }, types: { [VIDEO]: "video/mp4" }, sizes: { [VIDEO]: 4 * 1048576 } });
  const r = await b.save.start(video(), { quiet: true });
  assert.equal(r.ok, true, r.line);
  assert.match(b.started[0], /^blob:/, "the bytes with the words are handed over");
});

test("the save does not wait for the saved list to be written", async () => {
  const b = makeBrowser({ settings: { mediaEmbed: false }, storageDelay: 40 });
  const r = await b.save.start(post("1"), { quiet: true });
  assert.equal(r.ok, true, r.line);
  assert.equal(b.store["pb.saved.v1"], undefined, "the list is written after the note, not before it");
  await sleep(400);
  assert.ok(b.store["pb.saved.v1"] && b.store["pb.saved.v1"][PIC], "and it is written");
});

test("four files saved at once all land in the saved list", async () => {
  const b = makeBrowser({ settings: { mediaEmbed: false }, storageDelay: 15 });
  const urls = [1, 2, 3, 4].map((n) => `https://pbs.twimg.com/media/G${n}?format=jpg&name=orig`);
  const rs = await Promise.all(urls.map((media, index) => b.save.start(post("3", { media }), { index, total: 4, quiet: true, oneSidecar: true })));
  assert.ok(rs.every((r) => r.ok), rs.map((r) => r.line).join("; "));
  await sleep(600);
  assert.deepEqual(urls.filter((u) => !(b.store["pb.saved.v1"] || {})[u]), [], "no entry is lost to another save's write");
});

test("control: a file saved before is still reported as already saved", async () => {
  const b = makeBrowser({ settings: { mediaEmbed: false } });
  await b.save.start(post("1"), { quiet: true });
  await sleep(50);
  const again = await b.save.start(post("1"), { quiet: true });
  assert.equal(again.already, true, again.line);
});
