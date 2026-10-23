// Joining a labelling run: the fixed case set, labeller A (Claude), labeller B (an open-weight model
// of another family), Claude's resolutions and the detector's output. The final label is A's, or
// Claude's resolution where A and B differ. Scoring refuses a run with a disagreement that has no
// resolution, or a resolution with no written reason (format.mjs checks the reason).
//
// The method statement is built here and only here. It names the labellers as they are; nothing in
// this kit can describe a run as labelled by people (tests/label.run.test.js).

export const METHOD = "Labelled by Claude, cross-checked by an independent open-weight model";

export const DOES_NOT_PROVE = "Agreement between two models shows consistency, not truth. Claude helped write the detector rules, so a blind spot shared by the rules and labeller A can inflate the measured accuracy; labeller B and the hashed, blind order guard against it but do not remove it. Only a human audit is ground truth, and any spot-check covers a sample. A held fairness bound says nothing about strata with fewer than 30 organic cases.";

// "Labelled by Claude, cross-checked by an independent open-weight model (kappa = x), n cases."
export function statement(kappa, n) {
  const k = kappa === null || kappa === undefined ? "not computable" : kappa.toFixed(2);
  return `${METHOD} (kappa = ${k}), ${n} cases.`;
}

function byCase(rows, what) {
  const m = new Map();
  for (const r of rows) m.set(r.case, r);
  return m;
}

function sameSet(ids, map, what) {
  for (const id of ids) if (!map.has(id)) throw new Error(`${what} has no row for case ${id}`);
  for (const id of map.keys()) if (!ids.has(id)) throw new Error(`${what} has case ${id}, which is not in the fixed case set`);
}

function oneLabeller(rows, who) {
  for (const r of rows) if (r.labeller !== who) throw new Error(`the labeller ${who} file holds a row from labeller ${r.labeller} (case ${r.case})`);
}

// input: { cases, a, b, resolution, lens } as parsed rows. Returns one joined row per case.
export function joinCases({ cases, a, b, resolution = [], lens }) {
  const ids = new Set(cases.map((c) => c.case));
  oneLabeller(a, "A");
  oneLabeller(b, "B");
  const A = byCase(a), B = byCase(b), R = byCase(resolution), L = byCase(lens);
  sameSet(ids, A, "labeller A's file");
  sameSet(ids, B, "labeller B's file");
  sameSet(ids, L, "the detector file");
  for (const id of R.keys()) {
    if (!ids.has(id)) throw new Error(`the resolution file has case ${id}, which is not in the fixed case set`);
    if (A.get(id).campaign === B.get(id).campaign) throw new Error(`case ${id} has a resolution but A and B agree; resolve disagreements only`);
  }
  return cases.map((c) => {
    const x = A.get(c.case), y = B.get(c.case), disagreed = x.campaign !== y.campaign;
    const res = R.get(c.case);
    if (disagreed && !res) throw new Error(`case ${c.case}: A says ${x.campaign}, B says ${y.campaign}, and there is no resolution with a reason`);
    return { case: c.case, a: x.campaign, b: y.campaign, disagreed, label: disagreed ? res.final : x.campaign, strata: c.strata, lens: L.get(c.case).lens };
  });
}

// The optional author spot-check. Never a gate: the results say whether one was done, and how it went.
export function spotCheckOf(spot, n) {
  if (!spot || spot.done !== true) return { done: false, note: "No author spot-check was done. It is optional." };
  const { checked, agreed } = spot;
  if (!Number.isInteger(checked) || checked < 1 || checked > n) throw new Error(`spot-check checked must be a whole number from 1 to ${n}`);
  if (!Number.isInteger(agreed) || agreed < 0 || agreed > checked) throw new Error("spot-check agreed must be a whole number from 0 to checked");
  return { done: true, checked, of: n, agreed, text: `The author spot-checked ${checked} of ${n} cases and agreed with ${agreed}.` };
}
