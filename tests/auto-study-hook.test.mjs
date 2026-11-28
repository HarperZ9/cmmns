// SPDX-FileCopyrightText: 2026 Zain Dana Harper and the CMMNS contributors
// SPDX-License-Identifier: AGPL-3.0-only
//
// Tests for automated post-download CMMNS -> Gather -> Distill -> Study pipeline hook.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MCP_DISPATCH_SCHEMA,
  ROUTING_SCHEMA,
  STUDY_SCHEMA,
  dissectArtifactReadOnly,
  processBundle,
  verifyBundleSeals,
  verifyStudyReceipt,
} from "../pipeline/auto-study-hook.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const HOOK_SRC = readFileSync(path.join(ROOT, "..", "pipeline", "auto-study-hook.mjs"), "utf8");

function makeSampleBundle() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "cmmns-auto-study-"));
  writeFileSync(
    path.join(dir, "paper.md"),
    [
      "# LoomFormer Vertical Attention",
      "Citation: arXiv:2611.30634 and https://github.com/example/loomformer",
      "Claim: Deep non-sink active heads rise from 22.9% to 74.4% at +2.0% FLOPs.",
      "Equation: $Sel(A) = CL(A) - lambda_leak * B_leak(A)$",
      "Relevant targets: BuildLang GPU WGSL/SPIRV compiler kernel, Superframe shader, Flywheel oracle receipt, and browser Playground.",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(
    path.join(dir, "transcript.txt"),
    "Finding: 2-pass LoopCD achieved 1.78x prefill throughput on public benchmarks (doi: 10.1145/1234567.8901234).\n",
    "utf8",
  );
  writeFileSync(path.join(dir, "clip.wav"), Buffer.from("RIFF0000WAVEfmt ", "ascii"));
  // Read-only Layer-0 binary headers (never executed): WASM, ELF64, PE/MZ, PNG, PDF, glTF GLB
  writeFileSync(path.join(dir, "kernel.wasm"), Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]));
  const elf = Buffer.alloc(24);
  elf.set([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01], 0);
  elf.writeUInt16LE(0x3e, 18);
  writeFileSync(path.join(dir, "sample.elf"), elf);
  const png = Buffer.alloc(24);
  png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  png.writeUInt32BE(640, 16);
  png.writeUInt32BE(480, 20);
  writeFileSync(path.join(dir, "frame.png"), png);
  const glb = Buffer.alloc(12);
  glb.write("glTF", 0, "ascii");
  glb.writeUInt32LE(2, 4);
  glb.writeUInt32LE(12, 8);
  writeFileSync(path.join(dir, "asset.glb"), glb);
  return dir;
}

