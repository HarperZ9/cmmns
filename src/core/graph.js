// The coordination graph: accounts that keep replying in the same threads the user opened, from the
// local connections log (network.js), and a small deterministic force layout to draw it. An edge
// is "these two accounts replied in n of the same threads". That happens with friends, fans of the
// same creator and people who follow the same news, as well as with coordinated accounts.

export const GRAPH_MIN = 2, GRAPH_MAX_NODES = 500, EDGE_MAX_THREADS = 20;
const SEP = "\u0000";

// net: { threads: { [key]: { at, authors: { [handle]: delay }, fps: { [fingerprint]: [handles] } } } }
// Returns { nodes: [{ id, threads, degree, weight }], edges: [{ a, b, n, threads, sameText }], truncated }.
// Each edge carries its evidence: the keys of the threads (newest first, at most EDGE_MAX_THREADS)
// where both accounts replied, and in how many of them both posted the same wording.
export function coGraph(net, { min = GRAPH_MIN, maxNodes = GRAPH_MAX_NODES, since = -Infinity } = {}) {
  const threads = Object.entries((net && net.threads) || {}).filter(([, t]) => t && (t.at == null || t.at >= since))
    .sort((x, y) => (y[1].at || 0) - (x[1].at || 0));
  // Only accounts seen in at least `min` threads can share `min` threads with anyone.
  const seen = new Map();
  for (const [, t] of threads) for (const h of Object.keys(t.authors || {})) seen.set(h, (seen.get(h) || 0) + 1);
  const pairs = new Map();
  for (const [key, t] of threads) {
    const hs = Object.keys(t.authors || {}).filter((h) => seen.get(h) >= min).sort();
    const same = sameTextPairs(t.fps);
    for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) {
      const k = hs[i] + SEP + hs[j];
      let p = pairs.get(k);
      if (!p) pairs.set(k, (p = { n: 0, threads: [], sameText: 0 }));
      p.n++;
      if (p.threads.length < EDGE_MAX_THREADS) p.threads.push(key);
      if (same.has(k)) p.sameText++;
    }
  }
  let edges = [...pairs].filter(([, p]) => p.n >= min).map(([k, p]) => { const [a, b] = k.split(SEP); return { a, b, ...p }; });
  const weight = new Map();
  for (const e of edges) for (const h of [e.a, e.b]) weight.set(h, (weight.get(h) || 0) + e.n);
  const ranked = [...weight].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1));
  const keep = new Set(ranked.slice(0, maxNodes).map(([h]) => h));
  const truncated = ranked.length > keep.size;
  edges = edges.filter((e) => keep.has(e.a) && keep.has(e.b)).sort((x, y) => y.n - x.n || (x.a + x.b < y.a + y.b ? -1 : 1));
  const degree = new Map();
  for (const e of edges) for (const h of [e.a, e.b]) degree.set(h, (degree.get(h) || 0) + 1);
  const nodes = [...keep].filter((h) => degree.has(h)).map((id) => ({ id, threads: seen.get(id), degree: degree.get(id), weight: weight.get(id) }));
  return { nodes, edges, truncated };
}

// Pairs of accounts that posted the same wording in one thread (fps: { fingerprint: [handles] }).
function sameTextPairs(fps) {
  const out = new Set();
  for (const hs of Object.values(fps || {})) {
    const s = [...hs].sort();
    for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) out.add(s[i] + SEP + s[j]);
  }
  return out;
}

