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

// Library auto-scroll follows the same split: store policy and the sites' terms on automated access
// would endanger the whole extension, so the store packages carry the collector (library.js) and
// its bar, never the scroller (src/ext/library-scroll.js) or any of its words.
const SCROLL_MARKS = ["PBLibraryScroll = ", "Scroll to the end", "behavior: \"smooth\""];

test("the store packages carry no library auto-scroll", () => {
  for (const browser of ["chrome", "firefox"]) {
    const shipped = filesFor(files, browser), m = browserManifest(manifest, browser);
    assert.ok(!shipped.some(([n]) => n === "library-scroll.js"), `${browser}: library-scroll.js is in the package`);
    assert.ok(!m.content_scripts.some((c) => c.js.includes("library-scroll.js")), `${browser}: the manifest loads library-scroll.js`);
    assert.ok(shipped.some(([n]) => n === "library.js") && m.content_scripts.some((c) => c.js.includes("library.js")), `${browser}: the collector must ship`);
    for (const [n, d] of shipped) {
      if (!/\.(js|html|json)$/.test(n)) continue;
      const text = d.toString("utf8");
      for (const mark of SCROLL_MARKS) assert.ok(!text.includes(mark), `${browser}: ${n} contains "${mark}"`);
    }
  }
});

test("the unpacked and self-distributed builds keep auto-scroll beside the collector", () => {
  for (const m of [manifest, browserManifest(manifest, "firefox-self")]) {
    const cs = m.content_scripts.find((c) => c.js.includes("library-scroll.js"));
    assert.ok(cs, "library-scroll.js is loaded");
    assert.ok(cs.js.indexOf("library.js") < cs.js.indexOf("library-ui.js") && cs.js.indexOf("library-scroll.js") < cs.js.indexOf("library-ui.js"));
  }
  assert.ok(filesFor(files, "firefox-self").some(([n]) => n === "library-scroll.js"));
});

// Save all likes follows the same split: the collector (likes.js) and its bar ship everywhere; the
// auto-scroll that walks the whole likes list (likes-scroll.js) only in the unpacked and self-distributed builds.
const LIKES_MARKS = ["PBLikesScroll = ", "Scroll through all likes", "stopped to protect the account"];

test("the store packages carry no likes auto-scroll, but do carry the likes collector", () => {
  for (const browser of ["chrome", "firefox"]) {
    const shipped = filesFor(files, browser), m = browserManifest(manifest, browser);
    assert.ok(!shipped.some(([n]) => n === "likes-scroll.js"), `${browser}: likes-scroll.js is in the package`);
    assert.ok(!m.content_scripts.some((c) => c.js.includes("likes-scroll.js")), `${browser}: the manifest loads likes-scroll.js`);
    assert.ok(m.content_scripts.some((c) => c.js.includes("likes.js") && c.js.includes("likes-ui.js")), `${browser}: the collector must ship`);
    for (const [n, d] of shipped) {
      if (!/\.(js|html|json)$/.test(n)) continue;
      const text = d.toString("utf8");
      for (const mark of LIKES_MARKS) assert.ok(!text.includes(mark), `${browser}: ${n} contains "${mark}"`);
    }
  }
  const cs = manifest.content_scripts.find((c) => c.js.includes("likes-scroll.js"));
  assert.ok(cs && cs.js.indexOf("likes.js") < cs.js.indexOf("likes-scroll.js") && cs.js.indexOf("likes-scroll.js") < cs.js.indexOf("likes-ui.js"), "the unpacked build loads it between the collector and its bar");
});
