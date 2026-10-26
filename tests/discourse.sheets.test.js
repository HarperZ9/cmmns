// Truth as sheets (src/core/discourse/sheets.js) and the parts tree (parts.js), on the worked example
// of 2026-10-26: a claim seen 230,300 times over a correction seen 627 times over the ODNI report.
import test from "node:test";
import assert from "node:assert/strict";
import { printSheets, buildSheets, independence, DENSITY_W, WEBER, hexLin, PAPER } from "../src/core/discourse/sheets.js";
import { discourseParts } from "../src/core/discourse/parts.js";

const THREAD = {
  claim: { text: "A named person hired a hitman to kill a journalist", reach: 230300 },
  corrections: [{ text: "The claim is false; here is what is established", reach: 627, origin: null }],
  documents: [{ title: "ODNI, Assessing the Saudi Government's Role in the Killing of Jamal Khashoggi (2021)", url: "https://www.dni.gov/" }],
};

test("the shared engine's constants are the medium's: density weight 0.243, Weber a = 29.75", () => {
  assert.equal(DENSITY_W, 0.243);
  assert.equal(WEBER, 29.75);
  const one = printSheets(PAPER, [{ ink: hexLin("#0a6b61"), cover: 1 }]);
  // one sheet at full cover prints exactly as its ink on the paper: Weber leaves a single sheet alone
  hexLin("#0a6b61").forEach((v, k) => assert.ok(Math.abs(one[k] - v * hexLin(PAPER)[k]) < 1e-6));
  const two = printSheets(PAPER, [{ ink: hexLin("#0a6b61"), cover: 1 }, { ink: hexLin("#0a6b61"), cover: 1 }]);
  two.forEach((v, k) => assert.ok(v < one[k] && v > one[k] * hexLin("#0a6b61")[k], "a second sheet darkens less than multiply"));
});

test("reach is coverage: the claim covers the correction, which covers under 0.3% of its sheet", () => {
  const s = buildSheets(THREAD);
  assert.deepEqual(s.map((x) => x.kind), ["claim", "correction", "document"]);
  assert.equal(s[0].cover, 1);
  assert.ok(s[1].cover < 0.003 && s[1].cover > 0.002);
  assert.equal(s[1].share, 0.27);
  assert.equal(s[2].cover, 0, "a document has no reach readout and prints no ink: it is the ground");
  assert.notEqual(s[0].seen, s[1].seen, "lifting the claim changes what is seen");
});

test("corrections from one origin are one sheet: many replies, one witness", () => {
  const t = { ...THREAD, corrections: [{ text: "a", reach: 10, origin: "dni.gov" }, { text: "b", reach: 20, origin: "dni.gov" }, { text: "c", reach: 5, origin: "un.org" }] };
  const s = buildSheets(t);
  assert.deepEqual(independence(s), { replies: 3, origins: 2 });
  assert.equal(s.find((x) => x.origin === "dni.gov").reach, 30);
});

test("the same rule for every sheet: swapping which side a sheet's words take changes nothing but the words", () => {
  const a = buildSheets(THREAD), b = buildSheets({ ...THREAD, claim: { ...THREAD.claim, text: "The opposite claim" } });
  assert.deepEqual(a.map((x) => [x.cover, x.seen]), b.map((x) => [x.cover, x.seen]));
});

test("when the medium's own module is at hand, both give the same colours", async (t) => {
  const path = process.env.SUPERFRAME_SHEETS;
  if (!path) return t.skip("SUPERFRAME_SHEETS not set");
  const ref = await import(new URL(`file:///${path.replace(/\\/g, "/")}`).href);
  for (const law of ["multiply", "density_add", "weber", "screen"]) {
    const sheets = [{ ink: hexLin("#8f3a19"), cover: 0.6, law }, { ink: hexLin("#0a6b61"), cover: 0.3, law }];
    assert.deepEqual(printSheets(PAPER, sheets).map((v) => v.toFixed(9)), ref.composite(hexLin(PAPER), sheets).map((v) => v.toFixed(9)), law);
  }
});

test("the results are a parts tree in the study format, every property labelled with its method", () => {
  const p = discourseParts({ site: "x", postUrl: "https://x.com/a/status/1", handle: "a" }, {
    counts: [{ text: "45/50", k: 45, n: 50, interval: [0.786, 0.957], small: false }],
    corrections: [{ author: "b", source: null, score: 1.8, shared: ["kushner", "khashoggi"] }], independence: { replies: 1, origins: 1 },
    doc: { images: 4, read: 4, found: [], absent: [{ term: "classified information", kind: "phrase", images: [] }] },
  });
  assert.equal(p.format, "refdb.parts/1");
  const props = p.concepts[0].layers.flatMap((l) => l.parts.flatMap((x) => x.properties));
  assert.ok(props.length >= 6 && props.every((x) => ["observed", "measured", "inferred"].includes(x.label) && x.method));
  assert.deepEqual(p.concepts[0].layers.map((l) => l.name), ["document pages", "counts", "correction replies"]);
});
