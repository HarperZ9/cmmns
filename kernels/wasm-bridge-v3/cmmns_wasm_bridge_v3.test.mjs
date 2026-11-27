// SPDX-FileCopyrightText: 2026 Zain Dana Harper and the CMMNS contributors
// SPDX-License-Identifier: MIT
//
// Live Node/V8 WebAssembly verification tests for the Wave 105A CMMNS WASM Bridge V3.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  WasmBridgeError,
  loadVerifiedWasm,
  runAllBridgeV3Verifiers,
  sha256Hex,
} from "./cmmns_wasm_bridge_v3.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const MANIFEST = JSON.parse(readFileSync(join(ROOT, "wasm_bridge_v3_manifest.json"), "utf8"));

test("V3 bridge is zero-dependency, browser-compatible, and all 12 MIT WASM modules fit <= 75 KB", () => {
  const src = readFileSync(join(ROOT, "cmmns_wasm_bridge_v3.mjs"), "utf8");
  const lines = src.split(/\r?\n/).length;
  assert.ok(lines <= 250, `cmmns_wasm_bridge_v3.mjs has ${lines} lines (> 250)`);
  assert.match(src, /SPDX-License-Identifier:\s*MIT/);
  assert.doesNotMatch(src, /from\s+["']node:/, "Bridge must have zero Node-only imports");
  assert.doesNotMatch(src, /\bfetch\s*\(|XMLHttpRequest|WebSocket/, "Bridge must make zero network calls");
  assert.doesNotMatch(src, /[\u2013\u2014]/, "Bridge must contain zero em/en dashes");
  assert.doesNotMatch(src, /[A-Za-z]:\\|\/Users\/|\/home\//, "Bridge must contain zero local paths");

  assert.equal(MANIFEST.modules.length, 12);
  let totalBytes = 0;
  for (const mod of MANIFEST.modules) {
    const buf = readFileSync(join(ROOT, mod.wasm_path));
    assert.equal(buf.byteLength, mod.bytes, `${mod.slug} byte count mismatch`);
    assert.ok(buf.byteLength <= 16 * 1024, `${mod.slug} exceeds 16 KB (${buf.byteLength})`);
    totalBytes += buf.byteLength;
  }
  assert.equal(totalBytes, MANIFEST.total_bytes);
  assert.ok(totalBytes <= 75 * 1024, `Total WASM size ${totalBytes} exceeds 75 KB`);
});

test("all 12/12 MIT CMMNS V3 WASM kernels (crypto triad + TLS + BFT quorum + survival + gates) pass in V8", async () => {
  const summary = await runAllBridgeV3Verifiers(MANIFEST, (relPath) => readFileSync(join(ROOT, relPath)));
  assert.equal(summary.ok, true);
  assert.equal(summary.count, 12);

  const bySlug = Object.fromEntries(summary.results.map((r) => [r.slug, r]));
  assert.equal(bySlug.x25519_curve25519_zeroc.imports, 0);
  assert.equal(bySlug.tls_mini_handshake_zeroc.imports, 0);
  assert.equal(bySlug.tls_mini_handshake_zeroc.mitmRc, -101);
  assert.equal(bySlug.tls_mini_handshake_zeroc.tamperRc, -201);
  assert.equal(bySlug.cmmns_evidence_quorum.pinHex, "834a66c94b8b1a7d87a3a199cb5bc8f8af6759c35c1df67ceef6f84b9aec7f0c");
  assert.ok(Math.abs(bySlug.cmmns_citation_decay.sQuad - 0.996396682) < 1e-6);
  assert.equal(bySlug.cmmns_attention_valve.darkScore, 9);
  assert.equal(bySlug.cmmns_attention_valve.rampActive, 1);
});

test("3/3 planted fail-closed bridge controls reject corrupted magic, tampered SHA-256, and 1-byte tamper", async () => {
  // Control 1: Corrupted WASM magic (even with valid SHA-256) rejected fail-closed
  const badMagic = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x01, 0x00, 0x00, 0x00]);
  const badMagicSha = await sha256Hex(badMagic);
  await assert.rejects(
    () => loadVerifiedWasm(badMagic, badMagicSha),
    (err) => err instanceof WasmBridgeError && err.code === "invalid_wasm_magic",
  );
  await assert.rejects(
    () => WebAssembly.compile(badMagic),
    (err) => err instanceof WebAssembly.CompileError,
  );

  // Control 2: 1-hex-char tampered SHA-256 on tls_mini_handshake_zeroc rejected before compile
  const tlsMod = MANIFEST.modules.find((m) => m.slug === "tls_mini_handshake_zeroc");
  const tlsBytes = readFileSync(join(ROOT, tlsMod.wasm_path));
  const flippedSha = (tlsMod.sha256[0] === "0" ? "1" : "0") + tlsMod.sha256.slice(1);
  await assert.rejects(
    () => loadVerifiedWasm(tlsBytes, flippedSha),
    (err) => err instanceof WasmBridgeError && err.code === "sha256_mismatch",
  );

  // Control 3: 1-byte buffer mutation on cmmns_evidence_quorum rejected before compile
  const qMod = MANIFEST.modules.find((m) => m.slug === "cmmns_evidence_quorum");
  const qBytes = readFileSync(join(ROOT, qMod.wasm_path));
  const mutated = new Uint8Array(qBytes);
  mutated[mutated.length - 1] ^= 0x01;
  await assert.rejects(
    () => loadVerifiedWasm(mutated, qMod.sha256),
    (err) => err instanceof WasmBridgeError && err.code === "sha256_mismatch",
  );
});
