// When the hover Download control shows, and what a failed click says (3.9.1). quick-hover.js runs
// in a vm over a drawn scene: one clear layer covers a post (a header and a picture), as on X and
// Instagram, and the pointer moves the way a hand does. Timers and the clock are mocked.
// With CMMNS_SIM_SRC pointing at a checkout from before the fix, the defect cases fail.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (f) => readFileSync(resolve(root, process.env.CMMNS_SIM_SRC || process.env.DAYLIGHT_SIM_SRC || ".", f), "utf8");

// A post at x 0..400: a header (y 0..100), then a picture from y 100 down to `bottom`, all under one
// clear layer. reply is what the worker answers a click with.
function scene({ bottom = 400, reply = { ok: true } } = {}) {
  const pic = { bottom };
  const rect = () => ({ left: 0, top: 100, right: 400, bottom: pic.bottom, width: 400, height: pic.bottom - 100 });
  const img = { nodeType: 1, tagName: "IMG", children: [], currentSrc: "https://cdn.example/p.jpg", getBoundingClientRect: rect, parentElement: null };
  const cover = { nodeType: 1, tagName: "DIV", children: [], getBoundingClientRect: () => ({ left: 0, top: 0, right: 400, bottom: 500, width: 400, height: 500 }), parentElement: null };
  const under = (x, y) => x >= 0 && x <= 400 && y >= 100 && y <= pic.bottom;
  const on = {}, shows = [], notes = [];
  const ctx = vm.createContext({
    setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: (t) => clearTimeout(t), Date: { now: () => Date.now() }, console: { warn() {} },
    requestAnimationFrame: (f) => { f(); return 0; }, getComputedStyle: () => ({ backgroundImage: "none" }),
    location: { hostname: "www.instagram.com" }, innerHeight: 900, innerWidth: 1200,
    addEventListener: (type, f) => { on[type] = f; }, getSelection: () => null,
    document: { elementFromPoint: () => cover, elementsFromPoint: (x, y) => (under(x, y) ? [cover, img] : [cover]), addEventListener() {}, activeElement: null },
    chrome: { runtime: { id: "sim", sendMessage: async () => reply }, storage: { local: { get: async () => ({}) }, onChanged: { addListener() {} } } },
    PBHoverUi: { show: (r, label, act) => shows.push({ label, act }), hide() {}, place() {}, covers: () => false, menuOpen: () => false, isHost: () => false, note: (t) => notes.push(t) },
  });
  vm.runInContext(src("src/ext/quick-hover.js"), ctx);
  const move = (x, y) => on.pointermove({ clientX: x, clientY: y, pointerType: "mouse" });
  return { move, shows, notes, pic };
}

// Moves along points one per 16 ms; returns the time when the control first showed, or null.
function walk(t, s, points) {
  let at = 0;
  for (const [x, y] of points) {
    s.move(x, y);
    t.mock.timers.tick(16); at += 16;
    if (s.shows.length) return at;
  }
  return null;
}
const jitter = (x, y, n) => Array.from({ length: n }, (_, i) => [x + ((i * 7) % 5) - 2, y + ((i * 3) % 5) - 2]);

test("a hand's small movements over a picture do not keep the control away", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const s = scene();
  const shown = walk(t, s, jitter(200, 250, 40));
  assert.ok(shown !== null && shown <= 340, `shown after ${shown} ms of 1 to 2 px moves`);
});

test("control: a pointer passing over the picture does not bring the control up", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const s = scene();
  assert.equal(walk(t, s, Array.from({ length: 30 }, (_, i) => [10 + i * 13, 250])), null);
});

test("a pointer that enters the post over its header still finds the picture under the same layer", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const s = scene();
  walk(t, s, [[200, 40], [200, 60]]);
  s.move(200, 250);
  t.mock.timers.tick(400);
  assert.equal(s.shows.length, 1, "the control shows once the pointer rests on the picture");
});

test("a picture that loads to full size under the pointer gets the control", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const s = scene({ bottom: 140 });   // 40 px tall: too small for the control
  walk(t, s, jitter(200, 120, 10));
  assert.equal(s.shows.length, 0);
  s.pic.bottom = 400;
  assert.ok(walk(t, s, jitter(200, 120, 40)) !== null, "the control shows after the picture grew");
});

test("a click the worker could not carry out says why beside the control", async (t) => {
  const s = scene({ reply: { error: "the frame could not be read" } });
  s.move(200, 250);
  await new Promise((r) => setTimeout(r, 360));
  assert.equal(s.shows.length, 1);
  s.shows[0].act("download");
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(s.notes, ["Not saved: the frame could not be read"]);
});

test("a hidden control is not drawn: the [hidden] rule beats the bar's display", () => {
  const css = src("src/ext/quick-hover-ui.js");
  assert.match(css, /\.bar\[hidden\][^{]*\{\s*display:\s*none/, "the bar sets display: flex, which would otherwise keep a hidden bar on screen");
});
