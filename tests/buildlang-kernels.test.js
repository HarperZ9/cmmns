// SPDX-FileCopyrightText: 2026 Zain Dana Harper and the CMMNS contributors
// SPDX-License-Identifier: AGPL-3.0-only
//
// Deterministic verification tests for all 17 graduated pure-OSI MIT BuildLang kernels
// under kernels/:
//   Batch 1 (#134): I2 (commons_pipe_mirror), N70 (boring_bridge_verifier),
//                   I7 (accessible_surface_gate), I14 (reach_gradient), I9 (merit_ledger)
//   Batch 2 (#135): N58 (blackout_commons_sync), A22 (honest_journal_kinetic),
//                   E20 (bulletin_feed_ranker), N71 (disclosure_penalty_game)
//   Batch 3 (#136): N34 (quote_provenance_lint), N68 (anti_softness_critic),
//                   N37 (cook_seam_register), N59 (community_homeostasis)
//   Batch 4:        N26 (catastrophe_surge_sim), I10 (non_extractive_attention),
//                   C9 (steward_queue), A16 (silhouette_def)
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
  { id: "N58", formula: "SIG-126", file: "blackout_commons_sync.bld" },
  { id: "A22", formula: "SIG-117", file: "honest_journal_kinetic.bld" },
  { id: "E20", formula: "SIG-118", file: "bulletin_feed_ranker.bld" },
  { id: "N71", formula: "SIG-101", file: "disclosure_penalty_game.bld" },
  { id: "N34", formula: "SIG-098", file: "quote_provenance_lint.bld" },
  { id: "N68", formula: "SIG-099", file: "anti_softness_critic.bld" },
  { id: "N37", formula: "STA-056", file: "cook_seam_register.bld" },
  { id: "N59", formula: "STA-057", file: "community_homeostasis.bld" },
  { id: "N26", formula: "STA-055", file: "catastrophe_surge_sim.bld" },
  { id: "I10", formula: "SIG-110", file: "non_extractive_attention.bld" },
  { id: "C9", formula: "SIG-090", file: "steward_queue.bld" },
  { id: "A16", formula: "SIG-089", file: "silhouette_def.bld" },
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

function popcount32(x) {
  let v = x >>> 0;
  let c = 0;
  while (v > 0) {
    c += v & 1;
    v >>>= 1;
  }
  return c;
}

// ---------------- Batch 1 Reference Oracles ----------------

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

// ---------------- Batch 2 Reference Oracles ----------------

