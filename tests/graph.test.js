// The coordination graph: accounts that keep replying in the same threads, from the local
// connections log, and a small deterministic force layout to draw it.
import test from "node:test";
import assert from "node:assert/strict";
import { coGraph, forceLayout } from "../src/core/graph.js";

const DAY = 86400000, NOW = Date.parse("2026-10-20T12:00:00Z");
const t = (at, ...hs) => ({ at, authors: Object.fromEntries(hs.map((h) => [h, 1])) });

test("edges join accounts seen together in at least `min` threads, labelled by count", () => {
  const net = { threads: { a: t(NOW, "p", "q", "x"), b: t(NOW, "p", "q"), c: t(NOW, "q", "r"), d: t(NOW, "q", "r", "p") } };
  const g = coGraph(net, { min: 2 });
  assert.deepEqual(g.edges.map(({ a, b, n }) => ({ a, b, n })), [{ a: "p", b: "q", n: 3 }, { a: "q", b: "r", n: 2 }]);
  assert.deepEqual(g.nodes.map((n) => n.id).sort(), ["p", "q", "r"]);
  const q = g.nodes.find((n) => n.id === "q");
  assert.equal(q.threads, 4);
  assert.equal(q.degree, 2);
});

test("only threads inside the window count", () => {
  const net = { threads: { a: t(NOW - 40 * DAY, "p", "q"), b: t(NOW - 39 * DAY, "p", "q"), c: t(NOW, "p", "q") } };
  assert.equal(coGraph(net, { min: 2, since: NOW - 30 * DAY }).edges.length, 0);
  assert.equal(coGraph(net, { min: 2 }).edges[0].n, 3);
});

test("the graph is capped to the most connected accounts", () => {
  const threads = {};
  for (let i = 0; i < 4; i++) threads["t" + i] = t(NOW, ...Array.from({ length: 30 }, (_, j) => "u" + j));
  const g = coGraph({ threads }, { min: 2, maxNodes: 8 });
  assert.equal(g.nodes.length, 8);
  for (const e of g.edges) assert.ok(g.nodes.some((n) => n.id === e.a) && g.nodes.some((n) => n.id === e.b));
  assert.ok(g.truncated);
});

test("an empty or missing log gives an empty graph", () => {
  assert.deepEqual(coGraph(undefined), { nodes: [], edges: [], truncated: false });
});

test("the layout is deterministic and stays inside the box", () => {
  const net = { threads: { a: t(NOW, "p", "q", "r"), b: t(NOW, "p", "q", "r"), c: t(NOW, "r", "s"), d: t(NOW, "r", "s") } };
  const g = coGraph(net, { min: 2 });
  const one = forceLayout(g, { width: 400, height: 300 }), two = forceLayout(g, { width: 400, height: 300 });
  assert.deepEqual(one, two);
  for (const n of one.nodes) {
    assert.ok(n.x >= 20 && n.x <= 380, `x ${n.x}`);
    assert.ok(n.y >= 20 && n.y <= 280, `y ${n.y}`);
  }
  // Connected accounts end up closer than unconnected ones.
  const at = (id) => one.nodes.find((n) => n.id === id);
  const dist = (a, b) => Math.hypot(at(a).x - at(b).x, at(a).y - at(b).y);
  assert.ok(dist("p", "q") < dist("p", "s"));
});

test("every edge carries its evidence: the threads both accounts replied in, and shared wording", () => {
  const net = { threads: {
    "x:1": { at: NOW - 3 * DAY, authors: { p: 1, q: 1 }, fps: { abc: ["p", "q"] } },
    "x:2": { at: NOW - DAY, authors: { p: 1, q: 1 } },
    "x:3": { at: NOW, authors: { p: 1, r: 1 } },
  } };
  const [e] = coGraph(net, { min: 2 }).edges;
  assert.deepEqual(e, { a: "p", b: "q", n: 2, threads: ["x:2", "x:1"], sameText: 1 });
});

test("thread keys become links where the key holds enough to build one", async () => {
  const { threadUrl } = await import("../src/core/graph.js");
  assert.equal(threadUrl("x:123"), "https://x.com/i/status/123");
  assert.equal(threadUrl("youtube:aB_c"), "https://www.youtube.com/watch?v=aB_c");
  assert.equal(threadUrl("reddit:abc1"), "https://www.reddit.com/comments/abc1");
  assert.equal(threadUrl("x:/some/path"), null);
  assert.equal(threadUrl("bluesky:3kxyz"), null);
});

test("500 accounts build and lay out in under a second", () => {
  // 500 accounts in 50 circles of 10; each circle replies together in 3 threads, and neighbouring
  // circles share one member's thread, so the graph is one connected piece.
  const threads = {};
  let k = 0;
  for (let c = 0; c < 50; c++) for (let r = 0; r < 3; r++) {
    const hs = Array.from({ length: 10 }, (_, j) => `c${c}_${j}`);
    if (r === 0 && c) hs.push(`c${c - 1}_0`);
    threads["x:" + k++] = t(NOW, ...hs);
  }
  const t0 = performance.now();
  const g = coGraph({ threads }, { min: 2, maxNodes: 500 });
  const L = forceLayout(g, { width: 1200, height: 800 });
  const ms = performance.now() - t0;
  assert.equal(L.nodes.length, 500);
  console.log(`# 500-node graph: ${g.edges.length} edges, built and laid out in ${ms.toFixed(0)} ms`);
  assert.ok(ms < 1000, `${ms.toFixed(0)} ms`);
});
