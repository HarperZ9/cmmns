// The whole-save browser tests' page: the extension's own page scripts on a fixture served at a site's
// real address through DevTools (Fetch), with chrome.* replaced by a recorder, as in library-page.js.
// Every request the page makes is answered here and recorded, so a test can show that a save asked
// no host for anything but the post's own files. Nothing reaches the real sites.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CHROME, evaluate } from "./browser.js";
import { launch } from "../scripts/ocr/cdp.mjs";
import { PNG } from "./library-page.js";

let opened = 0;
const portFor = () => 14000 + ((process.pid * 53 + (opened++) * 197) % 4000);
const EXT = join(import.meta.dirname, "..", "src", "ext");
const SCRIPTS = ["core.bundle.js", "guard.js", "quick-toast.js", "quick-resolve.js", "quick-instagram.js", "quick-sites.js", "quick-stream.js", "quick-gif.js", "quick-saved.js",
  "quick-handoff.js", "quick-fetch.js", "quick-save.js", "quick-capture.js", "capture-sites.js", "full-capture.js", "quick-text.js"];
// The smallest MP4 the type sniffer reads as one: an ftyp box and an empty mdat.
export const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.from([0, 0, 2, 0]), Buffer.from("isomiso2"), Buffer.from([0, 0, 0, 8]), Buffer.from("mdat")]);
export const MEDIA_HOSTS = ["i.redd.it", "scontent.cdninstagram.com", "pbs.twimg.com"];

const STUB = `globalThis.__dl = []; globalThis.__msgs = []; globalThis.__cmmnsPaceMs = 60;
globalThis.chrome = { runtime: { id: "test", onMessage: { addListener() {} }, sendMessage: async (m) => {
  __msgs.push(m.type);
  if (m.type === "pb-cap-open") return { error: "no background tab in this test" };
  if (m.type !== "pb-qs-download" && m.type !== "pb-qs-bytes") return { error: "unexpected " + m.type };
  const bytes = m.bytes ? new Uint8Array(m.bytes) : new Uint8Array(await (await fetch(m.url)).arrayBuffer());
  __dl.push({ filename: m.filename, site: m.site, text: /\\.(md|json|jsonl)$/.test(m.filename) ? new TextDecoder().decode(bytes) : null, size: bytes.length });
  return { id: __dl.length }; } },
  storage: { local: { get: async (k) => { const v = localStorage.getItem(k); return v ? { [k]: JSON.parse(v) } : {}; }, set: async (o) => { for (const [k, v] of Object.entries(o)) localStorage.setItem(k, JSON.stringify(v)); } } } };`;

export const page = (title, body, settings = null) => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><script>${STUB}
${settings ? `localStorage.setItem("pb.settings", ${JSON.stringify(JSON.stringify(settings))});` : `localStorage.removeItem("pb.settings");`}</script>
${SCRIPTS.map((s) => `<script src="/__dc/${s}"></script>`).join("\n")}</head><body><main>${body}</main></body></html>`;

function answer(url, pages) {
  const u = new URL(url);
  if (MEDIA_HOSTS.includes(u.hostname)) return /\.mp4$/.test(u.pathname) ? { body: MP4, type: "video/mp4" } : { body: PNG, type: "image/png" };
  if (u.pathname.startsWith("/__dc/")) return { body: readFileSync(join(EXT, u.pathname.slice(6))), type: "text/javascript" };
  if (pages[u.pathname]) return { body: Buffer.from(pages[u.pathname]), type: "text/html; charset=utf-8" };
  return { body: Buffer.from(""), type: "text/plain", status: 404 };
}

// pages: { "<pathname>": html }. fn(session) runs the test; session.requests lists every address asked for.
export async function withPage(pages, fn) {
  const cdp = await launch(portFor(), { chrome: CHROME, args: process.platform === "linux" ? ["--no-sandbox"] : [], waitMs: 45000 });
  const stop = { done: false }, requests = [];
  const server = (async () => {
    let seen = 0;
    while (!stop.done) {
      for (; seen < cdp.events.length; seen++) {
        const e = cdp.events[seen];
        if (e.method !== "Fetch.requestPaused") continue;
        requests.push(e.params.request.url);
        const a = answer(e.params.request.url, pages);
        cdp.send("Fetch.fulfillRequest", { requestId: e.params.requestId, responseCode: a.status || 200, body: a.body.toString("base64"),
          responseHeaders: [{ name: "Content-Type", value: a.type }, { name: "Access-Control-Allow-Origin", value: "*" }] }).catch(() => {});
      }
      await new Promise((ok) => setTimeout(ok, 10));
    }
  })();
  const until = async (expr, ms = 20000) => {
    for (let t = 0; t < ms; t += 100) { if (await evaluate(cdp, expr)) return true; await new Promise((ok) => setTimeout(ok, 100)); }
    throw new Error(`timed out waiting for ${expr}`);
  };
  const s = {
    requests, until, js: (expr) => evaluate(cdp, expr),
    open: async (url) => { await cdp.send("Page.navigate", { url }); await until("document.readyState === 'complete' && !!globalThis.PBFullCapture"); },
    downloads: () => evaluate(cdp, "__dl"),
    file: async (re) => (await evaluate(cdp, "__dl")).find((d) => new RegExp(re).test(d.filename)) || null,
  };
  try {
    await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
    await fn(s);
  } finally { stop.done = true; await server; cdp.close(); }
}
