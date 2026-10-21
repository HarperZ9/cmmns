// Weighted log-odds with an informative Dirichlet prior (Monroe, Colaresi and Quinn 2008, "Fightin'
// Words", Political Analysis 16(4)). Counts are document frequencies: a term counts once per item,
// so one long text cannot carry a term on its own. The prior is the term's share of the whole
// language's dev text, scaled to A0 pseudo-documents, which shrinks rare terms toward zero.

export const A0 = 500;

// docs: [Set<term>]. Returns Map term -> df.
export function docFreq(docs) {
  const df = new Map();
  for (const d of docs) for (const t of d) df.set(t, (df.get(t) || 0) + 1);
  return df;
}

const total = (m) => { let s = 0; for (const v of m.values()) s += v; return s; };

// pos, neg: Map term -> df for the two sides; bg: Map term -> df over all text (the prior).
// Returns [{ term, z, delta, pos, neg }] for terms seen at least minPos times on the positive side,
// sorted by z, highest first.
export function logOdds(pos, neg, bg, minPos = 5) {
  const nPos = total(pos), nNeg = total(neg), nBg = total(bg);
  const out = [];
  for (const [term, yPos] of pos) {
    if (yPos < minPos) continue;
    const yNeg = neg.get(term) || 0;
    const a = Math.max(A0 * ((bg.get(term) || 0) / nBg), 1e-3);
    const lp = Math.log((yPos + a) / (nPos + A0 - yPos - a));
    const ln = Math.log((yNeg + a) / (nNeg + A0 - yNeg - a));
    const delta = lp - ln, z = delta / Math.sqrt(1 / (yPos + a) + 1 / (yNeg + a));
    out.push({ term, z, delta, pos: yPos, neg: yNeg });
  }
  return out.sort((x, y) => y.z - x.z);
}