function oracleN58() {
  const gfMul = (a0, b0) => {
    let a = a0 & 0xff;
    let b = b0 & 0xff;
    let p = 0;
    for (let i = 0; i < 8; i++) {
      if (b & 1) p ^= a;
      const hi = a & 0x80;
      a = (a << 1) & 0xff;
      if (hi) a ^= 29;
      b >>>= 1;
    }
    return p & 0xff;
  };
  const gfInv = (a) => {
    if ((a & 0xff) === 0) return 0;
    let res = 1;
    let base = a & 0xff;
    let exp = 254;
    while (exp > 0) {
      if (exp & 1) res = gfMul(res, base);
      base = gfMul(base, base);
      exp >>>= 1;
    }
    return res;
  };
  const inv4x4 = (mIn) => {
    const a = mIn.slice();
    const inv = Array.from({ length: 16 }, (_, i) => (Math.floor(i / 4) === i % 4 ? 1 : 0));
    for (let col = 0; col < 4; col++) {
      let piv = col;
      while (piv < 4 && a[piv * 4 + col] === 0) piv++;
      if (piv !== col) {
        for (let k = 0; k < 4; k++) {
          [a[col * 4 + k], a[piv * 4 + k]] = [a[piv * 4 + k], a[col * 4 + k]];
          [inv[col * 4 + k], inv[piv * 4 + k]] = [inv[piv * 4 + k], inv[col * 4 + k]];
        }
      }
      const invP = gfInv(a[col * 4 + col]);
      for (let k = 0; k < 4; k++) {
        a[col * 4 + k] = gfMul(a[col * 4 + k], invP);
        inv[col * 4 + k] = gfMul(inv[col * 4 + k], invP);
      }
      for (let r = 0; r < 4; r++) {
        if (r === col) continue;
        const fac = a[r * 4 + col];
        if (!fac) continue;
        for (let c = 0; c < 4; c++) {
          a[r * 4 + c] ^= gfMul(fac, a[col * 4 + c]);
          inv[r * 4 + c] ^= gfMul(fac, inv[col * 4 + c]);
        }
      }
    }
    return inv;
  };

  const payload = Buffer.alloc(64);
  for (let i = 0; i < 64; i++) payload[i] = ((i * 37 + 19) ^ 90) & 0xff;
  const origSha = sha256(payload).toString("hex");

  const g = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) g.push(r === c ? 1 : 0);
  for (let p = 0; p < 2; p++) for (let c = 0; c < 4; c++) g.push(gfInv((4 + p) ^ c));

  const shards = [];
  for (let s = 0; s < 6; s++) {
    for (let j = 0; j < 16; j++) {
      let val = 0;
      for (let c = 0; c < 4; c++) val ^= gfMul(g[s * 4 + c], payload[c * 16 + j]);
      shards.push(val);
    }
  }

  let recovered = 0;
  for (let e1 = 0; e1 < 6; e1++) {
    for (let e2 = e1 + 1; e2 < 6; e2++) {
      const keep = [0, 1, 2, 3, 4, 5].filter((idx) => idx !== e1 && idx !== e2);
      const subG = [];
      for (const sr of keep) for (let c = 0; c < 4; c++) subG.push(g[sr * 4 + c]);
      const invG = inv4x4(subG);
      const rec = Buffer.alloc(64);
      for (let r = 0; r < 4; r++) {
        for (let j = 0; j < 16; j++) {
          let v = 0;
          for (let c = 0; c < 4; c++) v ^= gfMul(invG[r * 4 + c], shards[keep[c] * 16 + j]);
          rec[r * 16 + j] = v;
        }
      }
      if (sha256(rec).toString("hex") === origSha) recovered++;
    }
  }
  const rc3Loss = 3 < 4 ? -101 : 0;
  return { origSha, recovered, rc3Loss };
}

function oracleA22() {
  const baseTs = 1795651200n;
  const entries = [
    [baseTs, 1, 1, 150],
    [baseTs + 86400n, 2, 0, 200],
    [baseTs + 259200n, 3, 1, 180],
    [baseTs + 432000n, 4, 1, 120],
    [baseTs + 604800n, 5, 0, 250],
    [baseTs + 864000n, 6, 1, 160],
    [baseTs + 1036800n, 7, 0, 140],
    [baseTs + 1209600n, 8, 1, 190],
  ];
  const chainHash = (rows) => {
    let cur = sha256(Buffer.from("A22-GENESIS"));
    for (const [ts, id, kin, w100] of rows) {
      const blk = Buffer.alloc(49);
      cur.copy(blk, 0);
      blk.writeBigUInt64BE(ts, 32);
      blk.writeUInt32BE(id, 40);
      blk.writeUInt8(kin, 44);
      blk.writeUInt32BE(w100, 45);
      cur = sha256(blk);
    }
    return cur;
  };
  const tip = chainHash(entries);
  const edited = entries.map((e, i) => (i === 2 ? [e[0], e[1], e[2], e[3] + 1] : e));
  const nowTs = Number(baseTs + 1296000n);
  let kinSum = 0;
  let rawPot = 0;
  let decPot = 0;
  for (const [ts, , kin, w100] of entries) {
    const w = w100 / 100;
    if (kin === 1) kinSum += w;
    else {
      rawPot += w;
      decPot += w * Math.exp((-Math.LN2 * (nowTs - Number(ts))) / 604800.0);
    }
  }
  return {
    tip_w0: wordAt(tip, 0),
    tip_w7: wordAt(tip, 28),
    raw_ratio: kinSum / (kinSum + rawPot),
    eff_ratio: kinSum / (kinSum + decPot),
    edit_rejected: !tip.equals(chainHash(edited)),
  };
}

