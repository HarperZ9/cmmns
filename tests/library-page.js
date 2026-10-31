// Shared by the library browser tests: the extension's own page scripts on a fixture page served at
// a site's real address through DevTools (Fetch), with chrome.* replaced by a recorder. Nothing is
// fetched from the site itself, so these check the collector, not the site's live markup.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CHROME, evaluate } from "./browser.js";
import { launch } from "../scripts/ocr/cdp.mjs";

// Each Chrome gets its own debugging port: two tests in one file, or files run side by side, must not
// meet a Chrome that is still closing on the same port.
let opened = 0;
const portFor = () => 10000 + ((process.pid * 37 + (opened++) * 211) % 4000);
const openChrome = () => launch(portFor(), { chrome: CHROME, args: process.platform === "linux" ? ["--no-sandbox"] : [], waitMs: 45000 });

const EXT = join(import.meta.dirname, "..", "src", "ext");
const SCRIPTS = ["core.bundle.js", "guard.js", "quick-toast.js", "quick-resolve.js", "quick-instagram.js", "quick-sites.js", "quick-stream.js", "quick-gif.js", "quick-saved.js", "quick-handoff.js", "quick-fetch.js", "quick-save.js", "quick-capture.js", "capture-sites.js", "full-capture.js", "library.js", "library-scroll.js", "library-ui.js"];
export const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

// A recorder for chrome.*: each download keeps its folder (site, study, library) and, for text, its
// bytes. Storage lives in localStorage, so it outlasts a reload. delay: ms the first answer to
// sendMessage waits, so a test can make two saves overlap.
const STUB = `globalThis.__dl = []; globalThis.__delay = 0;
globalThis.chrome = { runtime: { id: "test", sendMessage: async (m) => {
  if (m.type !== "pb-qs-download" && m.type !== "pb-qs-bytes") return { error: "unexpected " + m.type };
  const bytes = m.bytes ? new Uint8Array(m.bytes) : new Uint8Array(await (await fetch(m.url)).arrayBuffer());
  if (__delay) await new Promise((ok) => setTimeout(ok, __delay));
  __dl.push({ filename: m.filename, site: m.site, study: !!m.study, library: m.library || null, overwrite: !!m.overwrite, text: /\\.(md|jsonl|txt)$/.test(m.filename) ? new TextDecoder().decode(bytes) : null, size: bytes.length });
  return { id: __dl.length }; } },
  storage: { local: { get: async (k) => { const v = localStorage.getItem(k); return v ? { [k]: JSON.parse(v) } : {}; }, set: async (o) => { for (const [k, v] of Object.entries(o)) localStorage.setItem(k, JSON.stringify(v)); } } } };`;

export const page = (title, body) => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><script>${STUB}</script>
${SCRIPTS.map((s) => `<script src="/__dc/${s}"></script>`).join("\n")}</head><body><main id="feed">${body}</main></body></html>`;

// pages: { "<pathname>": html }. Pictures from any media host answer with a 1-pixel PNG.
function answer(url, pages) {
  const u = new URL(url);
  if (/^(pbs\.twimg\.com|i\.redd\.it|preview\.redd\.it)$/.test(u.hostname)) return { body: PNG, type: "image/png" };
  if (u.pathname.startsWith("/__dc/")) return { body: readFileSync(join(EXT, u.pathname.slice(6))), type: "text/javascript" };
  if (pages[u.pathname]) return { body: Buffer.from(pages[u.pathname]), type: "text/html; charset=utf-8" };
  return { body: Buffer.from(""), type: "text/plain", status: 404 };
}

async function serve(cdp, pages, stop, mediaDelay = 0) {
  let seen = 0;
  while (!stop.done) {
    for (; seen < cdp.events.length; seen++) {
      const e = cdp.events[seen];
      if (e.method !== "Fetch.requestPaused") continue;
      const a = answer(e.params.request.url, pages), media = a.type === "image/png";
      const send = () => cdp.send("Fetch.fulfillRequest", { requestId: e.params.requestId, responseCode: a.status || 200, body: a.body.toString("base64"),
        responseHeaders: [{ name: "Content-Type", value: a.type }, { name: "Access-Control-Allow-Origin", value: "*" }] }).catch(() => {});
      if (media && mediaDelay) setTimeout(send, mediaDelay); else send();
    }
    await new Promise((ok) => setTimeout(ok, 10));
  }
}

// Opens Chrome serving pages on the given hosts; fn(session) runs the test, then Chrome closes.
// mediaDelay: ms before each picture answers, so a test can hold a save on the network.
export async function withSite(hosts, pages, fn, { mediaDelay = 0 } = {}) {
  const cdp = await openChrome(), stop = { done: false }, server = serve(cdp, pages, stop, mediaDelay);
  const until = async (expr, ms = 15000) => {
    for (let t = 0; t < ms; t += 100) { if (await evaluate(cdp, expr)) return true; await new Promise((ok) => setTimeout(ok, 100)); }
    throw new Error(`timed out waiting for ${expr}`);
  };
  const s = {
    cdp, until, js: (expr) => evaluate(cdp, expr),
    open: async (url) => { await cdp.send("Page.navigate", { url }); await until("document.readyState === 'complete' && !!document.querySelector('.pb-lib button')"); },
    click: (label) => evaluate(cdp, `[...document.querySelectorAll('.pb-lib button')].find((b) => b.textContent === ${JSON.stringify(label)}).click(), true`),
    downloads: () => evaluate(cdp, "__dl"),
    index: async () => (await evaluate(cdp, "__dl")).filter((d) => d.filename === "index.jsonl").pop().text.trim().split("\n").map((l) => JSON.parse(l)),
  };
  try {
    await cdp.send("Fetch.enable", { patterns: [...hosts, "pbs.twimg.com", "i.redd.it", "preview.redd.it"].map((h) => ({ urlPattern: `https://${h}/*` })) });
    await fn(s);
  } finally { stop.done = true; await server; cdp.close(); }
}
