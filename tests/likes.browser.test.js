// Save all likes in a real (headless) Chrome on a simulated likes page (tests/likes-fixture.js) served
// at x.com/i/history/likes through DevTools, with chrome.* replaced by a recorder. The page loads 200
// timeline entries in pages of 20 as it is scrolled, from X-shaped GraphQL responses that sniff.js
// passes on: 190 posts and 10 drawn again. 25 were saved before in a library and 5 with one click, so
// 160 are listed. Then: the manifest's lines, a reload offering Resume and continuing without listing
// anything twice, the archive's checklist and what it still misses, and X's error state stopping the scroll.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CHROME, browserSkip, evaluate } from "./browser.js";
import { launch } from "../scripts/ocr/cdp.mjs";
import { makePost, likesPageHtml, timelineAnswer } from "./likes-fixture.js";

const EXT = join(import.meta.dirname, "..", "src", "ext");
const SCRIPTS = ["core.bundle.js", "guard.js", "quick-toast.js", "quick-resolve.js", "quick-instagram.js", "quick-sites.js", "quick-stream.js", "quick-gif.js", "quick-saved.js", "quick-handoff.js", "quick-fetch.js", "quick-save.js", "quick-capture.js", "capture-sites.js", "full-capture.js", "likes.js", "likes-scroll.js", "likes-ui.js"];
const STUB = `globalThis.__dl = [];
globalThis.chrome = { runtime: { id: "test", sendMessage: async (m) => {
  if (m.type !== "pb-qs-download") return { error: "unexpected " + m.type };
  const bytes = new Uint8Array(await (await fetch(m.url)).arrayBuffer());
  __dl.push({ filename: m.filename, site: m.site, library: m.library || null, overwrite: !!m.overwrite, text: new TextDecoder().decode(bytes) });
  return { id: __dl.length }; } },
  storage: { local: {
    get: async (k) => { const all = JSON.parse(localStorage.getItem("__store") || "{}"); return k == null ? all : { [k]: all[k] }; },
    set: async (o) => { const all = JSON.parse(localStorage.getItem("__store") || "{}"); Object.assign(all, JSON.parse(JSON.stringify(o))); localStorage.setItem("__store", JSON.stringify(all)); } } } };`;
const head = `<script>${STUB}</script><script src="/__dc/sniff.js"></script>${SCRIPTS.map((s) => `<script src="/__dc/${s}"></script>`).join("")}`;

const id = (i) => String(1800000000000000000n + BigInt(i));
const UNIQUE = Array.from({ length: 190 }, (_, i) => makePost(id(i), { handle: "painter", text: `Liked post ${i}.` }));
// Ten posts drawn again on later pages, as X does when a timeline page overlaps the one before.
const ENTRIES = [...UNIQUE.slice(0, 100), ...UNIQUE.slice(20, 30), ...UNIQUE.slice(100)];
// Saved before: 25 in a library (by post id) and 5 with one click (by the picture's address).
const SEED = { "pb.library.v1.x-painter": { format: "daylight.library/1", folder: "x-painter", items: UNIQUE.slice(150, 175).map((p) => ({ id: p.id })) },
  "pb.saved.v1": Object.fromEntries(UNIQUE.slice(175, 180).map((p) => [p.media[0].url.replace(/\.jpg$/, "").replace(/\?.*$/, "") + "?format=jpg&name=orig", ["earlier.jpg", 1]])) };

async function serve(cdp, stop, failAfter) {
  let seen = 0;
  while (!stop.done) {
    for (; seen < cdp.events.length; seen++) {
      const e = cdp.events[seen];
      if (e.method !== "Fetch.requestPaused") continue;
      const u = new URL(e.params.request.url);
      let body, type = "text/html; charset=utf-8", status = 200;
      if (u.pathname.startsWith("/__dc/")) { body = readFileSync(join(EXT, u.pathname.slice(6))); type = "text/javascript"; }
      else if (u.pathname.endsWith("/Likes")) { const a = timelineAnswer(ENTRIES, u.searchParams.get("cursor"), { failAfter: failAfter.n }); body = Buffer.from(JSON.stringify(a.json)); type = "application/json"; status = a.status; }
      else if (u.pathname === "/i/history/likes") body = Buffer.from(likesPageHtml("me", head));
      else { body = Buffer.from(""); status = 404; }
      cdp.send("Fetch.fulfillRequest", { requestId: e.params.requestId, responseCode: status, body: body.toString("base64"), responseHeaders: [{ name: "Content-Type", value: type }] }).catch(() => {});
    }
    await new Promise((ok) => setTimeout(ok, 10));
  }
}

