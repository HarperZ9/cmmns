// Connected ink components (8-neighbour), with the boxes the line finder works from.
export function components(mask, w, h) {
  const label = new Int32Array(w * h), parent = [0];
  const find = (a) => { while (parent[a] !== a) a = parent[a] = parent[parent[a]]; return a; };
  const join = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[Math.max(a, b)] = Math.min(a, b); };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      const n = [x > 0 ? label[i - 1] : 0, y > 0 && x > 0 ? label[i - w - 1] : 0, y > 0 ? label[i - w] : 0, y > 0 && x < w - 1 ? label[i - w + 1] : 0].filter(Boolean);
      if (!n.length) { label[i] = parent.length; parent.push(parent.length); continue; }
      label[i] = n[0];
      for (let k = 1; k < n.length; k++) join(n[0], n[k]);
    }
  }
  const boxes = new Map();
  for (let i = 0; i < label.length; i++) {
    if (!label[i]) continue;
    const r = find(label[i]), x = i % w, y = (i - x) / w;
    let b = boxes.get(r);
    if (!b) boxes.set(r, (b = { x0: x, y0: y, x1: x + 1, y1: y + 1, n: 0 }));
    if (x < b.x0) b.x0 = x; if (x >= b.x1) b.x1 = x + 1; if (y >= b.y1) b.y1 = y + 1;
    b.n++;
  }
  return [...boxes.values()];
}

const inside = (a, b) => a.x0 >= b.x0 && a.x1 <= b.x1 && a.y0 >= b.y0 && a.y1 <= b.y1 && a !== b;

// Components that can be characters: not specks, not rules, not frames around other components,
// not taller than a large headline.
export function glyphs(boxes, w, h, { maxHeight = 160 } = {}) {
  const keep = boxes.filter((b) => {
    const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
    if (b.n < 2 || bh > maxHeight || bh > 0.5 * h || bw > 0.6 * w) return false;
    if (bh <= 3 && bw > 12 * bh) return false;   // a rule or an underline on its own
    if (bw >= 40 && bh >= 40 && b.n > 0.88 * bw * bh) return false;   // a solid block: a photo, a filled button
    return true;
  });
  keep.sort((a, b) => a.x0 - b.x0);
  const frame = (b) => {
    if (b.x1 - b.x0 <= 8 || b.y1 - b.y0 <= 8) return false;
    let n = 0;
    for (let i = lowerBound(keep, b.x0); i < keep.length && keep[i].x0 < b.x1 && n < 2; i++) if (inside(keep[i], b)) n++;
    return n >= 2;
  };
  return keep.filter((b) => !frame(b));
}

function lowerBound(sorted, x0) {
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m].x0 < x0) lo = m + 1; else hi = m; }
  return lo;
}
