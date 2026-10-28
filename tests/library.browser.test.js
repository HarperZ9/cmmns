// Library capture in a real (headless) Chrome: the extension's own page scripts (core.bundle.js,
// quick-sites.js, quick-save.js, library.js, library-ui.js) run on a page served at
// https://x.com/MeditInColor, with chrome.* replaced by a recorder. The page and its pictures
// are a fixture answered through DevTools, so nothing is fetched from X: this checks the collector,
// not X's live markup. It checks the "Save page as library" bar, one save per post, the repost
// skipped, a post loaded later saved too, index.jsonl and LIBRARY.md written on Stop with each file's
// hash, and a reload continuing the same library without saving the same posts again.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { browserSkip, openChrome, evaluate } from "./browser.js";

const EXT = join(import.meta.dirname, "..", "src", "ext");
const SCRIPTS = ["core.bundle.js", "guard.js", "quick-toast.js", "quick-resolve.js", "quick-sites.js", "quick-stream.js", "quick-gif.js", "quick-save.js", "quick-capture.js", "library.js", "library-scroll.js", "library-ui.js"];
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

// A recorder for chrome.*: downloads keep their bytes; storage lives in localStorage, so it outlasts a reload.
const STUB = `globalThis.__dl = [];
globalThis.chrome = { runtime: { id: "test", sendMessage: async (m) => {
  if (m.type !== "pb-qs-download" && m.type !== "pb-qs-bytes") return { error: "unexpected " + m.type };
  const bytes = m.bytes ? new Uint8Array(m.bytes) : new Uint8Array(await (await fetch(m.url)).arrayBuffer());
  __dl.push({ filename: m.filename, library: m.library, overwrite: !!m.overwrite, text: /\\.(md|jsonl)$/.test(m.filename) ? new TextDecoder().decode(bytes) : null, size: bytes.length });
  return { id: __dl.length }; } },
  storage: { local: { get: async (k) => { const v = localStorage.getItem(k); return v ? { [k]: JSON.parse(v) } : {}; }, set: async (o) => { for (const [k, v] of Object.entries(o)) localStorage.setItem(k, JSON.stringify(v)); } } } };`;

