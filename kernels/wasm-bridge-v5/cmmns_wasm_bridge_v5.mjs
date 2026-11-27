// SPDX-FileCopyrightText: 2026 Zain Dana Harper and the CMMNS contributors
// SPDX-License-Identifier: MIT
//
// CMMNS Browser + Node V8 WebAssembly Verification Bridge V5 (20 MIT kernels <= 225 KB).
// Zero Node-only imports, zero network calls, WebCrypto SHA-256 verification before compile.
// Reuses all 16 V4 verifiers and adds 3 Zero-C 0-import BuildOS modules (Slices 24, 25, 26)
// plus the CS-031 1,000-module automated port-equivalence verifier.
import {
  WasmBridgeError,
  hasWasmMagic,
  loadVerifiedWasm,
  runAllBridgeV4Verifiers,
  sha256Hex,
  toUint8Array,
} from "../wasm-bridge-v4/cmmns_wasm_bridge_v4.mjs";

export { WasmBridgeError, hasWasmMagic, loadVerifiedWasm, sha256Hex, toUint8Array };

async function runZeroCAttacks(mod, fnName, modes) {
  const out = {};
  for (const m of modes) {
    const inst = await WebAssembly.instantiate(mod, {});
    out[m] = Number(inst.exports[fnName](BigInt(m)));
  }
  return out;
}

async function verifyV5Extension(slug, loaded) {
  const ex = loaded.exports;
  if (slug === "buildos_v1_unified_zeroc") {
    const count = Number(ex.main());
    const mem = new BigInt64Array(ex.memory.buffer);
    const head = [1, 2, 3, 4].map((i) => Number(mem[i]));
    const attacks = await runZeroCAttacks(loaded.module, "buildos_v1_run", [1, 2, 3, 4, 5, 6]);
    const ok = loaded.imports.length === 0 && count === 19
      && head.join(",") === "1,1,7,5"
      && attacks[1] === -101 && attacks[2] === -201 && attacks[3] === -301
      && attacks[4] === -401 && attacks[5] === -501 && attacks[6] === -601;
    return { ok, count, head, attacks };
  }
  if (slug === "buildos_smp_mmu_zeroc") {
    const count = Number(ex.main());
    const mem = new BigInt64Array(ex.memory.buffer);
    const head = [1, 2, 3, 4, 5, 6, 7].map((i) => Number(mem[i]));
    const attacks = await runZeroCAttacks(loaded.module, "smp_mmu_run", [1, 2, 3, 4]);
    const ok = loaded.imports.length === 0 && count === 23
      && head.join(",") === "1,1,4,16,8,8,8"
      && attacks[1] === -101 && attacks[2] === -201 && attacks[3] === -301 && attacks[4] === -401;
    return { ok, count, head, attacks };
  }
  if (slug === "buildos_iommu_nvme_zeroc") {
    const count = Number(ex.main());
    const mem = new BigInt64Array(ex.memory.buffer);
    const head = [1, 2, 3, 4, 5, 6, 7].map((i) => Number(mem[i]));
    const attacks = await runZeroCAttacks(loaded.module, "iommu_nvme_run", [1, 2, 3, 4]);
    const ok = loaded.imports.length === 0 && count === 23
      && head.join(",") === "1,1,4,4,4,8,20"
      && attacks[1] === -101 && attacks[2] === -201 && attacks[3] === -301 && attacks[4] === -401;
    return { ok, count, head, attacks };
  }
  if (slug === "cs031_automated_port_verifier") {
    const cleanPorts = ex.cs031_metric(0);
    const maxErr = ex.cs031_metric(1);
    const planted = ex.cs031_metric(2);
    const detected = ex.cs031_metric(3);
    const eqOk = ex.validate_port_equivalence(1.25, 1.25, 1e-12);
    const eqBad = ex.validate_port_equivalence(1.25, 1.5, 1e-12);
    const effOk = ex.validate_effect_subset(7, 3);
    const effBad = ex.validate_effect_subset(3, 7);
    const ok = cleanPorts === 1000 && maxErr === 0.0 && planted === 50 && detected === 50
      && eqOk === 0 && eqBad === -311 && effOk === 0 && effBad === -312;
    return { ok, cleanPorts, maxErr, planted, detected, eqBad, effBad };
  }
  throw new WasmBridgeError("unknown_module", `Unknown V5 extension module: ${slug}`);
}

const V5_EXTENSIONS = new Set([
  "buildos_v1_unified_zeroc",
  "buildos_smp_mmu_zeroc",
  "buildos_iommu_nvme_zeroc",
  "cs031_automated_port_verifier",
]);

export async function runAllBridgeV5Verifiers(manifest, readBytesFn) {
  const v4Mods = manifest.modules.filter((m) => !V5_EXTENSIONS.has(m.slug));
  const v5Mods = manifest.modules.filter((m) => V5_EXTENSIONS.has(m.slug));
  const v4Summary = await runAllBridgeV4Verifiers({ ...manifest, modules: v4Mods }, readBytesFn);
  const results = [...v4Summary.results];
  for (const mod of v5Mods) {
    const raw = await readBytesFn(mod.wasm_path);
    const loaded = await loadVerifiedWasm(raw, mod.sha256);
    const out = await verifyV5Extension(mod.slug, loaded);
    results.push({ slug: mod.slug, bytes: loaded.bytes, imports: loaded.imports.length, sha256: loaded.sha256, ...out });
  }
  return { ok: results.every((r) => r.ok), count: results.length, results };
}
