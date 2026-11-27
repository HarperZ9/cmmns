// SPDX-FileCopyrightText: 2026 Zain Dana Harper and the CMMNS contributors
// SPDX-License-Identifier: AGPL-3.0-only
//
// Deterministic verification tests for the 5 graduated pure-OSI MIT BuildLang kernels
// under kernels/: I2 (commons_pipe_mirror), N70 (boring_bridge_verifier),
// I7 (accessible_surface_gate), I14 (reach_gradient), and I9 (merit_ledger).
//
// Runs on every CI platform via Node reference oracles and source invariant checks,
// and executes live buildc check/lint/run --release --superopt whenever buildc is on PATH
// (or strictly when CMMNS_REQUIRE_BUILDC=1).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const KERNELS_DIR = join(ROOT, "kernels");

const KERNELS = [
  { id: "I2", formula: "SIG-119", file: "commons_pipe_mirror.bld" },
  { id: "N70", formula: "SIG-100", file: "boring_bridge_verifier.bld" },
  { id: "I7", formula: "SIG-120", file: "accessible_surface_gate.bld" },
  { id: "I14", formula: "SIG-092", file: "reach_gradient.bld" },
  { id: "I9", formula: "SIG-091", file: "merit_ledger.bld" },
];

function sha256(buf) {
  return createHash("sha256").update(buf).digest();
}

function wordAt(buf, off) {
  return buf.readUInt32BE(off);
}