let opened = 0;
async function withLikes(fn, failAfter = { n: Infinity }) {
  const cdp = await launch(11000 + ((process.pid * 37 + (opened++) * 211) % 3000), { chrome: CHROME, args: process.platform === "linux" ? ["--no-sandbox"] : [], waitMs: 45000 });
  const stop = { done: false }, server = serve(cdp, stop, failAfter);
  const js = (x) => evaluate(cdp, x);
  const until = async (x, ms = 20000) => { for (let t = 0; t < ms; t += 100) { if (await js(x)) return; await new Promise((ok) => setTimeout(ok, 100)); } throw new Error(`timed out waiting for ${x}`); };
  const open = async () => { await cdp.send("Page.navigate", { url: "https://x.com/i/history/likes" }); await until("document.readyState === 'complete' && !!globalThis.PBLikes && !!document.querySelector('.pb-likes')"); };
  const scrollAll = (n) => js(`(async () => { for (let i = 0; i < 600 && PBLikes.status().found < ${n}; i++) { scrollTo(0, document.documentElement.scrollHeight); await new Promise((r) => setTimeout(r, 40)); } return PBLikes.status().found; })()`);
  try {
    await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "https://x.com/*" }] });
    await fn({ js, until, open, scrollAll, failAfter });
  } finally { stop.done = true; await server; cdp.close(); }
}

const lines = (dl) => dl.filter((d) => /^manifest-\d+\.jsonl$/.test(d.filename)).reduce((m, d) => m.set(d.filename, d.text), new Map());

test("Save all likes: 200 entries, duplicates and earlier saves skipped, the manifest written, a reload resumes", { skip: browserSkip, timeout: 180000 }, () => withLikes(async (s) => {
  await s.open();
  await s.js(`localStorage.setItem("__store", ${JSON.stringify(JSON.stringify(SEED))}), true`);
  await s.open();
  assert.match(await s.js("document.querySelector('.pb-likes').textContent"), /Save all likes/);
  assert.ok(await s.js("!!document.querySelector('.pb-likes select[title*=\"rate-limited\"]')"), "the pace control carries the account-risk note");
  await s.js(`PBLikes.start("manifest").then(() => true)`);
  // Half way, then the tab is reloaded: the record keeps the run.
  await s.scrollAll(90);
  await s.js(`PBLikes.stop("reloading", { resumable: true }).then(() => true)`);
  const half = await s.js("PBLikes.status()");
  await s.open();
  assert.equal(await s.js("PBLikes.status().status"), "resumable");
  assert.ok(await s.js("[...document.querySelectorAll('.pb-likes button')].some((b) => b.textContent === 'Resume saving likes')"));
  await s.js(`PBLikes.start("manifest").then(() => true)`);
  await s.scrollAll(190);
  await s.until("PBLikes.status().found >= 190");
  await s.js(`PBLikes.stop().then(() => true)`);
  const st = await s.js("PBLikes.status()");
  assert.equal(half.found < 190, true);
  // The second session finds the first session's posts again: they are already listed, so duplicates.
  assert.equal(st.listed, 160, "190 posts, 25 in a library and 5 saved with one click before");
  assert.equal(st.duplicate, 30);
  assert.equal(st.found, 190, "each post counted once, across the reload and the ten drawn again");
  const dl = await s.js("__dl"), parts = lines(dl);
  const listed = [...parts.values()].flatMap((t) => t.trim().split("\n").map((l) => JSON.parse(l)));
  assert.equal(listed.length, 160);
  assert.equal(new Set(listed.map((l) => l.id)).size, 160, "no post listed twice across the reload");
  assert.ok(dl.every((d) => d.library === "x-likes" && d.overwrite), "the manifest goes to the x-likes library folder");
  assert.match(listed[0].files[0].url, /^https:\/\/pbs\.twimg\.com\/media\/L\d+\?format=jpg&name=orig$/);
  assert.ok(!listed.some((l) => UNIQUE.slice(150, 180).some((p) => p.id === l.id)), "earlier saves are not listed");

  // The archive's like.js as the checklist: 190 liked, plus 4 the page never showed.
  const archive = `window.YTD.like.part0 = ${JSON.stringify([...UNIQUE, ...[900, 901, 902, 903].map((i) => makePost(id(i)))].map((p) => ({ like: { tweetId: p.id } })))}`;
  assert.equal(await s.js(`PBLikes.importArchive(${JSON.stringify(archive)})`), 194);
  assert.equal(await s.js("PBLikes.status().missing"), 4);
  assert.match(await s.js("document.querySelector('.pb-likes .pb-lib-count').textContent"), /4 of 194 in the archive still missing/);
}));

