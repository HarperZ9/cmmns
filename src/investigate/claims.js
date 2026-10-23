// `case claim` and `case label`: the claim inventory, and blind rung labels from more than one
// labeller with their agreement. A rung says how far the evidence carries a claim:
//   documented   the record shows it (a person's own words prove that they said them)
//   inference    a strong inference from documented records, stated as inference
//   unproven     no record settles it yet; the investigation stays open
//   contradicted the record contradicts it
// Insinuation never gets a rung. A claim that rests on the subject's own word alone is marked
// self-sourced and counts for nothing as corroboration.
import { RUNGS, addRow, byId } from "./store.js";

export function checkClaim(c, sources, claims) {
  if (!c.text || !String(c.text).trim()) return "a claim needs its text";
  if (!RUNGS.includes(c.rung)) return `--rung must be one of ${RUNGS.join(", ")}`;
  if (!c.source) return "a claim needs --source <source id>";
  for (const s of String(c.source).split(",")) if (!sources.has(s.trim())) return `no source ${s.trim()} in this case`;
  for (const k of ["retells", "corroborates"]) if (c[k] && !claims.has(c[k])) return `--${k} names ${c[k]}, which is not a claim in this case`;
  if (c.retells && c.corroborates) return "a claim either retells another claim or corroborates it, not both";
  return null;
}

export function addClaim(dir, data, c) {
  const row = {
    text: String(c.text).trim(), source: String(c.source).split(",").map((s) => s.trim()).join(","), rung: c.rung,
    retells: c.retells || null, corroborates: c.corroborates || null, self_sourced: !!c.selfSourced,
    date: c.date || null, key: c.key || null, note: c.note || null, added: c.now || new Date().toISOString(),
  };
  const problem = checkClaim(row, byId(data.sources), byId(data.claims));
  if (problem) throw new Error(problem);
  return addRow(dir, "claims", row);
}

export function addLabel(dir, data, { claim, labeller, rung, now }) {
  if (!byId(data.claims).has(claim)) throw new Error(`no claim ${claim} in this case`);
  if (!labeller) throw new Error("a label needs --labeller <name>");
  if (!RUNGS.includes(rung)) throw new Error(`--rung must be one of ${RUNGS.join(", ")}`);
  if (data.labels.some((l) => l.claim === claim && l.labeller === labeller)) throw new Error(`${labeller} has already labelled ${claim}; labels are not overwritten`);
  return addRow(dir, "labels", { claim, labeller, rung, at: now || new Date().toISOString() });
}

// Agreement between the first two labellers over the claims both labelled: raw agreement, Cohen's
// kappa, and each disagreement with the rung in the inventory beside it.
export function labelAgreement(data) {
  const who = [...new Set(data.labels.map((l) => l.labeller))];
  if (who.length < 2) return { labellers: who, n: 0, agreement: null, kappa: null, disagreements: [], note: "needs labels from two labellers" };
  const [a, b] = who, get = (w) => new Map(data.labels.filter((l) => l.labeller === w).map((l) => [l.claim, l.rung]));
  const A = get(a), B = get(b), both = [...A.keys()].filter((k) => B.has(k)).sort();
  const n = both.length;
  if (!n) return { labellers: [a, b], n: 0, agreement: null, kappa: null, disagreements: [], note: "no claim has labels from both" };
  const agree = both.filter((k) => A.get(k) === B.get(k)).length, po = agree / n;
  const pe = RUNGS.reduce((s, r) => s + (both.filter((k) => A.get(k) === r).length / n) * (both.filter((k) => B.get(k) === r).length / n), 0);
  const kappa = pe === 1 ? 1 : (po - pe) / (1 - pe);
  const claims = byId(data.claims);
  const disagreements = both.filter((k) => A.get(k) !== B.get(k)).map((k) => ({ claim: k, [a]: A.get(k), [b]: B.get(k), inventory: claims.get(k).rung }));
  return { labellers: [a, b], n, agreement: Number(po.toFixed(3)), kappa: Number(kappa.toFixed(3)), disagreements };
}
