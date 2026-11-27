// SPDX-FileCopyrightText: 2026 Zain Dana Harper and the CMMNS contributors
// SPDX-License-Identifier: AGPL-3.0-only
//
// Deterministic verification tests for Batch 5 graduated pure-OSI MIT BuildLang kernels
// under kernels/: N32 (gather_refit_graph), A15 (neglected_research_ranker),
// C13 (systems_empathy_transfer), and E24 (federated_bm25_graph).
//
// Kept disjoint from tests/buildlang-kernels.test.js for conflict-free parallel graduation.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const KERNELS_DIR = join(ROOT, "kernels");

const BATCH5_KERNELS = [
  { id: "N32", formula: "SIG-108", file: "gather_refit_graph.bld" },
  { id: "A15", formula: "SIG-109", file: "neglected_research_ranker.bld" },
  { id: "C13", formula: "SIG-111", file: "systems_empathy_transfer.bld" },
  { id: "E24", formula: "SIG-093", file: "federated_bm25_graph.bld" },
];

function hasBuildc() {
  try {
    execFileSync("buildc", ["--version"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

// ---------------- Reference Oracles ----------------

function oracleN32Dag() {
  const validate = (n, kinds, edges) => {
    const indeg = new Array(n).fill(0);
    for (const [, v] of edges) indeg[v]++;
    for (let i = 0; i < n; i++) if (kinds[i] !== 0 && indeg[i] === 0) return -101;
    const q = [];
    for (let i = 0; i < n; i++) if (indeg[i] === 0) q.push(i);
    let visited = 0;
    for (let head = 0; head < q.length; head++) {
      const u = q[head];
      visited++;
      for (const [eu, ev] of edges) {
        if (eu === u && --indeg[ev] === 0) q.push(ev);
      }
    }
    return visited === n ? 0 : -102;
  };
  const cleanEdges = [[0, 1], [1, 2], [2, 3]];
  return {
    clean_rc: validate(4, [0, 1, 2, 3], cleanEdges),
    orphan_rc: validate(5, [0, 1, 2, 3, 3], cleanEdges),
    cycle_rc: validate(4, [0, 1, 2, 3], [...cleanEdges, [3, 1]]),
  };
}

function oracleA15() {
  const rows = [
    [1, 58, 8.5, 0.95, 0.85],
    [2, 52, 6.0, 0.80, 0.75],
    [3, 45, 9.2, 0.92, 0.88],
    [4, 31, 12.0, 0.96, 0.90],
    [5, 47, 11.5, 0.90, 0.92],
    [6, 22, 5.5, 0.85, 0.80],
    [7, 55, 7.8, 0.88, 0.82],
    [8, 38, 14.0, 0.94, 0.91],
    [9, 14, 4.0, 0.20, 0.30],
    [10, 61, 10.5, 0.97, 0.93],
    [11, 35, 6.8, 0.84, 0.78],
    [12, 49, 7.2, 0.86, 0.81],
  ];
  const scored = rows.map(([id, age, lev, f, e]) => ({ id, score: Math.log(1 + age) * lev * f * e }));
  scored.sort((a, b) => b.score - a.score);
  return {
    top5: scored.slice(0, 5).map((x) => x.id),
    sum: scored.slice(0, 5).reduce((s, x) => s + x.score, 0),
    unfalsifiable_rc: -201,
  };
}

function oracleC13() {
  const clampState = (v) => (v < -0.5 ? 0 : v < 0 ? 1 : v < 0.5 ? 2 : 3);
  const detNoise = (t, seed) => {
    const a = t * 1.61803398875 + seed;
    const b = t * 2.71828182846 + 1.7 * seed;
    return 0.6 * Math.sin(a) + 0.4 * Math.cos(b);
  };
  const sim = (fbGain) => {
    const steps = 800;
    const joint = new Array(16).fill(0);
    let est = 0;
    let errSq = 0;
    for (let t = 0; t < steps; t++) {
      const sSender = 0.85 * Math.sin(0.17 * t) + 0.12 * detNoise(t, 0.31);
      const sSelf = 0.85 * Math.sin(0.17 * 1.35 * t);
      const obs = sSender + 0.22 * detNoise(t, 1.97);
      est = (1 - fbGain) * sSelf + fbGain * (0.65 * obs + 0.35 * est);
      errSq += (est - sSender) ** 2;
      joint[clampState(sSender) * 4 + clampState(est)]++;
    }
    const px = new Array(4).fill(0);
    const py = new Array(4).fill(0);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const p = joint[r * 4 + c] / steps;
        px[r] += p;
        py[c] += p;
      }
    }
    let mi = 0;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const pxy = joint[r * 4 + c] / steps;
        if (pxy > 1e-12 && px[r] * py[c] > 1e-12) mi += pxy * Math.log2(pxy / (px[r] * py[c]));
      }
    }
    const rmse = Math.sqrt(errSq / steps);
    return { mi, rmse, rc: mi < 0.6 || rmse > 0.45 ? -401 : 0 };
  };
  const coupled = sim(0.9);
  const proj = sim(0.0);
  return { coupled, proj, rmseGain: proj.rmse / coupled.rmse };
}

