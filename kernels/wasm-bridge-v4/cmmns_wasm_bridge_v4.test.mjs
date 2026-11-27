// SPDX-FileCopyrightText: 2026 Zain Dana Harper and the CMMNS contributors
// SPDX-License-Identifier: MIT
//
// Live Node/V8 WebAssembly verification tests for the Wave 116F CMMNS WASM Bridge V4.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  WasmBridgeError,
  loadVerifiedWasm,
  runAllBridgeV4Verifiers,
  sha256Hex,
} from "./cmmns_wasm_bridge_v4.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const MANIFEST = JSON.parse(readFileSync(join(ROOT, "wasm_bridge_v4_manifest.json"), "utf8"));

test("V4 bridge is zero-dependency, browser-compatible, and all 16 MIT WASM modules fit <= 125 KB", () => {
  const src = readFileSync(join(ROOT, "cmmns_wasm_bridge_v4.mjs"), "utf8");
  const lines = src.split(/\r?\n/).length;
  assert.ok(lines <= 160, `cmmns_wasm_bridge_v4.mjs has ${lines} lines (> 160)`);
  assert.match(src, /SPDX-License-Identifier:\s*MIT/);
  assert.doesNotMatch(src, /from\s+["']node:/, "Bridge must have zero Node-only imports");
  assert.doesNotMatch(src, /\bfetch\s*\(|XMLHttpRequest|WebSocket/, "Bridge must make zero network calls");
  assert.doesNotMatch(src, /[\u2013\u2014]/, "Bridge must contain zero em/en dashes");
  assert.doesNotMatch(src, /[A-Za-z]:\\|\/Users\/|\/home\//, "Bridge must contain zero local paths");

  assert.equal(MANIFEST.modules.length, 16);
  let totalBytes = 0;
  for (const mod of MANIFEST.modules) {
    const buf = readFileSync(join(ROOT, mod.wasm_path));
    assert.equal(buf.byteLength, mod.bytes, `${mod.slug} byte count mismatch`);
    assert.ok(buf.byteLength <= 24 * 1024, `${mod.slug} exceeds 24 KB (${buf.byteLength})`);
    totalBytes += buf.byteLength;
  }
  assert.equal(totalBytes, MANIFEST.total_bytes);
  assert.ok(totalBytes <= 125 * 1024, `Total WASM size ${totalBytes} exceeds 125 KB`);
});

test("all 16/16 MIT CMMNS V4 WASM kernels (12 V3 + 3 Zero-C BuildOS + CS-024 tail audit) pass in V8", async () => {
  const summary = await runAllBridgeV4Verifiers(MANIFEST, (relPath) => readFileSync(join(ROOT, relPath)));
  assert.equal(summary.ok, true);
  assert.equal(summary.count, 16);

  const bySlug = Object.fromEntries(summary.results.map((r) => [r.slug, r]));
  assert.equal(bySlug.buildos_e2e_triad_zeroc.imports, 0);
  assert.deepEqual(bySlug.buildos_e2e_triad_zeroc.attacks, { 1: -101, 2: -201, 3: -301, 4: -401 });
  assert.equal(bySlug.buildos_compositor_zeroc.imports, 0);
  assert.deepEqual(bySlug.buildos_compositor_zeroc.attacks, { 1: -101, 2: -201, 3: -301, 4: -401 });
  assert.equal(bySlug.buildos_input_audio_zeroc.imports, 0);
  assert.deepEqual(bySlug.buildos_input_audio_zeroc.attacks, { 1: -101, 2: -201, 3: -301, 4: -401 });
  assert.equal(bySlug.cs024_posterior_rare_tail_audit.probBad, -241);
  assert.equal(bySlug.cs024_posterior_rare_tail_audit.martBad, -242);
});

test("3/3 planted fail-closed V4 controls reject corrupted magic, tampered SHA-256, and 1-byte tamper", async () => {
  const badMagic = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x01, 0x00, 0x00, 0x00]);
  const badMagicSha = await sha256Hex(badMagic);
  await assert.rejects(
    () => loadVerifiedWasm(badMagic, badMagicSha),
    (err) => err instanceof WasmBridgeError && err.code === "invalid_wasm_magic",
  );

  const compMod = MANIFEST.modules.find((m) => m.slug === "buildos_compositor_zeroc");
  const compBytes = readFileSync(join(ROOT, compMod.wasm_path));
  const flippedSha = (compMod.sha256[0] === "0" ? "1" : "0") + compMod.sha256.slice(1);
  await assert.rejects(
    () => loadVerifiedWasm(compBytes, flippedSha),
    (err) => err instanceof WasmBridgeError && err.code === "sha256_mismatch",
  );

  const ioMod = MANIFEST.modules.find((m) => m.slug === "buildos_input_audio_zeroc");
  const ioBytes = readFileSync(join(ROOT, ioMod.wasm_path));
  const mutated = new Uint8Array(ioBytes);
  mutated[mutated.length - 1] ^= 0x01;
  await assert.rejects(
    () => loadVerifiedWasm(mutated, ioMod.sha256),
    (err) => err instanceof WasmBridgeError && err.code === "sha256_mismatch",
  );
});