test("auto-study-hook is pure Node stdlib ESM with AGPL-3.0-only SPDX and zero em/en dashes", () => {
  assert.match(HOOK_SRC, /SPDX-License-Identifier:\s*AGPL-3\.0-only/);
  assert.doesNotMatch(HOOK_SRC, /[\u2013\u2014]/);
  assert.doesNotMatch(HOOK_SRC, /(?:^|[\s"'`])[A-Z]:\\|\/Users\/|\/home\//);
});

test("end-to-end bundle ingestion seals SOURCE.txt + SHA256SUMS, generates Study + routing, and is deterministic", () => {
  const dir1 = makeSampleBundle();
  const dir2 = makeSampleBundle();
  try {
    const opts = {
      title: "LoomFormer Intake Study",
      sourceUrl: "https://arxiv.org/abs/2611.30634",
      license: "CC-BY-4.0",
      intakeIso: "2026-11-27T17:15:00Z",
    };
    const r1 = processBundle(dir1, opts);
    const r2 = processBundle(dir2, opts);

    assert.equal(r1.ok, true);
    assert.equal(r1.verdict, "SEALED");
    assert.equal(r1.study.schema, STUDY_SCHEMA);
    assert.equal(r1.routing.schema, ROUTING_SCHEMA);
    assert.equal(r1.study.seal.file_count, 7);
    assert.ok(r1.study.claims.length >= 2);
    assert.ok(r1.study.citations.includes("arXiv:2611.30634"));
    assert.ok(r1.study.equations.length >= 1);
    assert.equal(r1.study.bounds.verified.sealed_files, 7);
    assert.ok(r1.study.bounds.unverified.external_citations.length >= 2);

    // Multi-modal Layer-0 read-only dissection verified (never executed)
    const byRel = Object.fromEntries(r1.study.media_inventory.map((m) => [m.rel, m]));
    assert.equal(byRel["kernel.wasm"].layer0.format, "wasm");
    assert.equal(byRel["kernel.wasm"].layer0.executed, false);
    assert.equal(byRel["sample.elf"].layer0.format, "elf");
    assert.equal(byRel["sample.elf"].layer0.header.bits, 64);
    assert.equal(byRel["frame.png"].layer0.format, "png");
    assert.equal(byRel["frame.png"].layer0.header.width, 640);
    assert.equal(byRel["asset.glb"].layer0.format, "gltf_glb");
    assert.equal(dissectArtifactReadOnly(Buffer.from("MZ\x00\x00"), ".exe").format, "pe_mz");
    assert.equal(dissectArtifactReadOnly(Buffer.from("%PDF-1.7\n"), ".pdf").format, "pdf");

    // MCP dispatch plan covers all 6 targets across the 5 flagship repos
    assert.equal(r1.mcpDispatch.schema, MCP_DISPATCH_SCHEMA);
    assert.equal(r1.mcpDispatch.execute_untrusted_binaries, false);
    assert.deepEqual(
      r1.mcpDispatch.targets.map((t) => t.server),
      ["gather", "index", "library", "flywheel", "superframe", "buildlang"],
    );
    assert.ok(r1.mcpDispatch.targets.every((t) => t.enabled === true && t.read_only === true));
    assert.equal(r1.mcpDispatch.dispatch_sha256, r2.mcpDispatch.dispatch_sha256);

    // Cross-domain routing covers all 4 lanes
    assert.deepEqual(r1.routing.active_lanes, ["buildlang", "flywheel", "playground", "superframe"]);

    // Deterministic Study and Routing SHA-256 receipts across identical bundles
    assert.match(r1.study.receipt_sha256, /^[0-9a-f]{64}$/);
    assert.equal(r1.study.receipt_sha256, r2.study.receipt_sha256);
    assert.equal(r1.routing.routing_sha256, r2.routing.routing_sha256);

    // Verify seals and Study receipt intact
    assert.equal(verifyBundleSeals(dir1).ok, true);
    assert.equal(verifyStudyReceipt(r1.study).ok, true);

    const md = readFileSync(path.join(dir1, "study.md"), "utf8");
    assert.match(md, /## Verified Bounds/);
    assert.match(md, /## Unverified Bounds/);
    assert.doesNotMatch(md, /[\u2013\u2014]/);
  } finally {
    rmSync(dir1, { recursive: true, force: true });
    rmSync(dir2, { recursive: true, force: true });
  }
});

test("planted fail-closed controls reject 1-byte file tamper, Study receipt tamper, and prohibited surveillance/profiling", () => {
  const dir = makeSampleBundle();
  try {
    const res = processBundle(dir, { title: "Tamper Control Bundle", intakeIso: "2026-11-27T17:15:00Z" });
    assert.equal(res.ok, true);

    // Control 1: 1-byte tamper in sealed paper.md caught by verifyBundleSeals
    const paperPath = path.join(dir, "paper.md");
    writeFileSync(paperPath, `${readFileSync(paperPath, "utf8")}X`, "utf8");
    const badSeal = verifyBundleSeals(dir);
    assert.equal(badSeal.ok, false);
    assert.equal(badSeal.reason, "sha256_mismatch");
    assert.equal(badSeal.file, "paper.md");

    // Control 2: 1-field tamper in study.json caught by verifyStudyReceipt
    const tamperedStudy = { ...res.study, title: "Tampered Title" };
    const badReceipt = verifyStudyReceipt(tamperedStudy);
    assert.equal(badReceipt.ok, false);
    assert.equal(badReceipt.reason, "study_digest_mismatch");

    // Control 3: Prohibited surveillance / movement tracking / genetic profiling refused fail-closed
    const surv = processBundle(dir, { title: "Bad", personalSurveillance: true });
    assert.equal(surv.ok, false);
    assert.equal(surv.reason, "personal_surveillance_refused");

    const move = processBundle(dir, { title: "Bad", movementTracking: true });
    assert.equal(move.ok, false);
    assert.equal(move.reason, "movement_tracking_refused");

    const gen = processBundle(dir, { title: "Bad", geneticProfiling: true });
    assert.equal(gen.ok, false);
    assert.equal(gen.reason, "genetic_profiling_refused");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
