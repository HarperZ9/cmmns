// Rhetoric marker evaluation on one split of the labelled corpora: per family, per side, per
// target group, and the thread report's "extreme" against the human severity labels.

import { score } from "../../src/core/rhetoric.js";
import { confusion, bySide, byGroup, FAMILIES, STRONG } from "./metrics.mjs";

// The gold field each family is checked against, per corpus. "hostile" is the broad label; a
// family-specific field is used where the corpus has one. null: no label for that family.
const SPECIFIC = { dehumanise: "dehumanise", violence: "violence", stereotype: "stereotype" };

const HITS = {
  ...Object.fromEntries(FAMILIES.map((f) => [f, (r) => r.fams.has(f)])),
  strong: (r) => STRONG.some((f) => r.fams.has(f)),
  strongNoSlur: (r) => STRONG.some((f) => f !== "slur" && r.fams.has(f)),
  extreme: (r) => r.extreme,
};

const hasGold = (items, key) => items.some((i) => i.gold[key] != null);

export function evaluateCorpus(items) {
  const rows = items.map((item) => {
    const s = score(item.text);
    return { item, fams: new Set(s.markers.map((m) => m.family)), extreme: s.extreme };
  });
  const hostile = (i) => i.gold.hostile;
  const out = { n: items.length, prevalence: confusion(rows, () => false, hostile).prevalence, families: {}, sides: {}, groups: {} };
  for (const f of FAMILIES) {
    const spec = SPECIFIC[f] && hasGold(items, SPECIFIC[f]) ? confusion(rows, HITS[f], (i) => i.gold[SPECIFIC[f]]) : null;
    out.families[f] = { againstHostile: confusion(rows, HITS[f], hostile), againstSpecific: spec };
  }
  out.families.strong = { againstHostile: confusion(rows, HITS.strong, hostile) };
  out.extreme = { againstSevere: confusion(rows, HITS.extreme, (i) => i.gold.severe), againstHostile: confusion(rows, HITS.extreme, hostile) };
  for (const k of ["strong", "strongNoSlur", "extreme"]) out.sides[k] = bySide(rows, HITS[k], hostile);
  out.groups.strong = byGroup(rows, HITS.strong, hostile);
  return out;
}
