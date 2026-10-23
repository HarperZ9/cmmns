// The quote cluster for the launch campaign lens (project-docs/CAMPAIGN-LENS.md, signal 3): quote
// posts of a launch split by X's "Paid partnership" label, how tightly they bunch in time, and how
// much wording they share. Disclosed paid partnerships are context: disclosure is the honest path.
// Unlabelled quotes that share a template with labelled ones, or form their own template group
// inside a short window, are the indicator ("undisclosed look-alikes").

import { templateGroups, promoCues } from "./campaign-text.js";
import { ownWords } from "./similarity.js";
import { timePrecision, observable } from "./precision.js";

// BUNCH_TIGHT_MS: 5 quotes inside an hour count as coordination; a wider bunch is shown, not counted.
export const BUNCH_K = 5, BUNCH_TIGHT_MS = 3600000, LOOKALIKE_WINDOW_MS = 2 * 3600000, LOOKALIKE_MIN = 3, QUOTE_TEMPLATE_JACCARD = 0.4;
export const QUOTES_DOES_NOT_PROVE = "The quotes share timing and phrasing. People quote news in the same hour, and common phrases spread by imitation.";

const at = (q) => Date.parse(q.posted);

// The narrowest window holding k quotes, and the busiest hour: { kWindowMs, k, hourMax }. Bunching
// needs times to the minute (precision.js); coarser times give kWindowMs null and observable false.
export function bunching(quotes, k = BUNCH_K, precision) {
  const t = quotes.map(at).filter(Number.isFinite).sort((a, b) => a - b);
  if (!observable(timePrecision(quotes, precision).precision, "quote-bunching")) return { k, kWindowMs: null, hourMax: null, n: t.length, observable: false };
  let kWindowMs = null, hourMax = 0;
  for (let i = 0, j = 0; i < t.length; i++) {
    if (i >= k - 1) { const w = t[i] - t[i - k + 1]; if (kWindowMs == null || w < kWindowMs) kWindowMs = w; }
    while (t[i] - t[j] > 3600000) j++;
    hourMax = Math.max(hourMax, i - j + 1);
  }
  return { k, kWindowMs, hourMax, n: t.length, observable: true };
}

// quotes: [{ id, author, text, posted, paidPartnership }]. Returns
// { n, disclosed, undisclosed, bunch, groups: [{ size, disclosed, undisclosed, spanMs }], lookalikes, cues }.
export function quoteCluster(quotes, { precision } = {}) {
  const qs = (quotes || []).filter((q) => q && q.id);
  const own = qs.map((q) => ({ id: q.id, text: ownWords(q.text || "") || q.text || "" }));
  const byId = new Map(qs.map((q) => [q.id, q]));
  const groups = templateGroups(own, { min: 2, jaccard: QUOTE_TEMPLATE_JACCARD }).map((g) => {
    const members = g.ids.map((id) => byId.get(id)), times = members.map(at).filter(Number.isFinite);
    const disclosed = members.filter((m) => m.paidPartnership).length;
    return { size: g.size, disclosed, undisclosed: g.size - disclosed, spanMs: times.length > 1 ? Math.max(...times) - Math.min(...times) : 0, ids: g.ids };
  });
  // Shared promo cues count as a template too: the same cue id across several quotes.
  const cueIds = {};
  for (const q of qs) for (const c of promoCues(q.text)) (cueIds[c.id] = cueIds[c.id] || { id: c.id, source: c.source, ids: [] }).ids.push(q.id);
  for (const c of Object.values(cueIds)) {
    if (c.ids.length < 2 || groups.some((g) => c.ids.every((id) => g.ids.includes(id)))) continue;
    const members = c.ids.map((id) => byId.get(id)), times = members.map(at).filter(Number.isFinite);
    const disclosed = members.filter((m) => m.paidPartnership).length;
    groups.push({ size: c.ids.length, disclosed, undisclosed: c.ids.length - disclosed, spanMs: times.length > 1 ? Math.max(...times) - Math.min(...times) : 0, ids: c.ids, cue: c.id, source: c.source });
  }
  const look = new Set();
  for (const g of groups) {
    const und = g.ids.filter((id) => !byId.get(id).paidPartnership);
    if (g.disclosed && und.length) und.forEach((id) => look.add(id));
    else if (!g.disclosed && und.length >= LOOKALIKE_MIN && g.spanMs <= LOOKALIKE_WINDOW_MS) und.forEach((id) => look.add(id));
  }
  return {
    n: qs.length,
    disclosed: qs.filter((q) => q.paidPartnership).length,
    undisclosed: qs.filter((q) => !q.paidPartnership).length,
    bunch: bunching(qs, BUNCH_K, precision),
    groups: groups.map(({ ids, ...g }) => g).sort((a, b) => b.size - a.size),
    lookalikes: look.size,
    cues: Object.values(cueIds).filter((c) => c.ids.length >= 2).map((c) => ({ id: c.id, source: c.source, n: c.ids.length })),
  };
}