test("X's error state stops the scroll with a clear message, and the run can be resumed", { skip: browserSkip, timeout: 120000 }, () => withLikes(async (s) => {
  await s.open();
  await s.js(`PBLikes.start("manifest").then(() => true)`);
  await s.scrollAll(40);
  await s.until("!!document.querySelector('[data-testid=\"error-detail\"]')", 10000).catch(() => s.js("scrollTo(0, document.documentElement.scrollHeight), true"));
  await s.until("!!document.querySelector('[data-testid=\"error-detail\"]')");
  const why = await s.js(`PBLikesScroll.run({ pace: () => "brisk", stopped: () => false, paused: () => false, pending: () => 0, seen: () => 40 })`);
  assert.match(why, /^X showed "Something went wrong\. Try reloading\./);
  assert.match(why, /stopped to protect the account/);
  await s.js(`PBLikes.stop(${JSON.stringify(why)}, { resumable: true }).then(() => true)`);
  await s.open();
  assert.equal(await s.js("PBLikes.status().status"), "resumable");
}, { n: 40 }));

// A video X listed only as a stream has no single file to fetch: the post must not count as saved whole.
test("Save in the browser: a post whose video is only a stream counts as saved without video, and stays on the record", { skip: browserSkip, timeout: 120000 }, () => withLikes(async (s) => {
  await s.open();
  const stream = { id: id(800), handle: "painter", posted: "2026-05-01T10:00:00.000Z", text: "Stream only.", media: [{ type: "video", hls: "https://video.twimg.com/v/pl.m3u8" }], links: [] };
  const words = { id: id(801), handle: "painter", posted: "2026-05-01T10:00:00.000Z", text: "Words only.", media: [], links: [] };
  await s.js(`PBLikes.start("browser").then(() => true)`);
  await s.js(`PBLikes.take(${JSON.stringify(stream)}), PBLikes.take(${JSON.stringify(words)}), true`);
  await s.until("PBLikes.pending() === 0");
  await s.js(`PBLikes.stop("checking", { resumable: true }).then(() => true)`);
  const st = await s.js("PBLikes.status()");
  assert.equal(st.saved, 1, "only the post with nothing left to fetch counts as saved");
  assert.equal(st.noVideo, 1);
  assert.equal(st.failed, st.found - 2, "the posts the page drew itself: no media host answers here, so they fail, and neither of these two does");
  const dl = await s.js("__dl"), note = dl.find((d) => d.filename.endsWith(`_${stream.id}.md`));
  assert.match(note.text, /Not saved/);
  assert.match(note.text, /pl\.m3u8/, "the note names the stream");
  const part = dl.filter((d) => /^manifest-/.test(d.filename)).at(-1).text;
  assert.match(part, /"streams":\["https:\/\/video\.twimg\.com\/v\/pl\.m3u8"\]/, "the manifest keeps the stream for the command line");
  // The record survives a reload, and the archive checklist still counts the post as missing.
  await s.open();
  assert.equal(await s.js("PBLikes.status().noVideo"), 1);
  assert.match(await s.js("document.querySelector('.pb-likes .pb-lib-count').textContent"), /1 without video/);
  const kept = await s.js(`chrome.storage.local.get("pb.likes.v1").then((g) => g["pb.likes.v1"])`);
  assert.deepEqual(kept.noVideo, [stream.id]);
  await s.js(`PBLikes.importArchive(${JSON.stringify(`window.YTD.like.part0 = ${JSON.stringify([{ like: { tweetId: stream.id } }, { like: { tweetId: words.id } }])}`)})`);
  assert.equal(await s.js("PBLikes.status().missing"), 1);
}));
