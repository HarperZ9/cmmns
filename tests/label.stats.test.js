// Synthetic controls for the labelling kit's statistics (scripts/label/stats.mjs). No real labels.
import test from "node:test";
import assert from "node:assert/strict";
import { kappaOf, kappaInterval, strataRates, rng, MIN_STRATUM } from "../scripts/label/stats.mjs";

const strata = (over = {}) => ({ platform: "x", audience: "10k-100k", topic: "tech", language: "en", region: "US", ...over });

test("perfect agreement gives kappa 1", () => {
  const pairs = [["organic", "organic"], ["paid-disclosed", "paid-disclosed"], ["unsure", "unsure"], ["organic", "organic"]];
  assert.equal(kappaOf(pairs).kappa, 1);
});

test("the textbook example: 50 cases, 20 yes-yes, 5 yes-no, 10 no-yes, 15 no-no, gives kappa 0.4", () => {
  const pairs = [
    ...Array(20).fill(["organic", "organic"]), ...Array(5).fill(["organic", "unsure"]),
    ...Array(10).fill(["unsure", "organic"]), ...Array(15).fill(["unsure", "unsure"]),
  ];
  const k = kappaInterval(pairs);
  assert.equal(k.po, 0.7);
  assert.equal(k.pe, 0.5);
  assert.ok(Math.abs(k.kappa - 0.4) < 1e-12);
  assert.ok(k.interval[0] < 0.4 && 0.4 < k.interval[1], "the bootstrap interval covers the estimate");
  assert.ok(k.approx[0] < 0.4 && 0.4 < k.approx[1]);
});

test("two labellers answering at random agree at chance: kappa near 0", () => {
  const next = rng(7), cats = ["paid-disclosed", "paid-undisclosed", "organic", "unsure"];
  const pick = () => cats[Math.floor(next() * cats.length)];
  const pairs = Array.from({ length: 4000 }, () => [pick(), pick()]);
  const k = kappaInterval(pairs, cats, 500);
  assert.ok(Math.abs(k.kappa) < 0.03, `kappa ${k.kappa}`);
  assert.ok(k.interval[0] < 0 && k.interval[1] > 0, "the interval covers 0");
});

test("the kappa interval is the same on every run", () => {
  const pairs = [["organic", "organic"], ["organic", "unsure"], ["unsure", "unsure"], ["paid-disclosed", "paid-disclosed"], ["organic", "organic"]];
  assert.deepEqual(kappaInterval(pairs).interval, kappaInterval(pairs).interval);
});

function organicCases(n, strong, s) {
  return Array.from({ length: n }, (_, i) => ({ strata: s, lens: i < strong ? "strong" : "none" }));
}

test("a stratum under 30 organic cases is not reported and says insufficient cases", () => {
  const rows = [...organicCases(40, 2, strata({ language: "en" })), ...organicCases(MIN_STRATUM - 1, 20, strata({ language: "ar" }))];
  const r = strataRates(rows, "language");
  const ar = r.rows.find((x) => x.value === "ar");
  assert.equal(ar.reported, false);
  assert.equal(ar.note, "insufficient cases");
  assert.equal(ar.rate, undefined, "no rate is shown for a thin stratum");
  assert.equal(r.bound, "not readable", "one reported stratum cannot be compared");
});

test("a gap over 5 points between reported strata breaks the bound, in either direction", () => {
  const rows = [...organicCases(40, 1, strata({ region: "US" })), ...organicCases(40, 5, strata({ region: "IN" }))];
  const r = strataRates(rows, "region");
  assert.equal(r.bound, "fails");
  assert.deepEqual(r.pair, ["IN", "US"]);
  assert.ok(r.gap > 0.05);
});

test("a gap of 5 points or less holds", () => {
  const rows = [...organicCases(40, 1, strata({ language: "en" })), ...organicCases(40, 2, strata({ language: "es" }))];
  assert.equal(strataRates(rows, "language").bound, "holds");
});
