// Measured accuracy per badge family, from the held-out test split in project-docs/EVALUATION.md.
// The evaluation fills this table; the window and the options page read it through
// families.js (measuredLine). A family with no row here shows "not measured yet".
//
// Row shape, one per family id from families.js:
//   { precision, low, high, n, split: "test", recall?, side?, date?, source? }
//   precision, low, high: 0 to 1 (low and high are the 95% interval); n: badges checked.

export const MEASURED_AT = null;
export const MEASURED = {};
