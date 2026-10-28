// The Download button on an X post (quick-inline.js saveAll), in a vm with the save itself stubbed:
// the files of a gallery are saved at the same time and listed in order, the person sees a count as
// they land, and the button never stays disabled after a failure (3.9.1).
// With CMMNS_SIM_SRC pointing at a checkout from before the fix, the defect cases fail.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (f) => readFileSync(resolve(root, process.env.CMMNS_SIM_SRC || process.env.DAYLIGHT_SIM_SRC || ".", f), "utf8");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function load({ items = [], text = null, failText = false } = {}) {
  const seen = { active: 0, most: 0, toasts: [], sidecar: null };
  const ctx = vm.createContext({
    console: { warn() {} }, setTimeout, requestAnimationFrame: () => 0,
    document: { querySelectorAll: () => [], documentElement: {} },
    MutationObserver: class { observe() {} },
    PBQuickSites: { isX: true, postMedia: () => ({ title: "ana 1", items, gallery: items.length > 1 }), postMetaOf: () => text },
    PBQuickToast: { show: (t, o = {}) => seen.toasts.push([t, o.tone || null]) },
    PBQuickText: { run: async () => { if (failText) throw new Error("the note could not be written"); } },
    PBQuickSave: {
      start: async (t, o) => { seen.active++; seen.most = Math.max(seen.most, seen.active); await sleep(30); seen.active--; return { ok: true, names: [`f${o.index}.jpg`], meta: { post: 1 } }; },
      postSidecar: async (meta, names) => { seen.sidecar = names; },
    },
  });
  vm.runInContext(src("src/ext/quick-inline.js"), ctx);
  const btn = { disabled: false, setAttribute() {} };
  return { inline: ctx.PBQuickInline, btn, seen };
}

test("a gallery's four files are saved at the same time", async () => {
  const { inline, btn, seen } = load({ items: [{}, {}, {}, {}] });
  await inline.saveAll({}, btn);
  assert.equal(seen.most, 4, `at most ${seen.most} at once`);
});

test("control: the gallery's sidecar still lists the files in the post's order", async () => {
  const { inline, btn, seen } = load({ items: [{}, {}, {}, {}] });
  await inline.saveAll({}, btn);
  assert.deepEqual([...seen.sidecar], ["f0.jpg", "f1.jpg", "f2.jpg", "f3.jpg"]);
  assert.deepEqual([...seen.toasts.at(-1)], ["Saved all 4 files from the gallery.", "ok"]);
  assert.equal(btn.disabled, false);
});

test("the person sees how many files of a gallery have landed", async () => {
  const { inline, btn, seen } = load({ items: [{}, {}, {}, {}] });
  await inline.saveAll({}, btn);
  assert.ok(seen.toasts.some(([t]) => /1 of 4 files saved/.test(t)), seen.toasts.map(([t]) => t).join(" | "));
});

test("the button is usable again after a text save fails", async () => {
  const { inline, btn } = load({ text: { text: "words" }, failText: true });
  await assert.rejects(inline.saveAll({}, btn));
  assert.equal(btn.disabled, false, "a failed save leaves the button enabled");
});
