// SPDX-FileCopyrightText: 2026 Zain Dana Harper and the CMMNS contributors
// SPDX-License-Identifier: AGPL-3.0-only
//
// Deterministic verification tests for all 19 Batches 6..10 pure-OSI MIT BuildLang
// verification kernels under kernels/ (expanding HarperZ9/cmmns from 21 to 40 MIT kernels).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const KERNELS_DIR = join(ROOT, "kernels");

const BATCHES_6_TO_10 = [
  {
    file: "honest_exit_valve.bld",
    expect: /HONEST_EXIT_VALVE status=PASS failures=0 .* hack_a=0\.986667 hack_b=0\.000000 hack_c=0\.000000 cost_a=1611 cost_c=1311 reseats_c=300 planted_hack=0\.986667 planted_caught=true/,
  },
  {
    file: "typed_second_channel.bld",
    expect: /SECOND_CHANNEL status=PASS failures=0 .* valid_envelopes=4\/4 rc_empty=-401 rc_circ=-402 rc_copy=-403 rc_ts=-404/,
  },
  {
    file: "three_control_negatives.bld",
    expect: /THREE_CONTROL_NEGATIVES status=PASS failures=0 .* r_sig=0\.999279472 p_sig=0\.004975 r_null=0\.160188048 p_null=0\.109453 rc_valid=0 rc_no_fp=-201 rc_no_ff=-202 rc_bad_p=-203/,
  },
  {
    file: "anti_self_audit_chain.bld",
    expect: /ANTI_SELF_AUDIT status=PASS failures=0 .* entries=16 head=8b259143411dd2bfcb7209bfa65ec1d20139e1d9d8e23f4b3ff3179ce086ada7 rc_self=-301 rc_forged=-302 rc_tamper=-302/,
  },
  {
    file: "isomorphism_entropy.bld",
    expect: /ISOMORPHISM_ENTROPY status=PASS failures=0 .* bij_hcond=0\.000000000000 bij_imr=8\.000000000000 bij_rt=256\/256 trunc_hcond=4\.000000000000 coll_hcond=0\.007812500000 rc_bij=0 rc_trunc=-401 rc_coll=-401/,
  },
  {
    file: "confidence_word_calib.bld",
    expect: /CONFIDENCE_CALIB status=PASS failures=0 .* bands=3,2,1,0 rc_over=-401 rc_noctrl=-402 rc_inv=-403/,
  },
  {
    file: "uncheatable_search_forge.bld",
    expect: /SEARCH_FORGE status=PASS failures=0 .* mean_ground=1\.000000 sha0=957727419e50c53a1fac0cfabf6d3cceb2c45bb19a95092aff081197dfcb601b rc_hall=-101 rc_off=-102 rc_sha=-103/,
  },
  {
    file: "truth_econ.bld",
    expect: /G7_UNCHECKED_TRUTH_SHARE=0\.000000000386[\s\S]*G7_VERIFIED_TRUTH_SHARE=0\.999998981342[\s\S]*G7_PLANTED_CAUGHT=1[\s\S]*\[PASS\] G7_TRUTH_ECON/,
  },
  {
    file: "personal_voice_twin.bld",
    expect: /VOICE_TWIN status=PASS failures=0 .* base_cv=0\.495599712 d_match=0\.010545881 d_slop=1\.168597753 rc_match=0 rc_slop=-201 rc_impers=-202 rc_noconsent=-202/,
  },
  {
    file: "universal_articulate_pipe.bld",
    expect: /ARTICULATE_PIPE status=PASS failures=0 .* clean_pass=4\/4 rc_noprof=-301 rc_slop=-303 rc_dash=-302 rc_bemail=-303/,
  },
  {
    file: "concept_phase_states.bld",
    expect: /D11_ORD_PSI=0\.680441033448[\s\S]*D11_HYST_LOOP_K=17\.0000[\s\S]*D11_TRAPS_CAUGHT=1[\s\S]*\[PASS\] D11_PHASE_STATES/,
  },
  {
    file: "cross_layer_overlap.bld",
    expect: /A9_BEST_DX=5[\s\S]*A9_BEST_DY=3[\s\S]*A9_PEAK_NCC=0\.998613466215[\s\S]*A9_FLAT_CAUGHT=1[\s\S]*\[PASS\] A9_CROSS_LAYER/,
  },
  {
    file: "cmmns_evidence_quorum.bld",
    expect: /EVIDENCE_QUORUM status=PASS failures=0 .* f1_agree=3\/3 f2_agree=5\/5 pin_f1=834a66c94b8b1a7d87a3a199cb5bc8f8af6759c35c1df67ceef6f84b9aec7f0c rc_min=-501 rc_syb=-502 rc_forg=-503 rc_small=-503/,
  },
  {
    file: "cmmns_citation_decay.bld",
    expect: /CITATION_DECAY status=PASS failures=0 .* s_spof=0\.135335283 s_quad=0\.996396682 loss_cut_x=239\.96 rc_quad=0 rc_spof=-601 rc_inv=-602 rc_corr=-603/,
  },
  {
    file: "first_principles_dag.bld",
    expect: /I1_VISITED=20[\s\S]*I1_MAX_DEPTH=4[\s\S]*I1_DEPTH_SUM=40[\s\S]*I1_TRAPS_CAUGHT=1[\s\S]*\[PASS\] I1_FIRST_PRINCIPLES_DAG/,
  },
  {
    file: "potential_space_transmute.bld",
    expect: /A8C12_REVERIE_TELEM=0[\s\S]*A8C12_PEAK_ORDER=0\.952380952381[\s\S]*A8C12_TRAPS_CAUGHT=1[\s\S]*\[PASS\] A8C12_POTENTIAL_TRANSMUTE/,
  },
  {
    file: "cmmns_source_corroboration.bld",
    expect: /SOURCE_CORROBORATION status=PASS failures=0 .* roots=4 post=0\.996135727 rc_clean=0 rc_cyc=-701 rc_echo=-702 rc_inv=-703/,
  },
  {
    file: "cmmns_archive_merkle_diff.bld",
    expect: /ARCHIVE_MERKLE_DIFF status=PASS failures=0 .* added=2 old_root=7f958ac6f5bcfc397921c7cfff74db40d460f8027173c26b58af0dc061c78267 new_root=ddfa718a3a26920b4fcaba0334d98705a1b329b0ed9e8cada30510dfa5b7b478 rc_edit=-801 rc_del=-802 rc_forg=-803/,
  },
  {
    file: "cmmns_attention_valve.bld",
    expect: /ATTENTION_VALVE status=PASS failures=0 .* rem_active=10 ramp_active=1 dark_score=9 rc_active=0 rc_ramp=0 rc_dark=-901 rc_supp=-902 rc_inv=-903/,
  },
];

