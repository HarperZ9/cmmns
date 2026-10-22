// Reading text in images, wiring: the Media rows offer it only when the user turned it on and run
// it only on a click; the signs from the image's text are labelled and link to their lesson; the
// reader lives in the background worker, loads nothing from the network and never runs in a page.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

await import("../src/ext/core.bundle.js");
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const settings = { imageText: false };
const texts = new Map(), clicked = [];
globalThis.PBSettings = { get: () => settings };
globalThis.PBLogs = { trail: () => ({}) };
globalThis.PBMedia = {
  inPost: () => [{ i: 0, type: "image", src: "https://pbs.twimg.com/media/A.jpg?name=small", searchUrl: "https://pbs.twimg.com/media/A.jpg", media: {} }],
  check: () => {}, takeFrames: () => {}, searchFrame: () => {}, checkOf: () => null, framesOf: () => null, resultsFor: () => [],
  readText: (u) => clicked.push(u), textOf: (u) => texts.get(u) || null,
  textsFor: () => [...texts.values()].filter((t) => t.state === "done").map((t) => t.result),
};
await import("../src/ext/mediacard.js");
await import("../src/ext/signals.js");
const rowsOf = () => globalThis.PBMediaCard.rows({ tweet: { id: "9", media: [{ type: "photo" }] } }).filter(([h], i, all) => h === "Text in the image" || (h === "" && all[i - 1] && all[i - 1][0] === "Text in the image"));
const SRC = "https://pbs.twimg.com/media/A.jpg?name=small";

test("off by default: the row says how to turn it on and offers no button", () => {
  const rows = rowsOf();
  assert.equal(rows.length, 1);
  assert.equal(rows[0][1].note, globalThis.PB.IMAGE_TEXT_OFF);
});

test("on: nothing is read until the click, then the reading and the result show", () => {
  settings.imageText = true;
  let rows = rowsOf();
  assert.equal(rows[0][1].action[0], "Read text in this image");
  assert.match(rows[1][1].note, /never leave your browser/);
  assert.deepEqual(clicked, []);
  rows[0][1].action[1]();
  assert.deepEqual(clicked, [SRC]);
  texts.set(SRC, { state: "reading" });
  assert.equal(rowsOf()[0][1].note, "Reading the text…");
  texts.set(SRC, { state: "done", result: { text: "They spray chemtrails over every city", confidence: 0.9, ms: 500, lines: [], claims: [] } });
  rows = rowsOf();
  assert.equal(rows[0][1], "\"They spray chemtrails over every city\"");
});

test("signs from the image's text say so, stay at info level, and link to the image-text lesson", () => {
  const sig = globalThis.PBSignals.all({ site: { id: "x" }, tweet: { id: "9", media: [] }, node: null });
  const mine = sig.filter((s) => s.label.startsWith("in image: "));
  assert.ok(mine.length >= 1, JSON.stringify(sig.map((s) => s.label)));
  for (const s of mine) {
    assert.equal(s.level, "info");
    assert.equal(s.fam, "image-text");
    assert.ok(s.rows.some(([h]) => h === "Read from the image"));
    assert.deepEqual(s.rows.find(([h]) => h === "Measured"), ["Measured", "not measured yet"]);
    assert.equal(s.rows.at(-1)[1].open[1], "learn.html#image-text");
  }
});

test("the reader runs in the background worker only, from files inside the extension", () => {
  const m = JSON.parse(read("src/ext/manifest.json"));
  for (const cs of m.content_scripts) assert.ok(!cs.js.some((f) => /ocr/.test(f)), "no OCR code in a content script");
  assert.ok(m.background.scripts.includes("ocr.bundle.js") && m.background.scripts.includes("ocr-bg.js"));
  // The one policy change: compiling Daylight Commons' own WebAssembly kernel. No remote script source.
  assert.equal(m.content_security_policy.extension_pages, "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'");
  assert.match(read("src/ext/background.js"), /importScripts\([^)]*"ocr\.bundle\.js", "ocr-bg\.js"\)/);
  for (const f of readdirSync(new URL("../src/ocr/", import.meta.url))) {
    const src = read(`src/ocr/${f}`);
    assert.doesNotMatch(src, /https?:\/\/|fetch\(|XMLHttpRequest|WebSocket|importScripts|import\(/, f);
  }
  const bg = read("src/ext/ocr-bg.js");
  assert.deepEqual(bg.match(/fetch\([^)]*\)/g), ["fetch(chrome.runtime.getURL(\"ocr/latin.bin\")"]);
  assert.match(bg, /if \(!s\.imageText\) return \{ error/);
  assert.match(bg, /!sender\.tab/);
});

test("the content script sends the image only to Daylight Commons' own worker, and only from the click", () => {
  const media = read("src/ext/media.js");
  const fn = media.slice(media.indexOf("async function readText"), media.indexOf("const textsFor"));
  assert.match(fn, /chrome\.runtime\.sendMessage\(\{ type: "pb-ocr"/);
  assert.doesNotMatch(fn, /fetch\(|https?:\/\//);
  assert.doesNotMatch(read("src/ext/content.js"), /readText/);
});
