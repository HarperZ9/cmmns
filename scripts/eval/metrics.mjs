// Precision and recall with Wilson 95% intervals, per family, per side and per target group.

import { wilson } from "../../src/core/report.js";

const r3 = (x) => Math.round(x * 1000) / 1000;
export const rate = (k, n) => ({ k, n, value: n ? r3(k / n) : null, ci: n ? wilson(k, n).map(r3) : null });

// The families Radar emits, and the gold field each one is checked against. "hostile" is the
// broad label (any group-directed hostility the annotators saw); the specific fields are stricter.
export const FAMILIES = ["dehumanise", "violence", "vigilante", "slur", "slurSoft", "stereotype", "motive", "essentialise",
  "conspiracy", "absolutist", "contempt"];
export const STRONG = ["dehumanise", "violence", "vigilante", "slur", "stereotype"];

// rows: [{ item, fams: Set }]. hitOf(row) -> bool; goldOf(item) -> bool | null.
export function confusion(rows, hitOf, goldOf) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const r of rows) {
    const g = goldOf(r.item);
    if (g == null) continue;
    const h = hitOf(r);
    if (h && g) tp++; else if (h) fp++; else if (g) fn++; else tn++;
  }
  return { tp, fp, fn, tn, precision: rate(tp, tp + fp), recall: rate(tp, tp + fn), prevalence: rate(tp + fn, tp + fp + fn + tn) };
}

// Two Wilson intervals that do not overlap.
export const gap = (a, b) => Boolean(a.ci && b.ci && (a.ci[0] > b.ci[1] || b.ci[0] > a.ci[1]));

export function bySide(rows, hitOf, goldOf) {
  const out = {};
  for (const side of ["right-targets", "left-targets", "both"]) {
    out[side] = confusion(rows.filter((r) => r.item.sides.has(side)), hitOf, goldOf);
  }
  const R = out["right-targets"], L = out["left-targets"];
  out.gap = { precision: gap(R.precision, L.precision), recall: gap(R.recall, L.recall) };
  return out;
}

export function byGroup(rows, hitOf, goldOf, min = 30) {
  const groups = new Map();
  for (const r of rows) for (const g of r.item.groups) { if (!groups.has(g)) groups.set(g, []); groups.get(g).push(r); }
  const out = {};
  for (const [g, rs] of [...groups].sort()) if (rs.length >= min) out[g] = confusion(rs, hitOf, goldOf);
  return out;
}