function oracleE24Controls() {
  const validateQuery = (qLen) => (qLen === 0 ? -601 : 0);
  const validateIdf = (idf, df, nDocs) => (idf < 0 || df <= 0 || df > nDocs ? -602 : 0);
  return {
    rc_eq: validateQuery(0),
    rc_ni: validateIdf(-0.42, 100, 68500),
    expected_top10: "41937,7377,17279,61088,13276,7137,741,41861,45098,54729",
  };
}

// ---------------- Tests ----------------

test("all 4 Batch 5 MIT BuildLang kernels satisfy source hygiene, SPDX, and REUSE invariants", () => {
  const doc = readFileSync(join(KERNELS_DIR, "BATCH5.md"), "utf8");
  assert.match(doc, /SPDX-License-Identifier:\s*MIT/);
  assert.doesNotMatch(doc, /[\u2013\u2014]/);
  assert.doesNotMatch(doc, /[A-Za-z]:\\|\/Users\/|\/home\//);

  for (const k of BATCH5_KERNELS) {
    const src = readFileSync(join(KERNELS_DIR, k.file), "utf8");
    assert.match(src, /SPDX-License-Identifier:\s*MIT/, `${k.file} must carry MIT SPDX header`);
    assert.doesNotMatch(src, /\.as_bytes\s*\(/, `${k.file} must not call String::as_bytes()`);
    assert.doesNotMatch(src, /[\u2013\u2014]/, `${k.file} must not contain em/en dashes`);
    assert.doesNotMatch(src, /[A-Za-z]:\\|\/Users\/|\/home\//, `${k.file} must not contain local paths`);
    assert.match(doc, new RegExp(k.file.replace(".", "\\.")), `BATCH5.md must document ${k.file}`);
    for (const [idx, line] of src.split(/\r?\n/).entries()) {
      assert.ok(line.length <= 120, `${k.file}:${idx + 1} exceeds 120 chars (${line.length})`);
    }
  }
});

test("N32 gather_refit_graph, A15 neglected_research_ranker, C13 empathy, and E24 BM25 reference oracles pass", () => {
  const n32 = oracleN32Dag();
  assert.deepEqual(n32, { clean_rc: 0, orphan_rc: -101, cycle_rc: -102 });

  const a15 = oracleA15();
  assert.deepEqual(a15.top5, [8, 10, 5, 4, 3]);
  assert.ok(Math.abs(a15.sum - 184.277044) < 1e-4);
  assert.equal(a15.unfalsifiable_rc, -201);

  const c13 = oracleC13();
  assert.equal(c13.coupled.rc, 0);
  assert.equal(c13.proj.rc, -401);
  assert.ok(Math.abs(c13.coupled.mi - 1.234834) < 1e-4);
  assert.ok(c13.rmseGain > 5.8 && c13.rmseGain < 5.83);

  const e24 = oracleE24Controls();
  assert.equal(e24.rc_eq, -601);
  assert.equal(e24.rc_ni, -602);
});

test("live buildc check, lint, and superopt execution match reference oracles for all 4 Batch 5 kernels", (t) => {
  const required = process.env.CMMNS_REQUIRE_BUILDC === "1";
  if (!hasBuildc()) {
    if (required) assert.fail("CMMNS_REQUIRE_BUILDC=1 set but buildc is not on PATH");
    t.skip("buildc not installed in this CI environment; JS reference oracles verified above");
    return;
  }

  for (const k of BATCH5_KERNELS) {
    const file = join(KERNELS_DIR, k.file);
    execFileSync("buildc", ["check", file], { stdio: "pipe" });
    const lintOut = execFileSync("buildc", ["lint", file], { encoding: "utf8" });
    assert.match(lintOut, /No issues found/, `${k.file} lint reported warnings: ${lintOut}`);
    const runOut = execFileSync("buildc", ["run", "--release", "--superopt", file], { encoding: "utf8" });
    assert.doesNotMatch(runOut, /\[FAIL\]|\[ERR\]/, `${k.file} reported failure:\n${runOut}`);

    if (k.id === "N32") {
      assert.match(runOut, /\[PASS\] N32_GATHER_REFIT_GRAPH h0=93adb5d6 h7=9db637d2 orphan_caught=1 cycle_caught=1/);
    } else if (k.id === "A15") {
      assert.match(runOut, /\[PASS\] A15_NEGLECTED_RANKER top5=8_10_5_4_3 sum=184\.277044 planted=1/);
    } else if (k.id === "C13") {
      assert.match(runOut, /\[PASS\] C13_SYSTEMS_EMPATHY mi=1\.2348 proj_mi=0\.0007 rmse_gain=5\.81x planted=1/);
    } else if (k.id === "E24") {
      const e24 = oracleE24Controls();
      assert.match(runOut, new RegExp(`FEDERATED_BM25 status=PASS fail=0 docs=68500 .* top10=${e24.expected_top10} rc_eq=-601 rc_ni=-602`));
    }
  }
});
