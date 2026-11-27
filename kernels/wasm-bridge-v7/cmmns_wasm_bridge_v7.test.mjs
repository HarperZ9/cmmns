// SPDX-FileCopyrightText: 2026 Zain Dana Harper and the CMMNS contributors
// SPDX-License-Identifier: MIT
//
// Live Node/V8 WebAssembly verification tests for the Wave 155A CMMNS WASM Bridge V7.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXPECTED_V2_SOVEREIGN_ROOT,
  WasmBridgeError,
  loadVerifiedWasm,
  runAllBridgeV7Verifiers,
  sha256Hex,
} from "./cmmns_wasm_bridge_v7.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const MANIFEST = JSON.parse(readFileSync(join(ROOT, "wasm_bridge_v7_manifest.json"), "utf8"));

test("V7 bridge is zero-dependency, browser-compatible, and all 28 MIT WASM modules fit <= 575 KB", () => {
  const src = readFileSync(join(ROOT, "cmmns_wasm_bridge_v7.mjs"), "utf8");
  const lines = src.split(/\r?\n/).length;
  assert.ok(lines <= 160, `cmmns_wasm_bridge_v7.mjs has ${lines} lines (> 160)`);
  assert.match(src, /SPDX-License-Identifier:\s*MIT/);
  assert.doesNotMatch(src, /from\s+["']node:/, "Bridge must have zero Node-only imports");
  assert.doesNotMatch(src, /\bfetch\s*\(|XMLHttpRequest|WebSocket/, "Bridge must make zero network calls");
  assert.doesNotMatch(src, /[\u2013\u2014]/, "Bridge must contain zero em/en dashes");
  assert.doesNotMatch(src, /[A-Za-z]:\\|\/Users\/|\/home\//, "Bridge must contain zero local paths");

  assert.equal(MANIFEST.modules.length, 28);
  let totalBytes = 0;
  for (const mod of MANIFEST.modules) {
    const buf = readFileSync(join(ROOT, mod.wasm_path));
    assert.equal(buf.byteLength, mod.bytes, `${mod.slug} byte count mismatch`);
    totalBytes += buf.byteLength;
  }
  assert.equal(totalBytes, MANIFEST.total_bytes);
  assert.ok(totalBytes <= 575 * 1024, `Total WASM size ${totalBytes} exceeds 575 KB`);
});

test("all 28/28 MIT CMMNS V7 WASM kernels pass in V8 with 22/22 V7 attacks trapped and exact BuildOS-2.0 root", async () => {
  const summary = await runAllBridgeV7Verifiers(MANIFEST, (relPath) => readFileSync(join(ROOT, relPath)));
  assert.equal(summary.ok, true);
  assert.equal(summary.count, 28);

  const bySlug = Object.fromEntries(summary.results.map((r) => [r.slug, r]));
  assert.equal(bySlug.buildos_bft_consensus_ledger_zeroc.imports, 0);
  assert.deepEqual(bySlug.buildos_bft_consensus_ledger_zeroc.attacks, { 1: -101, 2: -201, 3: -301, 4: -401 });
  assert.equal(bySlug.buildos_zk_pedersen_merkle_zeroc.imports, 0);
  assert.deepEqual(bySlug.buildos_zk_pedersen_merkle_zeroc.attacks, { 1: -101, 2: -201, 3: -301, 4: -401 });
  assert.equal(bySlug.buildos_v2_distributed_sovereign_zeroc.imports, 0);
  assert.deepEqual(bySlug.buildos_v2_distributed_sovereign_zeroc.attacks, { 1: -101, 2: -201, 3: -301, 4: -401, 5: -501, 6: -601 });
  assert.equal(bySlug.buildos_v2_sovereign_zeroc.imports, 0);
  assert.equal(bySlug.buildos_v2_sovereign_zeroc.sovereignRoot, EXPECTED_V2_SOVEREIGN_ROOT);
  assert.deepEqual(bySlug.buildos_v2_sovereign_zeroc.attacks, {
    1: -101, 2: -201, 3: -301, 4: -401, 5: -501, 6: -601, 7: -701, 8: -801,
  });
});

test("3/3 planted fail-closed V7 controls reject corrupted magic, tampered SHA-256, and 1-byte tamper", async () => {
  const badMagic = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x01, 0x00, 0x00, 0x00]);
  const badMagicSha = await sha256Hex(badMagic);
  await assert.rejects(
    () => loadVerifiedWasm(badMagic, badMagicSha),
    (err) => err instanceof WasmBridgeError && err.code === "invalid_wasm_magic",
  );

  const bftMod = MANIFEST.modules.find((m) => m.slug === "buildos_bft_consensus_ledger_zeroc");
  const bftBytes = readFileSync(join(ROOT, bftMod.wasm_path));
  const flippedSha = (bftMod.sha256[0] === "0" ? "1" : "0") + bftMod.sha256.slice(1);
  await assert.rejects(
    () => loadVerifiedWasm(bftBytes, flippedSha),
    (err) => err instanceof WasmBridgeError && err.code === "sha256_mismatch",
  );

  const v2Mod = MANIFEST.modules.find((m) => m.slug === "buildos_v2_sovereign_zeroc");
  const v2Bytes = readFileSync(join(ROOT, v2Mod.wasm_path));
  const mutated = new Uint8Array(v2Bytes);
  mutated[mutated.length - 1] ^= 0x01;
  await assert.rejects(
    () => loadVerifiedWasm(mutated, v2Mod.sha256),
    (err) => err instanceof WasmBridgeError && err.code === "sha256_mismatch",
  );
});
