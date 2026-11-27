// SPDX-FileCopyrightText: 2026 Zain Dana Harper and the CMMNS contributors
// SPDX-License-Identifier: MIT
//
// Live Node/V8 WebAssembly verification tests for the Wave 165A CMMNS WASM Bridge V8.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXPECTED_HSM_ROOT,
  EXPECTED_PALETTELIGHT_HASH,
  EXPECTED_RAID_ROOT,
  WasmBridgeError,
  loadVerifiedWasm,
  runAllBridgeV8Verifiers,
  sha256Hex,
} from "./cmmns_wasm_bridge_v8.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const MANIFEST = JSON.parse(readFileSync(join(ROOT, "wasm_bridge_v8_manifest.json"), "utf8"));

test("V8 bridge is zero-dependency, browser-compatible, and all 32 MIT WASM modules fit <= 625 KB", () => {
  const src = readFileSync(join(ROOT, "cmmns_wasm_bridge_v8.mjs"), "utf8");
  const lines = src.split(/\r?\n/).length;
  assert.ok(lines <= 160, `cmmns_wasm_bridge_v8.mjs has ${lines} lines (> 160)`);
  assert.match(src, /SPDX-License-Identifier:\s*MIT/);
  assert.doesNotMatch(src, /from\s+["']node:/, "Bridge must have zero Node-only imports");
  assert.doesNotMatch(src, /\bfetch\s*\(|XMLHttpRequest|WebSocket/, "Bridge must make zero network calls");
  assert.doesNotMatch(src, /[\u2013\u2014]/, "Bridge must contain zero em/en dashes");
  assert.doesNotMatch(src, /[A-Za-z]:\\|\/Users\/|\/home\//, "Bridge must contain zero local paths");

  assert.equal(MANIFEST.modules.length, 32);
  let totalBytes = 0;
  for (const mod of MANIFEST.modules) {
    const buf = readFileSync(join(ROOT, mod.wasm_path));
    assert.equal(buf.byteLength, mod.bytes, `${mod.slug} byte count mismatch`);
    totalBytes += buf.byteLength;
  }
  assert.equal(totalBytes, MANIFEST.total_bytes);
  assert.ok(totalBytes <= 625 * 1024, `Total WASM size ${totalBytes} exceeds 625 KB`);
});

test("all 32/32 MIT CMMNS V8 WASM kernels pass in V8 with 10/10 V8 traps, exact roots, and 0-ULP PaletteLight hash", async () => {
  const summary = await runAllBridgeV8Verifiers(MANIFEST, (relPath) => readFileSync(join(ROOT, relPath)));
  assert.equal(summary.ok, true);
  assert.equal(summary.count, 32);

  const bySlug = Object.fromEntries(summary.results.map((r) => [r.slug, r]));
  assert.equal(bySlug.buildos_shamir_threshold_hsm_zeroc.imports, 0);
  assert.equal(bySlug.buildos_shamir_threshold_hsm_zeroc.rootHex, EXPECTED_HSM_ROOT);
  assert.deepEqual(bySlug.buildos_shamir_threshold_hsm_zeroc.attacks, { 1: -101, 2: -201, 3: -301, 4: -401 });

  assert.equal(bySlug.buildos_erasure_coded_raid_fs_zeroc.imports, 0);
  assert.equal(bySlug.buildos_erasure_coded_raid_fs_zeroc.rootHex, EXPECTED_RAID_ROOT);
  assert.deepEqual(bySlug.buildos_erasure_coded_raid_fs_zeroc.attacks, { 1: -101, 2: -201, 3: -301, 4: -401 });

  assert.equal(bySlug.titan_rsi_pareto_orchestrator.goodhartTrapsBlocked, 40);
  assert.equal(bySlug.titan_rsi_pareto_orchestrator.regressions, 0);
  assert.equal(bySlug.titan_rsi_pareto_orchestrator.paretoHash, 1468869863);
  assert.deepEqual(bySlug.titan_rsi_pareto_orchestrator.attacks, { 1: -101, 2: -201 });

  assert.equal(bySlug.superframe_art_palettelight.paletteHash, EXPECTED_PALETTELIGHT_HASH);
});

test("3/3 planted fail-closed V8 controls reject corrupted magic, tampered SHA-256, and 1-byte tamper", async () => {
  const badMagic = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x01, 0x00, 0x00, 0x00]);
  const badMagicSha = await sha256Hex(badMagic);
  await assert.rejects(
    () => loadVerifiedWasm(badMagic, badMagicSha),
    (err) => err instanceof WasmBridgeError && err.code === "invalid_wasm_magic",
  );

  const hsmMod = MANIFEST.modules.find((m) => m.slug === "buildos_shamir_threshold_hsm_zeroc");
  const hsmBytes = readFileSync(join(ROOT, hsmMod.wasm_path));
  const flippedSha = (hsmMod.sha256[0] === "0" ? "1" : "0") + hsmMod.sha256.slice(1);
  await assert.rejects(
    () => loadVerifiedWasm(hsmBytes, flippedSha),
    (err) => err instanceof WasmBridgeError && err.code === "sha256_mismatch",
  );

  const raidMod = MANIFEST.modules.find((m) => m.slug === "buildos_erasure_coded_raid_fs_zeroc");
  const raidBytes = readFileSync(join(ROOT, raidMod.wasm_path));
  const mutated = new Uint8Array(raidBytes);
  mutated[mutated.length - 1] ^= 0x01;
  await assert.rejects(
    () => loadVerifiedWasm(mutated, raidMod.sha256),
    (err) => err instanceof WasmBridgeError && err.code === "sha256_mismatch",
  );
});
