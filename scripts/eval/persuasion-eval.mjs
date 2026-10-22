// Span-level precision of Daylight Commons' persuasion cues against the PTC gold spans. A Daylight Commons span counts
// as correct when it overlaps a gold span whose label is in the technique's GOLD_OF list. Gold
// annotations are not exhaustive, so an unlabelled true use counts as a miss: the figures lean low.
//   chance: the share of word tokens that sit inside a gold span of the technique, the precision a
//   cue would get by landing on random words. A cue is worth something only well above it.

import { rate } from "./metrics.mjs";
import { GOLD_OF } from "./ptc.mjs";
import { techniqueSpans, TECHNIQUES } from "../../src/core/persuasion.js";

const overlaps = (a, b) => a.start < b.end && b.start < a.end;

function chanceOf(items, labels) {
  let inside = 0, words = 0;
  for (const it of items) {
    const gold = it.spans.filter((g) => labels.includes(g.technique));
    for (const m of it.text.matchAll(/[\w'-]+/g)) {
      words++;
      const w = { start: m.index, end: m.index + m[0].length };
      if (gold.some((g) => overlaps(g, w))) inside++;
    }
  }
  return rate(inside, words);
}

// items: loadPtc(...) filtered to one split. Returns per-technique and per-cue figures.
export function evaluatePtc(items) {
  const tech = {}, cues = {};
  for (const t of Object.keys(TECHNIQUES)) tech[t] = { tp: 0, n: 0, anyTp: 0, goldHit: 0, gold: 0 };
  for (const it of items) {
    const spans = techniqueSpans(it.text).filter((h) => h.lang === "en");
    for (const h of spans) {
      const labels = GOLD_OF[h.technique];
      const ok = it.spans.some((g) => labels.includes(g.technique) && overlaps(g, h));
      const any = it.spans.some((g) => overlaps(g, h));
      const T = tech[h.technique];
      T.n++; if (ok) T.tp++; if (any) T.anyTp++;
      const key = `${h.technique} | ${h.cue}`;
      cues[key] = cues[key] || { n: 0, tp: 0 };
      cues[key].n++; if (ok) cues[key].tp++;
    }
    for (const t of Object.keys(TECHNIQUES)) {
      const gold = it.spans.filter((g) => GOLD_OF[t].includes(g.technique));
      tech[t].gold += gold.length;
      tech[t].goldHit += gold.filter((g) => spans.some((h) => h.technique === t && overlaps(g, h))).length;
    }
  }
  const out = {};
  for (const [t, T] of Object.entries(tech)) {
    out[t] = { against: GOLD_OF[t], precision: rate(T.tp, T.n), precisionAnyTechnique: rate(T.anyTp, T.n),
      recall: rate(T.goldHit, T.gold), chance: chanceOf(items, GOLD_OF[t]) };
  }
  return { articles: items.length, techniques: out, cues };
}