function hasBuildc() {
  try {
    execFileSync("buildc", ["--version"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function u32Be(vals) {
  const buf = Buffer.alloc(vals.length * 4);
  vals.forEach((v, i) => buf.writeUInt32BE(v >>> 0, i * 4));
  return buf;
}

test("all 19 Batches 6..10 MIT kernels expand kernels/ to 40 unique files with strict hygiene", () => {
  const allBld = readdirSync(KERNELS_DIR).filter((f) => f.endsWith(".bld"));
  assert.equal(allBld.length, 40, `Expected 40 total MIT kernels, found ${allBld.length}`);

  const doc = readFileSync(join(KERNELS_DIR, "BATCHES_6_TO_10.md"), "utf8");
  assert.match(doc, /SPDX-License-Identifier:\s*MIT/);
  assert.doesNotMatch(doc, /[\u2013\u2014]/);
  assert.doesNotMatch(doc, /[A-Za-z]:\\|\/Users\/|\/home\//);

  for (const k of BATCHES_6_TO_10) {
    const src = readFileSync(join(KERNELS_DIR, k.file), "utf8");
    assert.match(src, /SPDX-License-Identifier:\s*MIT/, `${k.file} must carry MIT SPDX header`);
    assert.doesNotMatch(src, /\.as_bytes\s*\(/, `${k.file} must not call String::as_bytes()`);
    assert.doesNotMatch(src, /[\u2013\u2014]/, `${k.file} must not contain em/en dashes`);
    assert.doesNotMatch(src, /[A-Za-z]:\\|\/Users\/|\/home\//, `${k.file} must not contain local paths`);
    assert.match(doc, new RegExp(k.file.replace(".", "\\.")), `BATCHES_6_TO_10.md must document ${k.file}`);
    for (const [idx, line] of src.split(/\r?\n/).entries()) {
      assert.ok(line.length <= 120, `${k.file}:${idx + 1} exceeds 120 chars (${line.length})`);
    }
  }
});

test("deterministic cryptographic and statistical Node reference oracles match Batches 6..10", () => {
  // SIG-156 BFT 3f+1 FIPS 180-4 SHA-256 quorum pin
  const attest = (c, p, v) => createHash("sha256").update(u32Be([c, p, v])).digest().readUInt32BE(0);
  const pinWords = [9501, 3735928559];
  for (const vid of [101, 102, 103]) pinWords.push(vid, attest(9501, 3735928559, vid));
  assert.equal(
    createHash("sha256").update(u32Be(pinWords)).digest("hex"),
    "834a66c94b8b1a7d87a3a199cb5bc8f8af6759c35c1df67ceef6f84b9aec7f0c",
  );

  // SIG-157 RFC 6962 append-only archive snapshot diff roots
  const snapRoot = (recs) => {
    let cur = Buffer.alloc(32, 0);
    for (let i = 0; i < recs.length; i++) {
      const leaf = createHash("sha256").update(Buffer.concat([Buffer.from([0x00]), u32Be([i, recs[i]])])).digest();
      cur = createHash("sha256").update(Buffer.concat([Buffer.from([0x01]), cur, leaf])).digest();
    }
    return cur.toString("hex");
  };
  assert.equal(snapRoot([1001, 1002, 1003, 1004]), "7f958ac6f5bcfc397921c7cfff74db40d460f8027173c26b58af0dc061c78267");
  assert.equal(snapRoot([1001, 1002, 1003, 1004, 1005, 1006]), "ddfa718a3a26920b4fcaba0334d98705a1b329b0ed9e8cada30510dfa5b7b478");

  // STA-073 4-mirror archival survival vs single-origin SPOF
  const sSpof = Math.exp(-0.20 * 10);
  const fQuad = [0.20, 0.04, 0.03, 0.005].reduce((acc, lam) => acc * (1 - Math.exp(-lam * 10)), 1);
  assert.ok(Math.abs(sSpof - 0.135335283) < 1e-6);
  assert.ok(Math.abs(1 - fQuad - 0.996396682) < 1e-6);
  assert.ok(Math.abs((1 - sSpof) / fQuad - 239.96) < 0.05);

  // STA-074 4-root Bayesian corroboration posterior
  const post = 1 / (1 + Math.exp(-(Math.log(0.20 / 0.80) + 4 * Math.log(0.85 / 0.15))));
  assert.ok(Math.abs(post - 0.996135727) < 1e-6);

  // N43 SHA-256 slice digest
  const s0 = "Symplectic Velocity-Verlet";
  assert.equal(
    createHash("sha256").update(s0, "ascii").digest("hex"),
    "957727419e50c53a1fac0cfabf6d3cceb2c45bb19a95092aff081197dfcb601b",
  );
});

test("live buildc check, lint, and superopt execution pass all 19 Batches 6..10 MIT kernels", (t) => {
  const required = process.env.CMMNS_REQUIRE_BUILDC === "1";
  if (!hasBuildc()) {
    if (required) assert.fail("CMMNS_REQUIRE_BUILDC=1 set but buildc is not on PATH");
    t.skip("buildc not installed in this CI environment; JS reference oracles verified above");
    return;
  }

  for (const k of BATCHES_6_TO_10) {
    const file = join(KERNELS_DIR, k.file);
    execFileSync("buildc", ["check", file], { stdio: "pipe" });
    const lintOut = execFileSync("buildc", ["lint", file], { encoding: "utf8" });
    assert.match(lintOut, /No issues found/, `${k.file} lint reported warnings: ${lintOut}`);
    const runOut = execFileSync("buildc", ["run", "--release", "--superopt", file], { encoding: "utf8" });
    assert.doesNotMatch(runOut, /\[FAIL\]|\[ERR\]|status=FAIL/, `${k.file} reported failure:\n${runOut}`);
    assert.match(runOut, k.expect, `${k.file} output did not match verified oracle:\n${runOut}`);
  }
});
