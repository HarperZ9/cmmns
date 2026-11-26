// Regression tests for collision-free manifest-*.jsonl exports, persisted monotonic counter across
// simulated MV3 worker / tab restarts, conflictAction: "uniquify" + saveAs: false enforcement,
// download-history sequence seeding, configurable bulk limits, and CLI readManifest compatibility.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";
import { MANIFEST_SEQ_KEY, MANIFEST_FILE_RE, manifestFilename, parseManifestSeq, nextManifestSeq, manifestLine, manifestText } from "../src/core/likes.js";
import { paginateLikes } from "../src/core/likes-sync.js";
import { DEFAULTS, normalizeSettings } from "../src/core/settings.js";
import { readManifest } from "../bin/lib/likes.mjs";
import { makePost, likesJson } from "./likes-fixture.js";

const root = join(import.meta.dirname, "..");
const read = (f) => readFileSync(join(root, f), "utf8");

function makeBgHarness({ settings = {}, history = [] } = {}) {
  const store = { "pb.settings": settings };
  const dlCalls = [];
  const messages = [];
  let nextId = 0;
  const chrome = {
    downloads: {
      onChanged: { addListener() {}, removeListener() {} },
      onDeterminingFilename: { addListener() {} },
      search: async (q) => {
        if (q && q.filenameRegex) return history.map((filename, i) => ({ id: i + 1, filename }));
        if (q && q.id) {
          const hit = dlCalls.find((c) => c.id === q.id);
          return hit ? [{ id: hit.id, filename: `Downloads\\${hit.opts.filename}`, state: "complete" }] : [];
        }
        return [];
      },
      download: async (opts) => {
        const id = ++nextId;
        dlCalls.push({ id, opts });
        return id;
      },
    },
    storage: {
      local: {
        get: async (k) => (k == null ? structuredClone(store) : { [k]: structuredClone(store[k]) }),
        set: async (o) => { Object.assign(store, structuredClone(o)); },
      },
      onChanged: { addListener() {} },
    },
    runtime: {
      id: "test-ext", lastError: null,
      onInstalled: { addListener() {} },
      onMessage: { addListener: (fn) => messages.push(fn) },
      getManifest: () => ({ content_scripts: [] }),
      sendMessage: (m) => new Promise((res) => {
        for (const fn of messages) if (fn(m, { tab: { id: 1 } }, res) === true) return;
        res(undefined);
      }),
    },
    contextMenus: { create() {}, onClicked: { addListener() {} } },
    tabs: { query: async () => [] },
    scripting: { executeScript: async () => [] },
  };
  const ctx = vm.createContext({
    chrome, URL, Blob, TextEncoder, TextDecoder, btoa, atob, console, clearTimeout,
    setTimeout: (f, ms) => { const t = setTimeout(f, ms); if (ms > 1000) t.unref(); return t; },
  });
  vm.runInContext(read("src/ext/core.bundle.js"), ctx);
  vm.runInContext(read("src/ext/quick-save-bg.js"), ctx);
  return { ctx, chrome, store, dlCalls };
}

function mountLikesInPage(chrome, dlCalls) {
  const sent = [];
  const ctx = vm.createContext({
    chrome, URL, URLSearchParams, Blob, TextEncoder, TextDecoder, console, performance, clearTimeout, clearInterval,
    setTimeout: (f, ms) => { const t = setTimeout(f, ms); if (ms > 1000) t.unref(); return t; },
    setInterval: () => 1,
    scrollY: 0,
    location: { href: "https://x.com/i/history/likes", hostname: "x.com", origin: "https://x.com" },
    document: { title: "History / X", querySelector: () => null },
    window: { addEventListener() {}, postMessage() {} },
    PBQuickSites: { isX: true },
    PBQuickSave: {
      async saveText(bytes, mime, name, site, study, opts) {
        const res = await chrome.runtime.sendMessage({
          type: "pb-qs-download", url: `blob:https://x.com/${name}`, filename: name, site, study,
          library: opts.library || null, overwrite: !!opts.overwrite, noSaveAs: !!opts.noSaveAs,
        });
        sent.push({ name, opts, res });
        return (res && res.filename) || name;
      },
    },
  });
  vm.runInContext(read("src/ext/core.bundle.js"), ctx);
  vm.runInContext(read("src/ext/likes.js"), ctx);
  return { likes: ctx.PBLikes, sent, dlCalls };
}

test("manifestFilename produces strictly unique, sortable manifest-*.jsonl names and parses legacy + stamped indices", () => {
  const t = new Date("2026-11-26T10:28:34.000Z");
  const a = manifestFilename(1, t), b = manifestFilename(2, t), c = manifestFilename(23, t);
  assert.equal(a, "manifest-20261126T102834Z-0001.jsonl");
  assert.equal(b, "manifest-20261126T102834Z-0002.jsonl");
  assert.equal(c, "manifest-20261126T102834Z-0023.jsonl");
  assert.ok([a, b, c].every((n) => MANIFEST_FILE_RE.test(n)));
  assert.equal(parseManifestSeq("manifest-0001.jsonl"), 1);
  assert.equal(parseManifestSeq("Downloads\\Daylight\\library\\x-likes\\manifest-00022.jsonl"), 22);
  assert.equal(parseManifestSeq("manifest-20261126T102834Z-0045.jsonl"), 45);
  assert.equal(parseManifestSeq("manifest-0003 (1).jsonl"), 3);
  assert.equal(nextManifestSeq(5, ["manifest-00021.jsonl", "manifest-00022.jsonl"]), 23);
});