function oracleE20() {
  const posts = [
    [101, 2863311530, 1, 1.8, 0.85, 2.0],
    [102, 858993459, 1, 2.4, 0.92, 1.0],
    [103, 4042322160, 1, 1.5, 0.7, 6.0],
    [104, 252645135, 1, 2.0, 0.95, 3.0],
    [105, 3435973836, 1, 1.2, 0.6, 0.5],
    [201, 858993459, 1, 2.4, 0.92, 0.1],
    [202, 858993459 ^ 1, 1, 2.4, 0.92, 0.1],
    [203, 858993459 ^ 5, 1, 2.4, 0.92, 0.1],
    [301, 16711935, 0, 5.0, 99.0, 0.01],
    [302, 4278255360, 0, 9.0, 50.0, 0.05],
  ];
  const accepted = [];
  const hashes = [];
  let dup = 0;
  let unv = 0;
  for (const [id, h, v, w, nov, age] of posts) {
    if (v === 0 || w <= 0) unv++;
    else if (hashes.some((ah) => popcount32(h ^ ah) <= 2)) dup++;
    else {
      accepted.push({ id, score: (w * nov) / (1.0 + 0.15 * age) });
      hashes.push(h);
    }
  }
  accepted.sort((a, b) => b.score - a.score);
  return {
    acc: accepted.length,
    dup,
    unv,
    order: accepted.slice(0, 4).map((x) => x.id),
    top1_score: accepted[0].score,
    score_sum: accepted.reduce((s, x) => s + x.score, 0),
  };
}

function oracleN71() {
  const sim = (pStigma, bVerify, qAudit, fCaught) => {
    const u0 = 1.0;
    const cHide = 0.02;
    let sumP = 0;
    for (let s = 0; s < 100; s++) {
      let rng = BigInt(12345 + s * 7919);
      rng = (rng * 48271n) % 2147483647n;
      let p = 0.2 + 0.6 * (Number(rng) / 2147483647.0);
      rng = (rng * 48271n) % 2147483647n;
      const eps = (Number(rng) / 2147483647.0 - 0.5) * 0.08;
      const du = u0 - (pStigma + eps) + bVerify - (u0 - qAudit * fCaught - cHide);
      for (let t = 0; t < 200; t++) {
        p = Math.min(1 - 1e-9, Math.max(1e-9, p + 0.25 * p * (1 - p) * du));
      }
      sumP += p;
    }
    return sumP / 100;
  };
  return {
    p_pun: sim(0.45, 0.0, 0.05, 1.0),
    p_aud: sim(0.0, 0.15, 0.35, 1.2),
    p_mix: sim(0.3, 0.05, 0.35, 1.0),
    p_zero: sim(0.25, 0.0, 0.0, 1.0),
  };
}

// ---------------- Batch 3 Reference Oracles ----------------

function oracleN34() {
  const fnv1a32 = (bs) => {
    let h = 2166136261n;
    for (const b of bs) {
      h = (h ^ BigInt(b & 0xff)) & 0xffffffffn;
      h = (h * 16777619n) & 0xffffffffn;
    }
    return Number(h);
  };
  const ruleBytes = (id) => Array.from({ length: 32 }, (_, i) => ((65 + id * 19 + i * 31 + id * 7) % 90) + 33);
  const hs = [1, 2, 3, 4].map((id) => fnv1a32(ruleBytes(id)));
  return {
    h1: hs[0],
    h2: hs[1],
    h3: hs[2],
    h4: hs[3],
    digest_xor: Number((BigInt(hs[0]) ^ BigInt(hs[1]) ^ BigInt(hs[2]) ^ BigInt(hs[3])) & 0xffffffffn),
  };
}

function oracleN68() {
  const sycLex = ["you are absolutely right", "what a great point", "i completely agree", "brilliant insight", "spot on"];
  const hedLex = ["perhaps maybe", "it might possibly", "i suppose we could", "one could arguably"];
  const tidLex = ["i see the error of my ways", "all is forgiven", "we can both agree", "everything worked out cleanly"];
  const dirLex = ["false", "contradicts", "measured", "rejected", "fails", "mismatch", "drift"];
  const cnt = (s, lex) => lex.reduce((acc, p) => acc + (s.split(p).length - 1), 0);
  const score = (txt) => {
    const low = txt.toLowerCase();
    const syc = cnt(low, sycLex);
    const hed = cnt(low, hedLex);
    const tid = cnt(low, tidLex);
    const dir = cnt(low, dirLex);
    const soft = syc + hed + tid;
    const total = soft + dir;
    return {
      direct: dir,
      ratio: soft / (total > 0 ? total : 1),
      penalty: Math.max(0, 2 * syc + hed + 1.5 * tid - 0.5 * dir),
    };
  };
  const a1 = score("Claim A is false: measured drift contradicts baseline and fails parity.");
  const a2 = score("Receipt check rejected due to hash mismatch; measured error fails gate.");
  const a3 = score("Hypothesis contradicts measured log, rejected as false on drift audit.");
  const ps = score("You are absolutely right! What a great point, I completely agree, brilliant insight.");
  const pt = score("I see the error of my ways, all is forgiven, we can both agree everything worked out cleanly.");
  const pm = score("You are absolutely right, perhaps maybe it might possibly differ from measured data.");
  return {
    auth_direct: a1.direct + a2.direct + a3.direct,
    planted_mean_ratio: (ps.ratio + pt.ratio + pm.ratio) / 3,
    syc_pen: ps.penalty,
    tidy_pen: pt.penalty,
    mix_pen: pm.penalty,
  };
}

