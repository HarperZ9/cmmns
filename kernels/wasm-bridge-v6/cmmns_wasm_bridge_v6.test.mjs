// SPDX-FileCopyrightText: 2026 Zain Dana Harper and the CMMNS contributors
// SPDX-License-Identifier: MIT
//
// Live Node/V8 WebAssembly verification tests for the Wave 148A CMMNS WASM Bridge V6.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  WasmBridgeError,
  loadVerifiedWasm,
  runAllBridgeV6Verifiers,
  sha256Hex,
} from "./cmmns_wasm_bridge_v6.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const MANIFEST = JSON.parse(readFileSync(join(ROOT, "wasm_bridge_v6_manifest.json"), "utf8"));

test("V6 bridge is zero-dependency, browser-compatible, and all 24 MIT WASM modules fit <= 300 KB", () => {
  const src = readFileSync(join(ROOT, "cmmns_wasm_bridge_v6.mjs"), "utf8");
  const lines = src.split(/\r?\n/).length;
  assert.ok(lines <= 160, `cmmns_wasm_bridge_v6.mjs has ${lines} lines (> 160)`);
  assert.match(src, /SPDX-License-Identifier:\s*MIT/);
  assert.doesNotMatch(src, /from\s+["']node:/, "Bridge must have zero Node-only imports");
  assert.doesNotMatch(src, /\bfetch\s*\(|XMLHttpRequest|WebSocket/, "Bridge must make zero network calls");
  assert.doesNotMatch(src, /[\u2013\u2014]/, "Bridge must contain zero em/en dashes");
  assert.doesNotMatch(src, /[A-Za-z]:\\|\/Users\/|\/home\//, "Bridge must contain zero local paths");

  assert.equal(MANIFEST.modules.length, 24);
  let totalBytes = 0;
  for (const mod of MANIFEST.modules) {
    const buf = readFileSync(join(ROOT, mod.wasm_path));
    assert.equal(buf.byteLength, mod.bytes, `${mod.slug} byte count mismatch`);
    totalBytes += buf.byteLength;
  }
  assert.equal(totalBytes, MANIFEST.total_bytes);
  assert.ok(totalBytes <= 300 * 1024, `Total WASM size ${totalBytes} exceeds 300 KB`);
});

test("all 24/24 MIT CMMNS V6 WASM kernels (20 V5 + 4 Zero-C security slices) pass in V8 with 16/16 attacks trapped", async () => {
  const summary = await runAllBridgeV6Verifiers(MANIFEST, (relPath) => readFileSync(join(ROOT, relPath)));
  assert.equal(summary.ok, true);
  assert.equal(summary.count, 24);

  const bySlug = Object.fromEntries(summary.results.map((r) => [r.slug, r]));
  const expectedAttacks = { 1: -101, 2: -201, 3: -301, 4: -401 };
  for (const slug of [
    "buildos_enclave_attest_zeroc",
    "buildos_pq_hybrid_kem_zeroc",
    "buildos_quic_zero_copy_net_zeroc",
    "buildos_wasm_cap_vm_zeroc",
  ]) {
    assert.equal(bySlug[slug].ok, true, `${slug} failed`);
    assert.equal(bySlug[slug].imports, 0, `${slug} must have 0 host imports`);
    assert.deepEqual(bySlug[slug].attacks, expectedAttacks, `${slug} attack trap mismatch`);
  }
});

test("3/3 planted fail-closed V6 controls reject corrupted magic, tampered SHA-256, and 1-byte tamper", async () => {
  const badMagic = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x01, 0x00, 0x00, 0x00]);
  const badMagicSha = await sha256Hex(badMagic);
  await assert.rejects(
    () => loadVerifiedWasm(badMagic, badMagicSha),
    (err) => err instanceof WasmBridgeError && err.code === "invalid_wasm_magic",
  );

  const pqMod = MANIFEST.modules.find((m) => m.slug === "buildos_pq_hybrid_kem_zeroc");
  const pqBytes = readFileSync(join(ROOT, pqMod.wasm_path));
  const flippedSha = (pqMod.sha256[0] === "0" ? "1" : "0") + pqMod.sha256.slice(1);
  await assert.rejects(
    () => loadVerifiedWasm(pqBytes, flippedSha),
    (err) => err instanceof WasmBridgeError && err.code === "sha256_mismatch",
  );

  const vmMod = MANIFEST.modules.find((m) => m.slug === "buildos_wasm_cap_vm_zeroc");
  const vmBytes = readFileSync(join(ROOT, vmMod.wasm_path));
  const mutated = new Uint8Array(vmBytes);
  mutated[mutated.length - 1] ^= 0x01;
  await assert.rejects(
    () => loadVerifiedWasm(mutated, vmMod.sha256),
    (err) => err instanceof WasmBridgeError && err.code === "sha256_mismatch",
  );
});
