// Signal detection measures (scripts/eval/sdt.mjs): the port reproduces the 2026-10-28 study values,
// it is deterministic, small samples read "not measured", and the committed results, measured.js and
// the generated EVALUATION.md block all agree with a fresh run.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { invNorm, point, sdtRows, sdtBlock, SDT_MIN_FLAGGED } from "../scripts/eval/sdt.mjs";
import { ENGLISH, catchFields } from "../scripts/eval/summarise.mjs";
import { spliceSdt, markdownTables } from "../scripts/eval/sdt-report.mjs";
import { MEASURED } from "../src/core/measured.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8").split("\r\n").join("\n");
const R = JSON.parse(read("project-docs/evidence/eval-results.json"));
const rows = sdtRows(R.corpora);
const find = (corpus, family, against) => rows.find((r) => r.corpus === corpus && r.family === family && r.against === against);

test("the inverse normal matches known quantiles", () => {
  assert.ok(Math.abs(invNorm(0.975) - 1.959964) < 1e-5);
  assert.ok(Math.abs(invNorm(0.5)) < 1e-12);
  assert.ok(Math.abs(invNorm(0.001) + 3.090232) < 1e-5);
  assert.ok(Math.abs(invNorm(0.9) + invNorm(0.1)) < 1e-12);
});

test("point estimates match the study (violence on its own label, slur on hostility)", () => {
  assert.deepEqual(point({ tp: 39, fp: 22, fn: 1780, tn: 17948 }), { hit: 0.0217, fa: 0.00125, dprime: 1, c: 2.52 });
  assert.deepEqual(point({ tp: 1086, fp: 53, fn: 11209, tn: 7441 }), { hit: 0.0884, fa: 0.00714, dprime: 1.1, c: 1.9 });
  assert.deepEqual(point({ tp: 2894, fp: 313, fn: 3288, tn: 3522 }), { hit: 0.4681, fa: 0.08173, dprime: 1.31, c: 0.74 });
});

test("bootstrap intervals over the committed results match the study", () => {
  const v = find("mhs", "violence", "specific");
  assert.deepEqual([v.dprime, v.dCI, v.c, v.cCI], [1, [0.82, 1.2], 2.52, [2.44, 2.63]]);
  const d = find("mhs", "dehumanise", "specific");
  assert.deepEqual([d.dprime, d.dCI, d.c, d.cCI], [0.44, [0.15, 0.75], 3.03, [2.93, 3.21]]);
  const k = find("civil", "conspiracy", "hostile");
  assert.deepEqual([k.dprime, k.dCI, k.measured], [-0.22, [-0.77, -0.01], true]);
  assert.equal(find("hatexplain", "slur", "hostile").dCI.join(), "1.25,1.38");
  assert.equal(rows.length, 52);
});

test("a rerun gives the same numbers", () => {
  assert.deepEqual(sdtRows(R.corpora), rows);
  assert.notDeepEqual(sdtRows(R.corpora, 1).map((r) => r.dCI), rows.map((r) => r.dCI));
});

test("small samples read not measured: French, and signs that never hit their own label", () => {
  for (const r of rows.filter((x) => x.corpus === "mlma-fr")) assert.equal(r.measured, false, r.family);
  assert.equal(find("civil", "violence", "specific").measured, false, "no hits, though the correction alone gives d' 0.92");
  for (const r of rows) assert.equal(r.measured, r.tp + r.fp >= SDT_MIN_FLAGGED && r.tp > 0, `${r.corpus} ${r.family}`);
});

test("the committed sdt block, measured.js and EVALUATION.md match a fresh run", () => {
  assert.deepEqual(R.sdt, sdtBlock(R.corpora, ENGLISH), "run node scripts/eval-sdt.mjs");
  const md = read("project-docs/EVALUATION.md");
  assert.equal(spliceSdt(md, R.sdt), md, "run node scripts/eval-sdt.mjs");
  for (const f of Object.keys(MEASURED)) assert.deepEqual(MEASURED[f].catch, catchFields(f, R.sdt).catch, f);
});

test("the window uses the matched label where Measuring Hate Speech has one, else pooled hostility", () => {
  assert.deepEqual(MEASURED.violence.catch, { against: "matched", hits: 39, of: 1819, dprime: 1, c: 2.52 });
  assert.equal(MEASURED.dehumanise.catch.against, "matched");
  assert.equal(MEASURED.stereotype.catch.against, "matched");
  assert.equal(MEASURED.slur.catch.against, "hostile");
  assert.equal(MEASURED.slur.catch.of, ENGLISH.reduce((s, c) => s + R.corpora[c].families.slur.againstHostile.tp + R.corpora[c].families.slur.againstHostile.fn, 0));
});

test("the tables mark rows scored against general hostility and carry no em dashes", () => {
  const md = markdownTables(R.sdt);
  assert.match(md, /#### Conspiracy framing\n/);
  assert.match(md, /\| Measuring Hate Speech \| its own label \(violence\) \| 64% \(39 of 61\) \| 2\.1% \(39 of 1,819\) \|/);
  assert.match(md, /\| Civil Comments \| its own label \(threat\) \|[^\n]*not measured \(fired 9 times\)/);
  assert.match(md, /\| MLMA \(French\) \| general hostility \| never fired \|/);
  assert.doesNotMatch(md, /—/);
});