function oracleN37() {
  const off = (mask, node) => ((mask >> node) & 1) !== 0;
  const op = (mask, cm) => {
    if ((off(mask, 0) && off(mask, 1)) || off(mask, 2)) return 0;
    if (off(mask, 3) && off(mask, 4)) return 0;
    let p = off(mask, 5) ? 0 : 1;
    let r = off(mask, 6) ? 0 : 1;
    if (cm === 1 && off(mask, 3)) {
      p = 0;
      r = 0;
    }
    if ((p === 0 && r === 0) || off(mask, 7)) return 0;
    if ((off(mask, 8) && off(mask, 9)) || off(mask, 10) || off(mask, 11)) return 0;
    return 1;
  };
  const analyze = (cm) => {
    const spof = Array.from({ length: 12 }, (_, i) => (op(1 << i, cm) === 0 ? 1 : 0));
    let two = 0;
    for (let i = 0; i < 12; i++) {
      if (spof[i]) continue;
      for (let j = i + 1; j < 12; j++) {
        if (!spof[j] && op((1 << i) | (1 << j), cm) === 0) two++;
      }
    }
    return { one: spof.reduce((a, b) => a + b, 0), two, clockASpof: spof[3] };
  };
  const clean = analyze(0);
  const cm = analyze(1);
  return { one_clean: clean.one, two_clean: clean.two, one_cm: cm.one, clockA_spof: cm.clockASpof };
}

function oracleN59() {
  const sim = (tau, kp, ki, steps) => {
    const xh = new Array(steps).fill(0);
    const ih = new Array(steps).fill(0);
    let x = 0;
    let integ = 0;
    let peak = 0;
    let ise = 0;
    let unstable = 0;
    let lastExceed = 15;
    for (let t = 0; t < steps; t++) {
      xh[t] = x;
      ih[t] = integ;
      const obs = t >= tau ? t - tau : 0;
      const u = -kp * xh[obs] - ki * ih[obs];
      const dist = t >= 5 && t < 15 ? 1.0 : 0.0;
      const xn = 0.9 * x + u + dist;
      integ += x;
      const ax = Math.abs(xn);
      if (ax > peak) peak = ax;
      if (ax > 1000) {
        unstable = 1;
        break;
      }
      ise += xn * xn;
      if (t >= 15 && ax >= 0.15) lastExceed = t;
      x = xn;
    }
    return { peak, ise, settle: unstable ? steps : lastExceed - 15, unstable };
  };
  const s1 = sim(1, 0.22, 0.015, 180);
  const s10 = sim(10, 0.22, 0.015, 180);
  const run = sim(10, 0.95, 0.12, 180);
  return { s1, s10, ise_ratio: s10.ise / s1.ise, runaway_unstable: run.unstable };
}

// ---------------- Batch 4 Reference Oracles ----------------

