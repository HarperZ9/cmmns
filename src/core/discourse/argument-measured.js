// The argument lens's gate, written by scripts/eval-argument-gold.mjs --write from two people's
// annotations of the held-out gold passages (data/argument/passages.json). A role shows by default only
// when its precision is 0.8 or more from at least 3 hits; boundaries per language need precision 0.8
// and recall 0.7. Until annotations exist every entry is null and nothing passes.
export const ARGUMENT_GATE = { premise: null, "minor premise": null, "supporting premise": null, assumption: null, conclusion: null, turn: null };
export const BOUNDARY_GATE = { la: null, en: null, fr: null, es: null, pt: null };
export const GATE_SOURCE = "awaiting two annotators";
