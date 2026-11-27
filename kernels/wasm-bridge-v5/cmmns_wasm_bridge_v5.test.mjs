// SPDX-FileCopyrightText: 2026 Zain Dana Harper and the CMMNS contributors
// SPDX-License-Identifier: MIT
//
// Live Node/V8 WebAssembly verification tests for the Wave 125A CMMNS WASM Bridge V5.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  WasmBridgeError,
  loadVerifiedWasm,
  runAllBridgeV5Verifiers,
  sha256Hex,
} from "./cmmns_wasm_bridge_v5.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const MANIFEST = JSON.parse(readFileSync(join(ROOT, "wasm_bridge_v5_manifest.json"), "utf8"));

test("V5 bridge is zero-dependency, browser-compatible, and all 20 MIT WASM modules fit <= 225 KB", () => {
  const src = readFileSync(join(ROOT, "cmmns_wasm_bridge_v5.mjs"), "utf8");
  const lines = src.split(/\r?\n/).length;
  assert.ok(lines <= 160, `cmmns_wasm_bridge_v5.mjs has ${lines} lines (> 160)`);
  assert.match(src, /SPDX-License-Identifier:\s*MIT/);
  assert.doesNotMatch(src, /from\s+["']node:/, "Bridge must have zero Node-only imports");
  assert.doesNotMatch(src, /\bfetch\s*\(|XMLHttpRequest|WebSocket/, "Bridge must make zero network calls");
  assert.doesNotMatch(src, /[\u2013\u2014]/, "Bridge must contain zero em/en dashes");
  assert.doesNotMatch(src, /[A-Za-z]:\\|\/Users\/|\/home\//, "Bridge must contain zero local paths");

  assert.equal(MANIFEST.modules.length, 20);
  let totalBytes = 0;
  for (const mod of MANIFEST.modules) {
    const buf = readFileSync(join(ROOT, mod.wasm_path));
    assert.equal(buf.byteLength, mod.bytes, `${mod.slug} byte count mismatch`);
    totalBytes += buf.byteLength;
  }
  assert.equal(totalBytes, MANIFEST.total_bytes);
  assert.ok(totalBytes <= 225 * 1024, `Total WASM size ${totalBytes} exceeds 225 KB`);
});

test("all 20/20 MIT CMMNS V5 WASM kernels (16 V4 + 3 Zero-C BuildOS + CS-031 port verifier) pass in V8", async () => {
  const summary = await runAllBridgeV5Verifiers(MANIFEST, (relPath) => readFileSync(join(ROOT, relPath)));
  assert.equal(summary.ok, true);
  assert.equal(summary.count, 20);

  const bySlug = Object.fromEntries(summary.results.map((r) => [r.slug, r]));
  assert.equal(bySlug.buildos_v1_unified_zeroc.imports, 0);
  assert.deepEqual(bySlug.buildos_v1_unified_zeroc.attacks, { 1: -101, 2: -201, 3: -301, 4: -401, 5: -501, 6: -601 });
  assert.equal(bySlug.buildos_smp_mmu_zeroc.imports, 0);
  assert.deepEqual(bySlug.buildos_smp_mmu_zeroc.attacks, { 1: -101, 2: -201, 3: -301, 4: -401 });
  assert.equal(bySlug.buildos_iommu_nvme_zeroc.imports, 0);
  assert.deepEqual(bySlug.buildos_iommu_nvme_zeroc.attacks, { 1: -101, 2: -201, 3: -301, 4: -401 });
  assert.equal(bySlug.cs031_automated_port_verifier.cleanPorts, 1000);
  assert.equal(bySlug.cs031_automated_port_verifier.detected, 50);
  assert.equal(bySlug.cs031_automated_port_verifier.eqBad, -311);
  assert.equal(bySlug.cs031_automated_port_verifier.effBad, -312);
});

test("3/3 planted fail-closed V5 controls reject corrupted magic, tampered SHA-256, and 1-byte tamper", async () => {
  const badMagic = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x01, 0x00, 0x00, 0x00]);
  const badMagicSha = await sha256Hex(badMagic);
  await assert.rejects(
    () => loadVerifiedWasm(badMagic, badMagicSha),
    (err) => err instanceof WasmBridgeError && err.code === "invalid_wasm_magic",
  );

  const smpMod = MANIFEST.modules.find((m) => m.slug === "buildos_smp_mmu_zeroc");
  const smpBytes = readFileSync(join(ROOT, smpMod.wasm_path));
  const flippedSha = (smpMod.sha256[0] === "0" ? "1" : "0") + smpMod.sha256.slice(1);
  await assert.rejects(
    () => loadVerifiedWasm(smpBytes, flippedSha),
    (err) => err instanceof WasmBridgeError && err.code === "sha256_mismatch",
  );

  const nvmeMod = MANIFEST.modules.find((m) => m.slug === "buildos_iommu_nvme_zeroc");
  const nvmeBytes = readFileSync(join(ROOT, nvmeMod.wasm_path));
  const mutated = new Uint8Array(nvmeBytes);
  mutated[mutated.length - 1] ^= 0x01;
  await assert.rejects(
    () => loadVerifiedWasm(mutated, nvmeMod.sha256),
    (err) => err instanceof WasmBridgeError && err.code === "sha256_mismatch",
  );
});