test("quick-save-bg passes conflictAction uniquify and saveAs false even when mediaAskWhere is true", async () => {
  const h = makeBgHarness({
    settings: { mediaAskWhere: true, mediaFolder: "Daylight" },
    history: ["Downloads\\Daylight\\library\\x-likes\\manifest-00021.jsonl", "Downloads\\Daylight\\library\\x-likes\\manifest-00022.jsonl"],
  });
  const seeded = await h.chrome.runtime.sendMessage({ type: "pb-qs-max-manifest-seq" });
  assert.equal(seeded.maxSeq, 22);

  await h.chrome.runtime.sendMessage({
    type: "pb-qs-download", url: "blob:https://x.com/m1", filename: "manifest-20261126T102834Z-0023.jsonl",
    site: "x", study: false, library: "x-likes", overwrite: false, noSaveAs: true,
  });
  assert.equal(h.dlCalls.length, 1);
  assert.equal(h.dlCalls[0].opts.conflictAction, "uniquify");
  assert.equal(h.dlCalls[0].opts.saveAs, false, "manifest export suppresses Save As dialog even with mediaAskWhere enabled");
  assert.equal(h.dlCalls[0].opts.filename, "Daylight/library/x-likes/manifest-20261126T102834Z-0023.jsonl");
});

test("sequential flushes and simulated MV3/page restarts never collide or reset to manifest-0001", async () => {
  const h = makeBgHarness({
    settings: { mediaAskWhere: true },
    history: ["Downloads\\Daylight\\library\\x-likes\\manifest-00022.jsonl"],
  });

  // First session: 2 posts, flush, then idle flush (must NOT write again).
  const first = mountLikesInPage(h.chrome, h.dlCalls);
  await first.likes.start("manifest");
  first.likes.take(makePost("900001"));
  first.likes.take(makePost("900002"));
  await first.likes.flush();
  await first.likes.flush(); // idle flush with 0 new lines must be a no-op
  assert.equal(h.dlCalls.length, 1, "idle flush does not emit duplicate manifest download");
  assert.equal(parseManifestSeq(h.dlCalls[0].opts.filename), 23, "seeded above existing manifest-00022.jsonl");
  assert.equal(h.store[MANIFEST_SEQ_KEY], 23);
  await first.likes.stop("restarting worker", { resumable: true });

  // Simulated MV3 worker / page restart: fresh VM context, same chrome.storage.local.
  const second = mountLikesInPage(h.chrome, h.dlCalls);
  await second.likes.start("manifest");
  second.likes.take(makePost("900003"));
  await second.likes.flush();
  second.likes.take(makePost("900004"));
  await second.likes.stop("finished");

  assert.equal(h.dlCalls.length, 3);
  const names = h.dlCalls.map((c) => c.opts.filename);
  assert.equal(new Set(names).size, 3, "every manifest filename across restarts is strictly unique");
  assert.deepEqual(names.map(parseManifestSeq), [23, 24, 25], "monotonic sequence never resets to 0001");
  assert.ok(h.dlCalls.every((c) => c.opts.conflictAction === "uniquify" && c.opts.saveAs === false));
});

test("bin/lib/likes.mjs readManifest reads both legacy manifest-NNNN and stamped manifest-YYYYMMDDTHHMMSSZ-NNNN files", () => {
  const dir = mkdtempSync(join(tmpdir(), "cmmns-muniq-"));
  try {
    writeFileSync(join(dir, "manifest-0001.jsonl"), manifestText([manifestLine(makePost("101"))]));
    writeFileSync(join(dir, "manifest-20261126T102834Z-0002.jsonl"), manifestText([manifestLine(makePost("102"))]));
    writeFileSync(join(dir, "manifest-20261126T102835Z-0003.jsonl"), manifestText([manifestLine(makePost("103"))]));
    writeFileSync(join(dir, "ignore.txt"), "not a manifest");
    const rows = readManifest(dir);
    assert.deepEqual(rows.map((r) => r.id), ["101", "102", "103"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("configurable bulk limits have no arbitrary low default page cap in paginateLikes", async () => {
  assert.equal(DEFAULTS.likesMaxPages, 0);
  assert.equal(DEFAULTS.likesManifestChunk, 500);
  assert.equal(DEFAULTS.pageMaxFiles, 100);
  assert.equal(normalizeSettings({ pageMaxFiles: 0 }).pageMaxFiles, 0);
  assert.equal(normalizeSettings({ likesManifestChunk: 2500 }).likesManifestChunk, 2500);

  // Prove default maxPages=0 paginates past the old 500-page cap cleanly (505 synthetic pages).
  let p = 0;
  const res = await paginateLikes({
    initialBackoffMs: 0,
    sleep: async () => {},
    fetchPage: async (cursor) => {
      const idx = cursor ? Number(cursor) : 0;
      p++;
      const next = idx < 504 ? String(idx + 1) : null;
      return { status: 200, json: likesJson([makePost(String(500000 + idx))], next) };
    },
  });
  assert.equal(res.stoppedReason, "exhausted");
  assert.equal(p, 505);
  assert.equal(res.saved, 505);
});
