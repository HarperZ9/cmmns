// YouTube swaps videos without reloading the page, and the previous video's chapter list can stay in
// the page. A reference saved on the new video must list only the new video's chapters. Seen on
// 2026-10-29: eleven saves from one channel all carried three chapters from a Bill Frisell video.
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function marker(time, title, href) {
  return {
    querySelector(sel) {
      if (sel === "#time") return { innerText: time };
      if (sel.startsWith("a")) return href ? { getAttribute: () => href } : null;
      return { innerText: title };
    },
  };
}

function load(markers, url = "https://www.youtube.com/watch?v=NEW1234567") {
  const ctx = {
    location: new URL(url),
    document: { querySelectorAll: (s) => (s === "ytd-macro-markers-list-item-renderer" ? markers : []), querySelector: () => null },
    window: { addEventListener() {}, postMessage() {} },
    URL, Map, Object, Number, Math, setTimeout,
  };
  ctx.globalThis = ctx;
  vm.runInNewContext(readFileSync(join(import.meta.dirname, "..", "src", "ext", "yt-reference.js"), "utf8"), ctx);
  return ctx.PBYouTube;
}

test("chapters left over from the previous video are not saved with the new one", () => {
  const yt = load([
    marker("0:37", "Bill Frisell Nowhere Man", "/watch?v=OLD9876543&t=37s"),
    marker("5:49", "Bill Frisell In My Life", "/watch?v=OLD9876543&t=349s"),
    marker("0:00", "Identity of Ya'juj and Ma'juj", "/watch?v=NEW1234567&t=0s"),
    marker("2:45", "The story of Dhul-Qarnayn", "/watch?v=NEW1234567&t=165s"),
  ]);
  assert.deepEqual([...yt.chapters()], ["0:00 Identity of Ya'juj and Ma'juj", "2:45 The story of Dhul-Qarnayn"]);
});

test("a video with no chapters of its own saves none, even when an old list is still in the page", () => {
  const yt = load([marker("0:37", "Bill Frisell Nowhere Man", "/watch?v=OLD9876543&t=37s")]);
  assert.deepEqual([...yt.chapters()], []);
});

test("markers without links are still read when no marker carries one", () => {
  const yt = load([marker("0:00", "Intro", null), marker("1:10", "Part two", null)]);
  assert.deepEqual([...yt.chapters()], ["0:00 Intro", "1:10 Part two"]);
});
