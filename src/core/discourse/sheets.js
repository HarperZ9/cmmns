// Truth as sheets (project-docs/DISCOURSE.md): a claim is a sheet laid over what it rests on. The
// post sits on top, the replies that bring a source beneath it, the primary documents at the ground.
// Each sheet's ink coverage is its reach, so a claim seen 230,000 times covers a correction seen 627
// times. Lifting a sheet shows what lies under it.
//
// The compositing engine is the workspace medium's sheet engine (lib/medium/sheets.mjs), copied here
// unchanged so the extension ships with no dependency. It has no single law: each sheet carries its own
// (multiply, density_add, weber, screen), and where sheets meet each applies its own on its side. Every
// sheet here is a post seen through the ones above it, so every sheet uses the same law, weber
// (Albers XX-1, a = 29.75). tests/discourse.sheets.test.js holds the constants and, when
// SUPERFRAME_SHEETS points at the original module, checks the two give the same colours.

export const DENSITY_W = 0.243;
export const WEBER = 29.75;
export const hexLin = (h) => { const n = parseInt(h.slice(1), 16); return [16, 8, 0].map((s) => { const c = ((n >> s) & 255) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); };
const perceived = (D, unit) => (unit > 1e-6 ? unit * Math.log1p(WEBER * D / unit) / Math.log1p(WEBER) : D);

// one pixel: paper (linear rgb) under the sheets in print order (copied from the medium's composite)
export function composite(paper, sheets) {
  const c = paper.slice(), D = [0, 0, 0], U = [0, 0, 0];
  let inked = 0, anyWeber = false;
  for (const s of sheets) {
    const law = s.law ?? "multiply", cov = s.cover ?? 1;
    if (cov <= 0) continue;
    for (let k = 0; k < 3; k++) {
      const t = 1 - cov * (1 - s.ink[k]);
      if (law === "multiply") c[k] *= t;
      else if (law === "density_add") c[k] *= inked > 0 ? Math.pow(Math.max(1e-4, t), 1 - (1 - DENSITY_W) * inked) : t;
      else if (law === "screen") c[k] = 1 - (1 - c[k]) * (1 - cov * s.ink[k]);
      else { const d = -Math.log(Math.max(1e-4, t)); D[k] += d; if (d > U[k]) U[k] = d; anyWeber = true; }
    }
    if (law === "density_add") inked = Math.min(1, inked + cov);
  }
  if (anyWeber) for (let k = 0; k < 3; k++) c[k] *= Math.exp(-perceived(D[k], U[k]));
  return c;
}

// The medium's printSheets: a paper colour and sheets, each sheet's own law or the default.
export function printSheets(paper, sheets, { law = "weber" } = {}) {
  const P = typeof paper === "string" ? hexLin(paper) : paper;
  return composite(P, sheets.map((s) => ({ ...s, law: s.law ?? law })));
}
const toHex = (lin) => "#" + lin.map((c) => Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055))).map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");

// The canon's ground and verdict inks. The verdict is about sourcing only, the same for every sheet:
// a post that links a primary record or a reference work prints in verified, one that does not in
// drift, whatever it says and whoever wrote it. A primary document is the ground.
export const PAPER = "#ebe5d8";
export const INKS = { sourced: "#0a6b61", unsourced: "#8f3a19", document: "#16130f" };

// thread: { claim: { text, reach }, corrections: [{ text, reach, origin }], documents: [{ title, url }] }
// reach is the views the site showed (null when it showed none). Corrections that share an origin are
// one sheet: many replies from one source are a metamer of independence, not several witnesses.
export function buildSheets(thread) {
  const claim = thread.claim || {}, top = Math.max(1, Number(claim.reach) || 0, ...(thread.corrections || []).map((c) => Number(c.reach) || 0));
  const byOrigin = new Map();
  for (const c of thread.corrections || []) {
    const k = c.origin || `reply:${byOrigin.size}`, g = byOrigin.get(k);
    if (g) { g.replies += 1; g.reach += Number(c.reach) || 0; } else byOrigin.set(k, { kind: "correction", text: c.text, origin: c.origin || null, sourced: !!c.origin, replies: 1, reach: Number(c.reach) || 0 });
  }
  const sheets = [
    { kind: "claim", text: claim.text || "", origin: claim.origin || null, sourced: !!claim.origin, replies: 1, reach: Number(claim.reach) || 0 },
    ...byOrigin.values(),
    ...(thread.documents || []).map((d) => ({ kind: "document", text: d.title, origin: d.url || null, replies: 0, reach: null })),
  ].map((s) => ({ ...s, cover: s.reach == null ? 0 : s.reach / top, ink: s.kind === "document" ? INKS.document : s.sourced ? INKS.sourced : INKS.unsourced }));
  // A document has no reach readout, so it prints no ink: it is the ground the sheets lie on, named.
  // What each sheet looks like with everything above it lifted: it over the sheets beneath it, printed
  // from the ground up (documents first, the claim last).
  return sheets.map((s, i) => {
    const under = sheets.slice(i).reverse().map((x) => ({ ink: hexLin(x.ink), cover: x.cover }));
    return { ...s, seen: toHex(printSheets(PAPER, under)), share: s.reach == null ? null : Math.round(s.cover * 10000) / 100 };
  });
}

// How many independent origins the corrections rest on, against how many replies carry them.
export function independence(sheets) {
  const c = sheets.filter((s) => s.kind === "correction");
  return { replies: c.reduce((a, s) => a + s.replies, 0), origins: c.length };
}