function hasBuildc() {
  try {
    execFileSync("buildc", ["--version"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function parseMetrics(stdout, tag) {
  const prefix = `[METRICS] ${tag} `;
  const out = {};
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.startsWith(prefix)) continue;
    for (const tok of line.slice(prefix.length).trim().split(/\s+/)) {
      const idx = tok.indexOf("=");
      if (idx > 0) out[tok.slice(0, idx)] = tok.slice(idx + 1);
    }
  }
  return out;
}

// ---------------- Reference Oracles ----------------

function oracleI2() {
  const chunk = Buffer.alloc(128);
  for (let i = 0; i < 128; i++) chunk[i] = (i * 41 + 73) & 0xff;
  const expected = sha256(chunk);
  const bad1 = Buffer.from(chunk);
  bad1[63] ^= 1;
  const bad2 = Buffer.from(chunk);
  bad2[12] ^= 1;
  const hasGate = (h) => /x-paywall|402 payment|authorization:|subscribe-wall|login-required/i.test(h);
  const audit = (buf, hdr) => (!hasGate(hdr) && sha256(buf).equals(expected) ? 1 : 0);
  const cleanHdr = "HTTP/1.1 200 OK; Content-Type: application/json; Access-Control-Allow-Origin: *";
  const paywallHdr = "HTTP/1.1 402 Payment Required; X-Paywall: tier-pro; Subscribe-Wall: hard";
  const authHdr = "HTTP/1.1 401; Authorization: Bearer required; Login-Required: true";
  return {
    chunk_w0: wordAt(expected, 0),
    chunk_w7: wordAt(expected, 28),
    q_clean: audit(chunk, cleanHdr) * 4,
    q_bft: audit(chunk, cleanHdr) * 3 + audit(bad1, cleanHdr),
    q_corrupt: audit(chunk, cleanHdr) * 2 + audit(bad1, cleanHdr) + audit(bad2, cleanHdr),
    q_paywall: audit(chunk, paywallHdr) + audit(chunk, cleanHdr) * 2 + audit(chunk, authHdr),
  };
}

function oracleN70() {
  const abc = sha256(Buffer.from("abc"));
  const makePayload = (id) => {
    const b = Buffer.alloc(64);
    for (let i = 0; i < 64; i++) b[i] = (id * 53 + i * 29 + 17) & 0xff;
    return b;
  };
  const hLeaf = (p) => sha256(Buffer.concat([Buffer.from([0x00]), p]));
  const hNode = (l, r) => sha256(Buffer.concat([Buffer.from([0x01]), l, r]));
  const tree = new Array(16);
  for (let lf = 0; lf < 8; lf++) tree[8 + lf] = hLeaf(makePayload(lf));
  for (let n = 7; n >= 1; n--) tree[n] = hNode(tree[n * 2], tree[n * 2 + 1]);
  const p5 = makePayload(5);
  const p5Sha = sha256(p5);
  const verify = (payload, expSha, leafIdx, sib0, sib1, sib2, expRoot) => {
    if (!sha256(payload).equals(expSha)) return false;
    let cur = hLeaf(payload);
    let idx = leafIdx;
    for (const sib of [sib0, sib1, sib2]) {
      cur = (idx & 1) === 0 ? hNode(cur, sib) : hNode(sib, cur);
      idx >>= 1;
    }
    return cur.equals(expRoot);
  };
  const badPayload = Buffer.from(p5);
  badPayload[19] ^= 1;
  const badSib1 = Buffer.from(tree[7]);
  badSib1[11] ^= 1;
  return {
    abc_w0: wordAt(abc, 0),
    abc_w7: wordAt(abc, 28),
    pay_w0: wordAt(p5Sha, 0),
    pay_w7: wordAt(p5Sha, 28),
    root_w0: wordAt(tree[1], 0),
    root_w7: wordAt(tree[1], 28),
    clean_ok: verify(p5, p5Sha, 5, tree[12], tree[7], tree[2], tree[1]),
    payload_tamper_rejected: !verify(badPayload, p5Sha, 5, tree[12], tree[7], tree[2], tree[1]),
    proof_tamper_rejected: !verify(p5, p5Sha, 5, tree[12], badSib1, tree[2], tree[1]),
    index_spoof_rejected: !verify(p5, p5Sha, 4, tree[12], tree[7], tree[2], tree[1]),
  };
}

function oracleI7() {
  const srgbLin = (c8) => {
    const c = c8 / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const wcagLum = (r, g, b) => 0.2126 * srgbLin(r) + 0.7152 * srgbLin(g) + 0.0722 * srgbLin(b);
  const wcagCr = (fg, bg) => {
    const lf = wcagLum(...fg);
    const lb = wcagLum(...bg);
    return (Math.max(lf, lb) + 0.05) / (Math.min(lf, lb) + 0.05);
  };
  const apcaY = (r, g, b) => {
    const y = 0.2126729 * (r / 255) ** 2.4 + 0.7151522 * (g / 255) ** 2.4 + 0.072175 * (b / 255) ** 2.4;
    return y < 0.022 ? y + (0.022 - y) ** 1.414 : y;
  };
  const apcaLc = (fg, bg) => {
    const yt = apcaY(...fg);
    const yb = apcaY(...bg);
    if (Math.abs(yb - yt) < 0.0005) return 0;
    if (yb > yt) {
      const s = (yb ** 0.56 - yt ** 0.57) * 1.14;
      return s < 0.1 ? 0 : (s - 0.027) * 100;
    }
    const s = (yb ** 0.65 - yt ** 0.62) * 1.14;
    return s > -0.1 ? 0 : (s + 0.027) * 100;
  };
  const checkHeadings = (lv) =>
    lv.length > 0 && lv[0] === 1 && lv.every((h, i) => h >= 1 && h <= 6 && (i === 0 || h <= lv[i - 1] + 1));
  const checkMotion = (reduced, animMs, parallax) => !(reduced === 1 && (animMs > 0 || parallax !== 0));
  return {
    cr_light: wcagCr([17, 17, 17], [250, 250, 250]),
    lc_light: apcaLc([17, 17, 17], [250, 250, 250]),
    cr_dark: wcagCr([244, 244, 245], [11, 15, 20]),
    lc_dark: apcaLc([244, 244, 245], [11, 15, 20]),
    cr_low: wcagCr([119, 119, 119], [187, 187, 187]),
    lc_low: apcaLc([119, 119, 119], [187, 187, 187]),
    clean_headings: checkHeadings([1, 2, 3, 2, 3, 4]),
    skipped_heading_rejected: !checkHeadings([1, 4, 2]),
    clean_motion: checkMotion(1, 0, 0),
    motion_violation_rejected: !checkMotion(1, 450, 1),
  };
}

function oracleI14() {
  const evalPolicy = (reach, egress, digest, sigValid) => {
    if (reach <= 0) return egress !== 0 ? { allow: 0, code: -1, traces: 0 } : { allow: 1, code: 0, traces: 0 };
    if (reach <= 50) return { allow: 1, code: 1, traces: 1 };
    const validSha = digest.startsWith("sha256:") && digest.length === 71;
    if (!validSha || sigValid !== 1) return { allow: 0, code: -2, traces: 0 };
    return { allow: 1, code: 2, traces: 1 };
  };
  const validSha = "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  return {
    local: evalPolicy(0, 0, "", 0),
    leak: evalPolicy(0, 1, "", 0),
    nosig: evalPolicy(50000, 1, "", 0),
    badsig: evalPolicy(50000, 1, validSha, 0),
    pub: evalPolicy(50000, 1, validSha, 1),
  };
}

function oracleI9() {
  const score = (author, verifier, ok, bounty) => (ok !== 1 || verifier === author || verifier < 0 ? 0 : bounty);
  const legit = score(1, 101, 1, 10) + score(2, 102, 1, 10) + score(3, 103, 1, 10);
  let sybilOracle = 0;
  let sybilNaive = 0;
  for (let a = 0; a < 10; a++) {
    sybilOracle += score(50, 200 + a, 0, 1);
    sybilNaive += 1;
  }
  const selfVerify = score(77, 77, 1, 10);
  return { legit, sybilOracle, sybilNaive, selfVerify };
}

// ---------------- Tests ----------------

test("graduated MIT BuildLang kernels satisfy source hygiene, SPDX, and REUSE invariants", () => {
  const readme = readFileSync(join(KERNELS_DIR, "README.md"), "utf8");
  assert.match(readme, /SPDX-License-Identifier:\s*MIT/);
  assert.doesNotMatch(readme, /[\u2013\u2014]/);
  assert.doesNotMatch(readme, /[A-Za-z]:\\|\/Users\/|\/home\//);

  for (const k of KERNELS) {
    const src = readFileSync(join(KERNELS_DIR, k.file), "utf8");
    assert.match(src, /SPDX-License-Identifier:\s*MIT/, `${k.file} must carry MIT SPDX header`);
    assert.doesNotMatch(src, /\.as_bytes\s*\(/, `${k.file} must not call String::as_bytes()`);
    assert.doesNotMatch(src, /[\u2013\u2014]/, `${k.file} must not contain em/en dashes`);
    assert.doesNotMatch(src, /[A-Za-z]:\\|\/Users\/|\/home\//, `${k.file} must not contain local paths`);
    assert.match(readme, new RegExp(k.file.replace(".", "\\.")), `README.md must document ${k.file}`);
    for (const [idx, line] of src.split(/\r?\n/).entries()) {
      assert.ok(line.length <= 120, `${k.file}:${idx + 1} exceeds 120 chars (${line.length})`);
    }
  }
});

test("I2 commons_pipe_mirror reference oracle verifies SHA-256 parity, 3/4 BFT quorum, and fail-closed controls", () => {
  const r = oracleI2();
  assert.equal(r.chunk_w0, 3435766736);
  assert.equal(r.chunk_w7, 1955198728);
  assert.equal(r.q_clean, 4);
  assert.equal(r.q_bft, 3);
  assert.equal(r.q_corrupt, 2);
  assert.equal(r.q_paywall, 2);
});

test("N70 boring_bridge_verifier reference oracle verifies FIPS 180-4 KAT, RFC 6962 proof, and 1-bit tamper rejection", () => {
  const r = oracleN70();
  assert.equal(r.abc_w0, 3128432319);
  assert.equal(r.abc_w7, 4060091821);
  assert.equal(r.pay_w0, 2881908566);
  assert.equal(r.pay_w7, 3528028588);
  assert.equal(r.root_w0, 815509491);
  assert.equal(r.root_w7, 1347766922);
  assert.equal(r.clean_ok, true);
  assert.equal(r.payload_tamper_rejected, true);
  assert.equal(r.proof_tamper_rejected, true);
  assert.equal(r.index_spoof_rejected, true);
});

test("I7 accessible_surface_gate reference oracle verifies WCAG AAA, APCA Lc, headings, and reduced motion", () => {
  const r = oracleI7();
  assert.ok(Math.abs(r.cr_light - 18.091292) < 1e-5);
  assert.ok(Math.abs(r.lc_light - 102.369474) < 1e-5);
  assert.ok(Math.abs(r.cr_dark - 17.48522) < 1e-5);
  assert.ok(Math.abs(r.lc_dark - -100.329181) < 1e-5);
  assert.ok(r.cr_low < 4.5 && Math.abs(r.cr_low - 2.332586) < 1e-5);
  assert.equal(r.clean_headings, true);
  assert.equal(r.skipped_heading_rejected, true);
  assert.equal(r.clean_motion, true);
  assert.equal(r.motion_violation_rejected, true);
});

test("I14 reach_gradient and I9 merit_ledger reference oracles enforce fail-closed privacy and anti-Sybil bounds", () => {
  const p = oracleI14();
  assert.deepEqual(p.local, { allow: 1, code: 0, traces: 0 });
  assert.deepEqual(p.leak, { allow: 0, code: -1, traces: 0 });
  assert.deepEqual(p.nosig, { allow: 0, code: -2, traces: 0 });
  assert.deepEqual(p.badsig, { allow: 0, code: -2, traces: 0 });
  assert.deepEqual(p.pub, { allow: 1, code: 2, traces: 1 });

  const m = oracleI9();
  assert.equal(m.legit, 30);
  assert.equal(m.sybilOracle, 0);
  assert.equal(m.sybilNaive, 10);
  assert.equal(m.selfVerify, 0);
});

test("live buildc check, lint, and superopt execution match reference oracles when buildc is installed", (t) => {
  const required = process.env.CMMNS_REQUIRE_BUILDC === "1";
  if (!hasBuildc()) {
    if (required) assert.fail("CMMNS_REQUIRE_BUILDC=1 set but buildc is not on PATH");
    t.skip("buildc not installed in this CI environment; JS reference oracles verified above");
    return;
  }

  for (const k of KERNELS) {
    const file = join(KERNELS_DIR, k.file);
    execFileSync("buildc", ["check", file], { stdio: "pipe" });
    const lintOut = execFileSync("buildc", ["lint", file], { encoding: "utf8" });
    assert.match(lintOut, /No issues found/, `${k.file} lint reported warnings: ${lintOut}`);
    const runOut = execFileSync("buildc", ["run", "--release", "--superopt", file], { encoding: "utf8" });
    assert.doesNotMatch(runOut, /\[FAIL\]|\[ERR\]/, `${k.file} reported failure:\n${runOut}`);

    if (k.id === "I2") {
      const m = parseMetrics(runOut, "i2");
      const ref = oracleI2();
      assert.equal(Number(m.chunk_w0), ref.chunk_w0);
      assert.equal(Number(m.chunk_w7), ref.chunk_w7);
      assert.equal(Number(m.q_clean), ref.q_clean);
      assert.equal(Number(m.q_bft), ref.q_bft);
      assert.equal(Number(m.q_corrupt), ref.q_corrupt);
      assert.equal(Number(m.q_paywall), ref.q_paywall);
    } else if (k.id === "N70") {
      const m = parseMetrics(runOut, "n70");
      const ref = oracleN70();
      assert.equal(Number(m.pay_w0), ref.pay_w0);
      assert.equal(Number(m.pay_w7), ref.pay_w7);
      assert.equal(Number(m.root_w0), ref.root_w0);
      assert.equal(Number(m.root_w7), ref.root_w7);
    } else if (k.id === "I7") {
      const m = parseMetrics(runOut, "i7");
      const ref = oracleI7();
      assert.ok(Math.abs(Number(m.cr_light) - ref.cr_light) < 1e-5);
      assert.ok(Math.abs(Number(m.lc_light) - ref.lc_light) < 1e-5);
      assert.ok(Math.abs(Number(m.cr_dark) - ref.cr_dark) < 1e-5);
      assert.ok(Math.abs(Number(m.lc_dark) - ref.lc_dark) < 1e-5);
      assert.ok(Math.abs(Number(m.cr_low) - ref.cr_low) < 1e-5);
    } else if (k.id === "I14") {
      assert.match(runOut, /\[PASS\] i14_reach_gradient local_traces=0 leak_rc=-1 nosig_rc=-2 badsig_rc=-2 pub_rc=2/);
    } else if (k.id === "I9") {
      assert.match(runOut, /\[PASS\] i9_merit_ledger legit=30\.000000 sybil_oracle=0\.000000 sybil_naive=10\.000000 self_v=0\.000000/);
    }
  }
});
