// The hover Download control stays visible over a site's own top-layer content (src/ext/quick-hover-ui.js).
// Seen live on 2026-10-29: on YouTube in fullscreen the control was shown but the video was the
// topmost thing at its centre, because the fullscreen player entered the top layer after the
// control's host. quick-hover-ui.js runs in a vm over a small fake DOM whose top layer is a list.
// With CMMNS_SIM_SRC pointing at a checkout from before the fix, the first three tests fail.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (f) => readFileSync(resolve(root, process.env.CMMNS_SIM_SRC || ".", f), "utf8");

function world() {
  const top = [], docOn = {};
  const node = (tag) => {
    const n = { tagName: String(tag).toUpperCase(), children: [], style: {}, attrs: {}, hidden: false, isConnected: false, className: "", textContent: "",
      setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; }, addEventListener() {},
      append(...xs) { for (const x of xs) { this.children.push(x); x.parent = this; } }, remove() { this.isConnected = false; const i = top.indexOf(this); if (i >= 0) top.splice(i, 1); },
      get firstChild() { return this.children[0]; }, focus() {}, querySelector() { return null; }, querySelectorAll() { return []; },
      getBoundingClientRect: () => ({ left: 0, top: 0, right: 62, bottom: 32, width: 62, height: 32 }),
      attachShadow() { this.shadow = node("#shadow"); return this.shadow; },
      matches(sel) { return sel === ":popover-open" && top.includes(this); },
      showPopover() { if (top.includes(this)) throw new Error("already open"); top.push(this); },
      hidePopover() { const i = top.indexOf(this); if (i >= 0) top.splice(i, 1); },
    };
    return n;
  };
  const document = {
    createElement: node, createElementNS: (_, t) => node(t),
    documentElement: { append(h) { h.isConnected = true; } },
    addEventListener: (t, f) => { docOn[t] = f; },
  };
  const ctx = vm.createContext({ document, innerWidth: 1200, innerHeight: 800, Math, Object, console });
  vm.runInContext(src("src/ext/quick-hover-ui.js"), ctx);
  return { ui: ctx.PBHoverUi, top, docOn, node };
}
const rect = { left: 100, top: 100, right: 500, bottom: 400, width: 400, height: 300 };
const hostOf = (top) => top.find((x) => x.tagName === "DAYLIGHT-HOVER");

test("a fullscreen player that entered the top layer after the control does not cover it on the next show", () => {
  const w = world();
  w.ui.show(rect, "Save a reference", () => {});
  const player = w.node("div"); w.top.push(player);   // the site goes fullscreen
  w.ui.show(rect, "Save a reference", () => {});
  assert.equal(w.top[w.top.length - 1], hostOf(w.top), "the control's host is the topmost entry");
});

test("entering fullscreen while the control is up lifts it back over the player", () => {
  const w = world();
  w.ui.show(rect, "Save a reference", () => {});
  const player = w.node("div"); w.top.push(player);
  w.docOn.fullscreenchange();
  assert.equal(w.top[w.top.length - 1], hostOf(w.top));
});

test("a host the page removed is rebuilt with its bar, not left with a bar in the old root", () => {
  const w = world();
  w.ui.show(rect, "Download", () => {});
  const first = hostOf(w.top);
  first.remove();   // the page dropped the element
  w.ui.show(rect, "Download", () => {});
  const second = hostOf(w.top);
  assert.ok(second && second !== first, "a new host");
  assert.ok(second.shadow.children.some((c) => c.className === "bar" && !c.hidden), "the bar is drawn in the new host");
});

test("control: a hidden control is not lifted when the page enters fullscreen", () => {
  const w = world();
  w.ui.show(rect, "Download", () => {});
  w.ui.hide();
  const player = w.node("div"); w.top.push(player);
  if (w.docOn.fullscreenchange) w.docOn.fullscreenchange();
  assert.equal(w.top[w.top.length - 1], player);
});
