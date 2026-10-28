// A simulated browser for the save path: the page script (quick-save.js) and the worker
// (quick-save-bg.js) run in one vm context over a fake chrome.downloads that writes into an
// in-memory Downloads folder. "uniquify" renames a taken name the way Chrome and Firefox do
// ("name (1).jpg"). The "chrome" flavour reports the final name late (search gives "" until
// onDeterminingFilename has been answered, then onChanged carries it); "firefox" knows it at once.
import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveObjectURL } from "node:buffer";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (f) => readFileSync(resolve(root, process.env.CMMNS_SIM_SRC || process.env.DAYLIGHT_SIM_SRC || ".", f), "utf8");
const DOWNLOADS = "C:\\Users\\reader\\Downloads\\";

const listeners = () => { const l = []; return { l, addListener: (f) => l.push(f), removeListener: (f) => { const i = l.indexOf(f); if (i >= 0) l.splice(i, 1); } }; };

// "a/b/name.jpg" taken -> "a/b/name (1).jpg", then "(2)", and so on.
export function uniquify(path, taken) {
  if (!taken.has(path)) return path;
  const m = /^(.*?)(\.[^./]*)?$/.exec(path);
  for (let n = 1; ; n++) { const p = `${m[1]} (${n})${m[2] || ""}`; if (!taken.has(p)) return p; }
}

async function bytesAt(url) {
  if (url.startsWith("blob:")) return new Uint8Array(await resolveObjectURL(url).arrayBuffer());
  if (url.startsWith("data:")) return new Uint8Array(Buffer.from(url.slice(url.indexOf(",") + 1), "base64"));
  return new TextEncoder().encode("remote:" + url);
}

export function makeBrowser({ flavour = "chrome", files = new Map(), settings = {}, media = {} } = {}) {
  const store = { "pb.settings": settings };
  const items = new Map(), changed = listeners(), naming = listeners(), messages = listeners();
  let next = 0;
  const writes = [];
  const finish = async (item, rel, conflict) => {
    const path = conflict === "overwrite" ? rel : uniquify(rel, files);
    files.set(path, await bytesAt(item.url));
    item.filename = DOWNLOADS + path.replace(/\//g, "\\");
    item.state = "complete";
    for (const f of [...changed.l]) f({ id: item.id, filename: { previous: "", current: item.filename } });
    for (const f of [...changed.l]) f({ id: item.id, state: { previous: "in_progress", current: "complete" } });
  };
  const downloads = {
    onChanged: changed, onDeterminingFilename: flavour === "chrome" ? naming : undefined,
    search: async ({ id }) => (items.has(id) ? [{ ...items.get(id) }] : []),
    download: async (opts) => {
      const item = { id: ++next, url: opts.url, finalUrl: opts.url, mime: "image/jpeg", filename: "", state: "in_progress" };
      items.set(item.id, item);
      if (flavour === "firefox") await finish(item, opts.filename, opts.conflictAction);
      else setTimeout(() => { for (const f of naming.l) f({ ...item }, (s) => writes.push(finish(item, s.filename, s.conflictAction))); }, 5);
      return item.id;
    },
  };
  const chrome = {
    downloads,
    storage: { local: { get: async (k) => ({ [k]: store[k] }), set: async (o) => Object.assign(store, o) }, onChanged: listeners() },
    runtime: { id: "sim", lastError: null, onInstalled: listeners(), onMessage: messages, getManifest: () => ({ content_scripts: [] }),
      sendMessage: (m) => new Promise((res) => { for (const f of messages.l) if (f(m, { tab: { id: 1 } }, res) === true) return; res(undefined); }) },
    contextMenus: { create() {}, onClicked: listeners() }, tabs: { query: async () => [] }, scripting: { executeScript: async () => [] },
  };
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
  const fetch = async (url) => new Response(media[url] || jpeg, { headers: { "content-type": "image/jpeg" } });
  class Protected extends Error { constructor(r) { super(r); this.reason = r; } }
  const ctx = vm.createContext({ chrome, fetch, Response, Blob, URL, TextEncoder, TextDecoder, AbortSignal, crypto, atob, btoa, console, clearTimeout,
    // The scripts keep long timers (a pending name for 10 minutes); unref lets the test process end.
    setTimeout: (f, ms) => { const t = setTimeout(f, ms); if (ms > 1000) t.unref(); return t; },
    location: { hostname: "x.com", href: "https://x.com/home" }, document: { title: "Home / X", querySelector: () => null },
    PBQuickToast: { show() {} }, PBQuickStream: { Protected }, PBQuickResolve: { resolve: () => null }, PBQuickCapture: { collector: () => null } });
  vm.runInContext(readFileSync(join(root, "src/ext/core.bundle.js"), "utf8"), ctx);
  vm.runInContext(src("src/ext/quick-save-bg.js"), ctx);
  vm.runInContext(src("src/ext/quick-save.js"), ctx);
  const md = (name) => new TextDecoder().decode(files.get(name));
  // Every download asked for has been written (Chrome names a file a moment after download() returns).
  const settle = async () => { await new Promise((r) => setTimeout(r, 30)); await Promise.all(writes); };
  return { files, md, settle, save: ctx.PBQuickSave, PB: ctx.PB };
}

// A post on X as the page reads it; same handle, day and words give the same file name.
export function post(id, { media = `https://pbs.twimg.com/media/M${id}?format=jpg&name=orig` } = {}) {
  return { kind: "image", url: media, meta: { site: "x", handle: "HoracioAltuna", authorName: "Horacio Altuna", text: "Frederic Pillot",
    postedAt: "2026-10-28T05:52:30.000Z", postUrl: `https://x.com/HoracioAltuna/status/${id}` } };
}

// The front matter's files list.
export const listed = (md) => JSON.parse(/^files: (.*)$/m.exec(md)[1]);
