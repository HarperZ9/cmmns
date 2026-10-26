// A small deterministic zip writer and the per-browser manifest, for scripts/package.mjs.
// Deterministic: entries sorted by path, a fixed 1980-01-01 timestamp, no extra fields, fixed
// attributes and deflate at level 9, so the same source tree always gives the same bytes.
import { deflateRawSync, crc32 } from "node:zlib";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const FIREFOX_UPDATE_URL = "https://harperz9.github.io/daylight-commons/firefox/updates.json";
export const EXT = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "ext");
const DOS_TIME = 0, DOS_DATE = (0 << 9) | (1 << 5) | 1;

function header(sig, size) { const b = Buffer.alloc(size); b.writeUInt32LE(sig, 0); return b; }

function entry(name, data) {
  const packed = deflateRawSync(data, { level: 9 });
  const stored = packed.length >= data.length;
  return { name: Buffer.from(name, "utf8"), data: stored ? data : packed, method: stored ? 0 : 8, crc: crc32(data), size: data.length };
}

function local(e) {
  const h = header(0x04034b50, 30);
  h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(e.method, 8);
  h.writeUInt16LE(DOS_TIME, 10); h.writeUInt16LE(DOS_DATE, 12);
  h.writeUInt32LE(e.crc, 14); h.writeUInt32LE(e.data.length, 18); h.writeUInt32LE(e.size, 22);
  h.writeUInt16LE(e.name.length, 26); h.writeUInt16LE(0, 28);
  return Buffer.concat([h, e.name, e.data]);
}

function central(e, offset) {
  const h = header(0x02014b50, 46);
  h.writeUInt16LE(20, 4); h.writeUInt16LE(20, 6); h.writeUInt16LE(0x0800, 8); h.writeUInt16LE(e.method, 10);
  h.writeUInt16LE(DOS_TIME, 12); h.writeUInt16LE(DOS_DATE, 14);
  h.writeUInt32LE(e.crc, 16); h.writeUInt32LE(e.data.length, 20); h.writeUInt32LE(e.size, 24);
  h.writeUInt16LE(e.name.length, 28); h.writeUInt32LE(offset, 42);
  return Buffer.concat([h, e.name]);
}

// files: [[path, Buffer]] with forward slashes. Returns the archive as one Buffer.
export function zip(files) {
  const entries = [...files].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([n, d]) => entry(n, d));
  const locals = [], centrals = [];
  let offset = 0;
  for (const e of entries) {
    const l = local(e);
    centrals.push(central(e, offset));
    locals.push(l);
    offset += l.length;
  }
  const dir = Buffer.concat(centrals);
  const end = header(0x06054b50, 22);
  end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, end]);
}

// The manifest each browser understands. Chrome runs a service worker and ignores Firefox's keys;
// Firefox runs background scripts and needs version 128 for main-world content scripts.
// Files the store packages (Chrome Web Store, Firefox Add-ons) leave out. Store policy forbids an
// extension that downloads YouTube video, so its command line hand-off ships only unpacked and in the
// self-distributed Firefox build. tests/store-build.test.js checks both packages.
export const STORE_BUILDS = new Set(["chrome", "firefox"]);
export const NOT_IN_STORE = new Set(["yt-handoff.js"]);
export const filesFor = (files, browser) => (STORE_BUILDS.has(browser) ? files.filter(([n]) => !NOT_IN_STORE.has(n)) : files);

export function browserManifest(source, browser) {
  const m = structuredClone(source);
  if (STORE_BUILDS.has(browser)) {
    m.content_scripts = m.content_scripts.map((c) => ({ ...c, js: c.js.filter((f) => !NOT_IN_STORE.has(f)) })).filter((c) => c.js.length);
  }
  if (browser === "chrome") {
    m.background = { service_worker: m.background.service_worker };
    delete m.browser_specific_settings;
    delete m.sidebar_action;   // Firefox's sidebar; Chrome has side_panel
  } else {
    m.background = { scripts: m.background.scripts };
    // Chrome's side panel; Firefox opens the same page as its sidebar (sidebar_action).
    delete m.side_panel;
    m.permissions = m.permissions.filter((p) => p !== "sidePanel");
    const gecko = m.browser_specific_settings.gecko;
    if (!(parseFloat(gecko.strict_min_version) >= 128)) gecko.strict_min_version = "128.0";
    // The self-distributed build checks Daylight Commons' own site for updates. AMO-listed builds must not
    // carry an update address, so only this variant has one.
    if (browser === "firefox-self") gecko.update_url = FIREFOX_UPDATE_URL;
  }
  return m;
}

// Every file under src/ext as [relative path, Buffer], skipping dotfiles and backups.
export function listFiles(dir = EXT, prefix = "") {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith(".") || name.endsWith(".bak")) continue;
    const full = join(dir, name), rel = prefix + name;
    if (statSync(full).isDirectory()) out.push(...listFiles(full, rel + "/"));
    else out.push([rel, readFileSync(full)]);
  }
  return out;
}
