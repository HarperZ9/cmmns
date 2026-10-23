// The thread panel on a YouTube video with no comments. Live check 2026-10-21: videos from a
// state-funded broadcaster with comments off showed no Daylight Commons panel, so YouTube's funding label
// was invisible in Daylight Commons. Runs panel.js against a minimal stand-in for the DOM.
import test from "node:test";
import assert from "node:assert/strict";

class Node {
  constructor(tag) { this.tag = tag; this.children = []; this.dataset = {}; this.attrs = {}; this.textContent = ""; this.className = ""; this.id = ""; }
  append(...n) { this.children.push(...n); }
  replaceChildren() { this.children = []; }
  setAttribute(k, v) { this.attrs[k] = v; }
  addEventListener() {}
  remove() {}
  get text() { return [this.textContent, ...this.children.map((c) => c.text)].join(" "); }
}
const body = new Node("body");
globalThis.document = {
  body,
  createElement: (t) => new Node(t),
  getElementById: (id) => body.children.find((c) => c.id === id) || null,
};
globalThis.sessionStorage = { getItem: () => null, setItem() {} };
await import("../src/ext/core.bundle.js");
await import("../src/ext/panel.js");
const { PBPanel, PB } = globalThis;
const YT = { id: "youtube", name: "YouTube", hasLocation: false };
const video = { channel: "Some Broadcaster", funding: "Some Broadcaster is funded in whole or in part by a government." };

test("collapsed, the button names the funding label even with no comments", () => {
  PBPanel.render(PB.threadReport([]), [], { site: YT, video, pushed: [] }, () => {});
  const head = body.children.find((c) => c.id === "pb-panel").children[0];
  assert.match(head.textContent, /Daylight Commons · 0 · funding label/);
});

test("open with no comments, the panel says why there is no report and still shows the funding", () => {
  PBPanel.setOpen(true);
  PBPanel.render(PB.threadReport([]), [], { site: YT, video, pushed: [] }, () => {});
  const text = body.children.find((c) => c.id === "pb-panel").text;
  assert.match(text, /Zero comments loaded on this page/);
  assert.match(text, /Funding: Some Broadcaster is funded/);
  assert.doesNotMatch(text, /Too few extreme replies/);
});

test("without a funding label the button is unchanged", () => {
  PBPanel.setOpen(false);
  PBPanel.render(PB.threadReport([]), [], { site: YT, video: { channel: "c" }, pushed: [] }, () => {});
  const head = body.children.find((c) => c.id === "pb-panel").children[0];
  assert.equal(head.textContent, "Daylight Commons · 0");
});