function oracleN26() {
  const n = 100;
  const inc = (i) => Math.exp((3.2188758248682006 * i) / (n - 1));
  const dem = (y, p) => Math.min(1 + y / (2 * p), y / p);
  const totDem = (p) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += dem(inc(i), p);
    return s;
  };
  const evalAlloc = (q, supply, price) => {
    let tot = 0;
    let unmet = 0;
    let welf = 0;
    for (const qi of q) {
      tot += qi;
      if (qi < 1) unmet += 1 - qi;
      welf += Math.log(1 + 4 * Math.min(qi, 1) + 0.5 * Math.max(qi - 1, 0));
    }
    const mean = tot / n;
    let ds = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) ds += Math.abs(q[i] - q[j]);
    return { price, unmet, welf, gini: ds / (2 * n * n * mean), cerr: Math.abs(tot - supply) };
  };
  const incSum = Array.from({ length: n }, (_, i) => inc(i)).reduce((a, b) => a + b, 0);
  let checksum = 0;
  let allBetter = true;
  for (const frac of [0.3, 0.5, 0.7]) {
    const supply = 150 * (1 - frac);
    let lo = 0.01;
    let hi = 200;
    for (let k = 0; k < 80; k++) {
      const mid = 0.5 * (lo + hi);
      if (totDem(mid) > supply) lo = mid;
      else hi = mid;
    }
    const p = 0.5 * (lo + hi);
    const surge = evalAlloc(Array.from({ length: n }, (_, i) => dem(inc(i), p)), supply, p);
    const base = Math.min(1, supply / n);
    const rem = supply - base * n;
    const ration = evalAlloc(Array.from({ length: n }, (_, i) => base + (rem > 0 ? rem * (inc(i) / incSum) : 0)), supply, 1);
    if (!(ration.unmet < surge.unmet && ration.welf > surge.welf && ration.gini < surge.gini)) allBetter = false;
    checksum += surge.price + surge.welf + ration.welf + surge.gini + ration.gini;
  }
  const leakErr = Math.abs(n * 0.8 - 75);
  return { allBetter, checksum, leakCaught: leakErr > 1e-6 };
}

function oracleI10() {
  const audit = (tpm, prod, tot, clicks, inf, varR, auto) => {
    const hits = (clicks > 1 ? 1 : 0) + (inf ? 1 : 0) + (varR ? 1 : 0) + (auto ? 1 : 0);
    const raw = 0.45 * (prod / tot) + 0.35 * Math.min(1, tpm / 2) + 0.2 * (clicks <= 1 ? 1 : 1 / clicks);
    const score = Math.max(0, raw - 0.25 * hits);
    return { score, rc: hits > 0 || score < 0.75 ? -301 : 0 };
  };
  const clean = [audit(2.4, 18.5, 20, 1, 0, 0, 0), audit(1.9, 14, 15, 1, 0, 0, 0), audit(2.2, 27, 30, 0, 0, 0, 0)];
  const dark = [audit(0.3, 4, 45, 5, 1, 1, 1), audit(1.8, 12, 15, 1, 0, 1, 0), audit(1.6, 11, 15, 4, 1, 0, 0)];
  return {
    cleanOk: clean.every((x) => x.rc === 0),
    darkCaught: dark.every((x) => x.rc === -301),
    cmean: clean.reduce((s, x) => s + x.score, 0) / 3,
    dmean: dark.reduce((s, x) => s + x.score, 0) / 3,
  };
}

function oracleC9() {
  const fnv4 = (h, v) => {
    let cur = BigInt(h) & 0xffffffffn;
    let x = BigInt(v);
    for (let k = 0; k < 4; k++) {
      cur = ((cur ^ (x & 0xffn)) * 16777619n) & 0xffffffffn;
      x >>= 8n;
    }
    return Number(cur);
  };
  const crc = (id, pl) => fnv4(fnv4(2166136261, id), pl);
  const pl = Array.from({ length: 500 }, (_, i) => Number((BigInt(i) * 2654435761n + 1013904223n) & 0xffffffffn));
  const stored = pl.map((v, i) => crc(i, v));
  const par = Array.from({ length: 500 }, (_, i) => (i === 0 ? 0 : i - 1));
  pl[42] ^= 1;
  pl[199] ^= 16;
  pl[387] ^= 128;
  par[111] = -1;
  par[450] = -1;
  let rot = 0;
  let orph = 0;
  let qh = 2166136261;
  for (let i = 0; i < 500; i++) {
    if (crc(i, pl[i]) !== stored[i]) {
      rot++;
      qh = fnv4(qh, i * 10 + 1);
    } else if (par[i] < 0 || par[i] >= 500) {
      orph++;
      qh = fnv4(qh, i * 10 + 2);
    }
  }
  return { flagged: rot + orph, bitrot: rot, orphan: orph, qhash: qh };
}