// Fruchterman-Reingold, seeded on a circle in a fixed order, so the same log draws the same way.
// Repulsion is all-pairs, so the number of rounds shrinks as the graph grows: 500 accounts lay out
// in 60 rounds, inside the one-second budget that tests/graph.test.js measures.
export function forceLayout(graph, { width = 640, height = 360, pad = 20, iterations } = {}) {
  const ns = [...graph.nodes].sort((a, b) => (a.id < b.id ? -1 : 1));
  const n = ns.length, cx = width / 2, cy = height / 2;
  if (!n) return { nodes: [], edges: graph.edges };
  const X = new Float64Array(n), Y = new Float64Array(n), DX = new Float64Array(n), DY = new Float64Array(n);
  for (let i = 0; i < n; i++) { X[i] = cx + (width / 3) * Math.cos((2 * Math.PI * i) / n); Y[i] = cy + (height / 3) * Math.sin((2 * Math.PI * i) / n); }
  const idx = new Map(ns.map((v, i) => [v.id, i]));
  const links = graph.edges.map((e) => [idx.get(e.a), idx.get(e.b), Math.min(2, 0.5 + e.n / 4)]).filter(([i, j]) => i != null && j != null);
  const k = Math.sqrt(((width - 2 * pad) * (height - 2 * pad)) / n) * 0.75, k2 = k * k;
  const rounds = iterations || Math.max(40, Math.min(300, Math.round(30000 / n)));
  let temp = width / 8;
  const cool = Math.pow(0.5 / temp, 1 / rounds);
  for (let it = 0; it < rounds; it++) {
    DX.fill(0); DY.fill(0);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      let dx = X[i] - X[j], dy = Y[i] - Y[j], d2 = dx * dx + dy * dy;
      if (d2 < 1e-4) { dx = 0.01 * (i - j); dy = 0.01; d2 = dx * dx + dy * dy; }
      const f = k2 / d2;   // (k^2 / d) along the unit vector, which is (dx, dy) / d
      DX[i] += dx * f; DY[i] += dy * f; DX[j] -= dx * f; DY[j] -= dy * f;
    }
    for (const [i, j, w] of links) {
      const dx = X[i] - X[j], dy = Y[i] - Y[j], f = (Math.sqrt(dx * dx + dy * dy) / k) * w;   // d^2 / k along the unit vector
      DX[i] -= dx * f; DY[i] -= dy * f; DX[j] += dx * f; DY[j] += dy * f;
    }
    // Gravity toward the centre keeps separate clusters from drifting apart; the drawing is
    // fitted to the box at the end, so nothing is pinned against an edge on the way.
    for (let i = 0; i < n; i++) {
      DX[i] -= (X[i] - cx) * GRAVITY * Math.sqrt(n); DY[i] -= (Y[i] - cy) * GRAVITY * Math.sqrt(n);
      const len = Math.sqrt(DX[i] * DX[i] + DY[i] * DY[i]) || 1, step = Math.min(len, temp);
      X[i] += (DX[i] / len) * step; Y[i] += (DY[i] / len) * step;
    }
    temp = Math.max(0.5, temp * cool);
  }
  fit(X, Y, width, height, pad);
  const round = (x) => Math.round(x * 10) / 10;
  return { nodes: ns.map((v, i) => ({ ...v, x: round(X[i]), y: round(Y[i]) })), edges: graph.edges };
}

const GRAVITY = 0.6;

// Scales the drawing up, evenly on both axes, to fill the box: a dense cluster would otherwise sit
// small in the middle.
function fit(X, Y, width, height, pad) {
  const n = X.length;
  if (n < 2) { if (n) { X[0] = width / 2; Y[0] = height / 2; } return; }
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < n; i++) { x0 = Math.min(x0, X[i]); x1 = Math.max(x1, X[i]); y0 = Math.min(y0, Y[i]); y1 = Math.max(y1, Y[i]); }
  const s = Math.min((width - 2 * pad) / Math.max(1, x1 - x0), (height - 2 * pad) / Math.max(1, y1 - y0));
  const ox = (width - s * (x1 - x0)) / 2, oy = (height - s * (y1 - y0)) / 2;
  for (let i = 0; i < n; i++) { X[i] = ox + s * (X[i] - x0); Y[i] = oy + s * (Y[i] - y0); }
}

// A link to a thread from its key (src/core/threadkey.js), where the key holds enough to build one.
export function threadUrl(key) {
  const m = String(key || "").match(/^([a-z]+):(.+)$/);
  if (!m || m[2].startsWith("/")) return null;
  const id = m[2];
  return ({ x: `https://x.com/i/status/${id}`, reddit: `https://www.reddit.com/comments/${id}`, youtube: `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`, instagram: `https://www.instagram.com/p/${id}/` })[m[1]] || null;
}

export const GRAPH_DOES_NOT_PROVE = "Two accounts replying in the same threads is what friends, fans of one creator and people following the same news do, as well as coordinated accounts. The graph covers only threads you opened, and it says nothing about who runs any account.";
