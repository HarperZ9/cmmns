// Store policy forbids an extension that downloads YouTube video. The Chrome Web Store and Firefox
// Add-ons packages must not carry the command line hand-off (src/ext/yt-handoff.js) or any path to
// it; the unpacked source and the self-distributed Firefox build keep it.
import test from "node:test";
import assert from "node:assert/strict";
import { listFiles, filesFor, browserManifest } from "../scripts/zip.mjs";

const files = listFiles();
const manifest = JSON.parse(files.find(([n]) => n === "manifest.json")[1].toString("utf8"));
const MARKS = ["Download video with the command line", "PBYtHandoff = ", "copyCommand"];

test("the store packages carry no YouTube download path", () => {
  for (const browser of ["chrome", "firefox"]) {
    const shipped = filesFor(files, browser), m = browserManifest(manifest, browser);
    assert.ok(!shipped.some(([n]) => n === "yt-handoff.js"), `${browser}: yt-handoff.js is in the package`);
    assert.ok(!m.content_scripts.some((c) => c.js.includes("yt-handoff.js")), `${browser}: the manifest loads yt-handoff.js`);
    for (const [n, d] of shipped) {
      if (!/\.(js|html|json)$/.test(n)) continue;
      const text = d.toString("utf8");
      for (const mark of MARKS) assert.ok(!text.includes(mark), `${browser}: ${n} contains "${mark}"`);
    }
  }
});

test("the unpacked and self-distributed builds keep the hand-off, on YouTube only", () => {
  for (const browser of ["firefox-self"]) {
    assert.ok(filesFor(files, browser).some(([n]) => n === "yt-handoff.js"));
    const scripts = browserManifest(manifest, browser).content_scripts.filter((c) => c.js.includes("yt-handoff.js"));
    assert.deepEqual(scripts.map((c) => c.matches), [["https://www.youtube.com/*"]]);
  }
  assert.ok(manifest.content_scripts.some((c) => c.js.includes("yt-handoff.js")), "the source manifest (Load unpacked) loads it");
});