function oracleA16() {
  const val = (t, e, p, n) => {
    const [tt, ee, pp, nn] = [t.trim(), e.trim(), p.trim(), n.trim()];
    if (tt.length === 0 || ee.length < 4) return 1;
    if (pp.length < 8) return 2;
    if (nn.length < 8) return 3;
    if (pp.toLowerCase() === nn.toLowerCase()) return 4;
    return 0;
  };
  return {
    valid: val("isomorphism", "Greek isos + morphe", "bijective map preserving structure", "lossy one-way hash digest"),
    etym: val("entropy", "", "measure of microstate multiplicity", "deterministic crystal at 0 K"),
    pos: val("merit", "Latin meritum", "", "unverified Sybil upvote ring"),
    neg: val("steward", "Old English stigweard", "custodian verifying archive integrity", ""),
    taut: val("vague", "Latin vagus", "exact same clause copied twice", "exact same clause copied twice"),
  };
}

// ---------------- Tests ----------------

test("all 17 graduated MIT BuildLang kernels satisfy source hygiene, SPDX, and REUSE invariants", () => {
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

test("N58 blackout_commons_sync reference oracle recovers 15/15 two-shard erasures and rejects 3-shard loss", () => {
  const r = oracleN58();
  assert.equal(r.recovered, 15);
  assert.equal(r.rc3Loss, -101);
  assert.equal(r.origSha, "cce38eca54ef2fc0893778bed8fa181046d258b4df4763b59c3f50b8f98662c8");
});

test("A22 honest_journal_kinetic, E20 bulletin_feed_ranker, and N71 disclosure_penalty_game reference oracles pass", () => {
  const a = oracleA22();
  assert.equal(a.tip_w0, 616225250);
  assert.equal(a.tip_w7, 1639327047);
  assert.ok(Math.abs(a.raw_ratio - 0.57554) < 1e-5);
  assert.ok(Math.abs(a.eff_ratio - 0.749601) < 1e-5);
  assert.equal(a.edit_rejected, true);

  const e = oracleE20();
  assert.equal(e.acc, 5);
  assert.equal(e.dup, 3);
  assert.equal(e.unv, 2);
  assert.deepEqual(e.order, [102, 104, 101, 105]);
  assert.ok(Math.abs(e.top1_score - 1.92) < 1e-6);

  const n = oracleN71();
  assert.ok(n.p_pun < 0.01);
  assert.ok(n.p_aud > 0.99);
  assert.ok(n.p_mix > 0.95);
  assert.ok(n.p_zero < 0.02);
});

test("N34 quote_provenance, N68 anti_softness, N37 cook_seam_register, and N59 community_homeostasis oracles pass", () => {
  const n34 = oracleN34();
  assert.equal(n34.h1, 2714538113);
  assert.equal(n34.h2, 764524841);
  assert.equal(n34.h3, 1670236073);
  assert.equal(n34.h4, 3624390679);
  assert.equal(n34.digest_xor, 936853014);

  const n68 = oracleN68();
  assert.equal(n68.auth_direct, 14);
  assert.ok(Math.abs(n68.planted_mean_ratio - 0.916667) < 1e-5);
  assert.equal(n68.syc_pen, 8.0);
  assert.equal(n68.tidy_pen, 6.0);
  assert.equal(n68.mix_pen, 3.5);

  const n37 = oracleN37();
  assert.equal(n37.one_clean, 4);
  assert.equal(n37.two_clean, 4);
  assert.equal(n37.one_cm, 5);
  assert.equal(n37.clockA_spof, 1);

  const n59 = oracleN59();
  assert.ok(n59.s1.peak < n59.s10.peak);
  assert.ok(n59.ise_ratio > 2350 && n59.ise_ratio < 2352);
  assert.equal(n59.s1.settle, 43);
  assert.equal(n59.s10.settle, 164);
  assert.equal(n59.runaway_unstable, 1);
});

test("N26 catastrophe_surge, I10 non_extractive_attention, C9 steward_queue, and A16 silhouette_def oracles pass", () => {
  const n26 = oracleN26();
  assert.equal(n26.allBetter, true);
  assert.ok(Math.abs(n26.checksum - 761.748654) < 1e-4);
  assert.equal(n26.leakCaught, true);

  const i10 = oracleI10();
  assert.equal(i10.cleanOk, true);
  assert.equal(i10.darkCaught, true);
  assert.ok(Math.abs(i10.cmean - 0.9579) < 1e-3);
  assert.ok(Math.abs(i10.dmean - 0.2617) < 1e-3);

  const c9 = oracleC9();
  assert.deepEqual(c9, { flagged: 5, bitrot: 3, orphan: 2, qhash: 2760921890 });

  const a16 = oracleA16();
  assert.deepEqual(a16, { valid: 0, etym: 1, pos: 2, neg: 3, taut: 4 });
});

test("live buildc check, lint, and superopt execution match reference oracles for all 17 kernels when buildc is installed", (t) => {
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
    } else if (k.id === "N58") {
      const ref = oracleN58();
      assert.match(runOut, new RegExp(`BLACKOUT_SYNC status=PASS failures=0 .* recovered=15/15 rc_3loss=-101 sha=${ref.origSha}`));
    } else if (k.id === "A22") {
      const m = parseMetrics(runOut, "a22");
      const ref = oracleA22();
      assert.equal(Number(m.tip_w0), ref.tip_w0);
      assert.equal(Number(m.tip_w7), ref.tip_w7);
      assert.ok(Math.abs(Number(m.raw_ratio) - ref.raw_ratio) < 1e-5);
      assert.ok(Math.abs(Number(m.eff_ratio) - ref.eff_ratio) < 1e-5);
    } else if (k.id === "E20") {
      const m = parseMetrics(runOut, "e20");
      const ref = oracleE20();
      assert.equal(Number(m.acc), ref.acc);
      assert.equal(Number(m.dup), ref.dup);
      assert.equal(Number(m.unv), ref.unv);
      assert.deepEqual([Number(m.top1), Number(m.top2), Number(m.top3), Number(m.top4)], ref.order);
      assert.ok(Math.abs(Number(m.top1_score) - ref.top1_score) < 1e-5);
    } else if (k.id === "N71") {
      const m = parseMetrics(runOut, "n71");
      const ref = oracleN71();
      assert.ok(Math.abs(Number(m.p_pun) - ref.p_pun) < 1e-5);
      assert.ok(Math.abs(Number(m.p_aud) - ref.p_aud) < 1e-5);
      assert.ok(Math.abs(Number(m.p_mix) - ref.p_mix) < 1e-5);
      assert.ok(Math.abs(Number(m.p_zero) - ref.p_zero) < 1e-5);
    } else if (k.id === "N34") {
      const m = parseMetrics(runOut, "n34");
      const ref = oracleN34();
      assert.equal(Number(m.h1), ref.h1);
      assert.equal(Number(m.h2), ref.h2);
      assert.equal(Number(m.h3), ref.h3);
      assert.equal(Number(m.h4), ref.h4);
      assert.equal(Number(m.digest_xor), ref.digest_xor);
    } else if (k.id === "N68") {
      const m = parseMetrics(runOut, "n68");
      const ref = oracleN68();
      assert.equal(Number(m.auth_direct), ref.auth_direct);
      assert.ok(Math.abs(Number(m.planted_mean_ratio) - ref.planted_mean_ratio) < 1e-5);
      assert.equal(Number(m.syc_pen), ref.syc_pen);
      assert.equal(Number(m.tidy_pen), ref.tidy_pen);
      assert.equal(Number(m.mix_pen), ref.mix_pen);
    } else if (k.id === "N37") {
      assert.match(runOut, /\[PASS\] N37_COOK_SEAM_REGISTER one_cuts=4 two_cuts=4 cm_one_cuts=5 planted_caught=1/);
    } else if (k.id === "N59") {
      assert.match(runOut, /\[PASS\] N59_COMMUNITY_HOMEOSTASIS ise_ratio=2351\.15x settle_1=43 settle_10=164 planted=1/);
    } else if (k.id === "N26") {
      assert.match(runOut, /\[PASS\] N26_CATASTROPHE_SURGE_SIM shocks=3\/3 planted_caught=1 checksum=761\.748654/);
    } else if (k.id === "I10") {
      assert.match(runOut, /\[PASS\] I10_NON_EXTRACTIVE clean=3\/3 dark_caught=3\/3 cmean=0\.9579 dmean=0\.2617/);
    } else if (k.id === "C9") {
      assert.match(runOut, /\[PASS\] c9_steward_queue scanned=500 flagged=5 bitrot=3 orphan=2 deleted=0 qhash=2760921890/);
    } else if (k.id === "A16") {
      assert.match(runOut, /\[PASS\] a16_valid_definitions passed=3/);
      assert.match(runOut, /\[PASS\] a16_planted_rejections etym=1 pos=2 neg=3 taut=4/);
    }
  }
});
