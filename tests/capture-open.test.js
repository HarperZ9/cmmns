// The background opener for whole saves (src/ext/capture-open-bg.js): it opens only an Instagram post
// address, one at a time, asks the opened tab to save the post, closes the tab, and opens nothing
// under source protection. chrome.tabs is a recorder here.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as settings from "../src/core/settings.js";

function load(stored = {}, answer = () => ({ ok: true, names: ["a.jpg"], line: "Saved" })) {
  const log = [], listeners = [];
  const chrome = {
    storage: { local: { get: async (k) => ({ [k]: stored }) } },
    tabs: {
      create: async (o) => { log.push(["create", o.url, o.active]); setTimeout(() => listeners.forEach((f) => f(7, { status: "complete" })), 5); return { id: 7 }; },
      remove: async (id) => { log.push(["remove", id]); },
      sendMessage: async (id, m) => { log.push(["send", id, m.type, m.shortcode]); return answer(m); },
      onUpdated: { addListener: (f) => listeners.push(f), removeListener: (f) => listeners.splice(listeners.indexOf(f), 1) },
    },
  };
  const ctx = { chrome, PB: settings, console, setTimeout, clearTimeout, Date, Promise };
  ctx.globalThis = ctx;
  vm.runInNewContext(readFileSync(new URL("../src/ext/capture-open-bg.js", import.meta.url), "utf8"), ctx);
  return { open: ctx.PBCaptureOpen.open, log };
}

test("an Instagram post opens in a background tab, is saved there, and the tab closes", async () => {
  const { open, log } = load();
  const r = await open({ url: "https://www.instagram.com/p/LIKED0001/", shortcode: "LIKED0001" });
  assert.deepEqual(r, { ok: true, names: ["a.jpg"], line: "Saved" });
  assert.deepEqual(log, [["create", "https://www.instagram.com/p/LIKED0001/", false], ["send", 7, "pb-cap-save", "LIKED0001"], ["remove", 7]]);
});

test("any other address, or source protection, opens nothing", async () => {
  const a = load();
  assert.match((await a.open({ url: "https://example.org/p/LIKED0001/" })).error, /not an Instagram post/);
  assert.match((await a.open({ url: "https://www.instagram.com/accounts/edit/" })).error, /not an Instagram post/);
  const b = load({ protection: true });
  assert.match((await b.open({ url: "https://www.instagram.com/p/LIKED0001/", shortcode: "LIKED0001" })).error, /source protection/);
  assert.deepEqual([...a.log, ...b.log], []);
});

test("two saves never open two tabs at once", async () => {
  const { open, log } = load();
  await Promise.all([open({ url: "https://www.instagram.com/p/AAAAA1/", shortcode: "AAAAA1" }), open({ url: "https://www.instagram.com/reel/BBBBB2/", shortcode: "BBBBB2" })]);
  assert.deepEqual(log.map((l) => l[0]), ["create", "send", "remove", "create", "send", "remove"]);
});