const post = (handle, id, text, media = true) => `<article><a href="/${handle}"><span>Meditations</span></a><a href="/${handle}/status/${id}"><time datetime="2026-0${id % 9 + 1}-02T10:00:00.000Z"></time></a>
  <div data-testid="tweetText" lang="en">${text}</div>${media ? `<img alt="a colour study" src="https://pbs.twimg.com/media/P${id}?format=jpg&name=small" width="200" height="200">` : ""}</article>`;
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Meditations in Color (@MeditInColor) / X</title><script>${STUB}</script>
${SCRIPTS.map((s) => `<script src="/__dc/${s}"></script>`).join("\n")}</head><body><main id="feed">
${post("MeditInColor", 111, "Blue first, then the gold.")}${post("someone", 222, "A repost the profile shows.")}${post("MeditInColor", 333, "Only words today.", false)}
</main></body></html>`;

const X_DATA = { data: { tweetResult: { result: { __typename: "Tweet", rest_id: "111", source: "<a href=\"https://x.com\">Web App</a>", views: { count: "1200" },
  edit_control: { edit_tweet_ids: ["110", "111"] }, birdwatch_pivot: { subtitle: { text: "Readers added context." } },
  legacy: { created_at: "Thu Apr 02 10:00:00 +0000 2026", full_text: "Blue first, then the gold. https://t.co/abc", lang: "en", entities: { urls: [{ url: "https://t.co/abc", expanded_url: "https://example.org/palette" }] } } } } } };

// Answers every paused request: the page, the extension's scripts, the pictures.
function answer(url) {
  const u = new URL(url);
  if (u.hostname === "pbs.twimg.com") return { body: PNG, type: "image/png" };
  if (u.pathname.startsWith("/__dc/")) return { body: readFileSync(join(EXT, u.pathname.slice(6))), type: "text/javascript" };
  if (u.pathname === "/MeditInColor") return { body: Buffer.from(PAGE), type: "text/html; charset=utf-8" };
  return { body: Buffer.from(""), type: "text/plain", status: 404 };
}

async function serve(cdp, stop) {
  let seen = 0;
  while (!stop.done) {
    for (; seen < cdp.events.length; seen++) {
      const e = cdp.events[seen];
      if (e.method !== "Fetch.requestPaused") continue;
      const a = answer(e.params.request.url);
      cdp.send("Fetch.fulfillRequest", { requestId: e.params.requestId, responseCode: a.status || 200, body: a.body.toString("base64"),
        responseHeaders: [{ name: "Content-Type", value: a.type }, { name: "Access-Control-Allow-Origin", value: "*" }] }).catch(() => {});
    }
    await new Promise((ok) => setTimeout(ok, 10));
  }
}

const until = async (cdp, expr, ms = 15000) => {
  for (let t = 0; t < ms; t += 100) { if (await evaluate(cdp, expr)) return true; await new Promise((ok) => setTimeout(ok, 100)); }
  throw new Error(`timed out waiting for ${expr}`);
};
const open = async (cdp) => {
  await cdp.send("Page.navigate", { url: "https://x.com/MeditInColor" });
  await until(cdp, "document.readyState === 'complete' && !!document.querySelector('.pb-lib button')");
};
const click = (cdp, label) => evaluate(cdp, `[...document.querySelectorAll('.pb-lib button')].find((b) => b.textContent === ${JSON.stringify(label)}).click(), true`);

test("Save page as library in Chrome: one save per post, reposts skipped, index written on Stop, a reload continues", { skip: browserSkip, timeout: 120000 }, async () => {
  const cdp = await openChrome(), stop = { done: false };
  const server = serve(cdp, stop);
  try {
    await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "https://x.com/*" }, { urlPattern: "https://pbs.twimg.com/*" }] });
    await open(cdp);
    assert.equal(await evaluate(cdp, "document.querySelector('.pb-lib button').textContent"), "Save page as library");
    assert.ok(await evaluate(cdp, "!!globalThis.PBLibraryScroll && !!document.querySelector('.pb-lib')"));
    // X's own post data for post 111, as sniff.js passes it on: an edit, a Community Note, a link target.
    await evaluate(cdp, `window.postMessage({ source: "radar-sniff", json: ${JSON.stringify(X_DATA)} }, location.origin), true`);
    await until(cdp, "true");
    await new Promise((ok) => setTimeout(ok, 300));
    await click(cdp, "Save page as library");
    await until(cdp, "PBLibrary.status().saved === 2");
    assert.match(await evaluate(cdp, "document.querySelector('.pb-lib-count').textContent"), /^Library x-meditincolor: 2 saved, 1 skipped/);
    assert.ok(await evaluate(cdp, "[...document.querySelectorAll('.pb-lib button')].some((b) => b.textContent === 'Scroll to the end')"), "the unpacked build offers auto-scroll");
    // A post the page loads later (as when the user scrolls) is saved too, and a redrawn one is not saved twice.
    await evaluate(cdp, `document.getElementById('feed').insertAdjacentHTML('beforeend', ${JSON.stringify(post("MeditInColor", 444, "Gold now.") + post("MeditInColor", 111, "Blue first, then the gold."))}), true`);
    await until(cdp, "PBLibrary.status().saved === 3");
    await click(cdp, "Stop");
    await until(cdp, "__dl.some((d) => d.filename === 'LIBRARY.md')");
    const dl = await evaluate(cdp, "__dl");
    assert.ok(dl.every((d) => d.library === "x-meditincolor" && d.overwrite), "every file goes to the library folder, written in place");
    const index = dl.filter((d) => d.filename === "index.jsonl").pop().text.trim().split("\n").map((l) => JSON.parse(l));
    assert.deepEqual(index.map((l) => l.id), ["111", "333", "444"]);
    assert.deepEqual(index.map((l) => l.kind), ["media", "text", "media"]);
    const pic = dl.find((d) => d.filename === index[0].files[0].name);
    assert.match(index[0].files[0].name, /^meditincolor_2026-04-02_blue-first-then-the-gold_111\.png$/);
    assert.equal(pic.size > 0 && index[0].files[0].sha256.length, 64);
    const side = dl.find((d) => d.filename === index[0].files[1].name);
    assert.equal(index[0].files[1].sha256, createHash("sha256").update(side.text).digest("hex"), "the sidecar's hash is of the bytes saved");
    assert.match(side.text, /^---\nformat: "daylight\.sidecar\/1"/);
    assert.match(side.text, /> Blue first, then the gold\./);
    // Every field the page delivered: X's data on the post goes into the index and the note.
    assert.deepEqual(index[0].fields, { lang: "en", client: "Web App", edits: 1, community_note: "Readers added context.", views: 1200 });
    assert.match(side.text, /## Community Note\n\nReaders added context\./);
    assert.match(side.text, /## Edited\n\nX lists 1 earlier version of this post\./);
    assert.match(side.text, /https:\/\/example\.org\/palette/, "the link's target, not only the short link");
    const md = dl.filter((d) => d.filename === "LIBRARY.md").pop().text;
    assert.match(md, /3 posts saved/);
    assert.match(md, /- 1: a post by another account/);
    assert.match(md, /https:\/\/x\.com\/MeditInColor/);
    assert.match(md, /never label a person's character/);

    // Reopening the page continues the library: the three posts are counted, not saved again.
    await open(cdp);
    await click(cdp, "Save page as library");
    await until(cdp, "PBLibrary.status().already === 2");
    await new Promise((ok) => setTimeout(ok, 1500));
    assert.equal(await evaluate(cdp, "PBLibrary.status().saved"), 0);
    assert.equal(await evaluate(cdp, "__dl.length"), 0, "nothing downloaded again");
    await click(cdp, "Stop");
    await until(cdp, "__dl.some((d) => d.filename === 'index.jsonl')");
    const again = (await evaluate(cdp, "__dl")).find((d) => d.filename === "index.jsonl").text.trim().split("\n");
    assert.equal(again.length, 3);
    assert.match((await evaluate(cdp, "__dl")).find((d) => d.filename === "LIBRARY.md").text, /## Sessions \(UTC\)\n\n- .+: 3 saved, collected while scrolling; stopped: Stop pressed\n- .+: 0 saved/);
  } finally { stop.done = true; await server; cdp.close(); }
});
