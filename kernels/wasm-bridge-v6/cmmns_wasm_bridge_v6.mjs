// SPDX-FileCopyrightText: 2026 Zain Dana Harper and the CMMNS contributors
// SPDX-License-Identifier: MIT
//
// CMMNS Browser + Node V8 WebAssembly Verification Bridge V6 (24 MIT kernels <= 300 KB).
// Zero Node-only imports, zero network calls, WebCrypto SHA-256 verification before compile.
// Reuses all 20 V5 verifiers and adds 4 Zero-C 0-import BuildOS security modules:
// Confidential Enclave (Slice 28), PQ Hybrid KEM (Slice 29), QUIC Firewall (Slice 31),
// and Capability Sandbox VM (Slice 32), verifying 16/16 live fail-closed attacks.
import {
  WasmBridgeError,
  hasWasmMagic,
  loadVerifiedWasm,
  runAllBridgeV5Verifiers,
  sha256Hex,
  toUint8Array,
} from "../wasm-bridge-v5/cmmns_wasm_bridge_v5.mjs";

export { WasmBridgeError, hasWasmMagic, loadVerifiedWasm, sha256Hex, toUint8Array };

async function runZeroCAttacks(mod, fnName, modes) {
  const out = {};
  for (const m of modes) {
    const inst = await WebAssembly.instantiate(mod, {});
    out[m] = Number(inst.exports[fnName](BigInt(m)));
  }
  return out;
}

const V6_SPECS = {
  buildos_enclave_attest_zeroc: {
    fn: "enclave_attest_run",
    count: 23,
    headLen: 5,
    head: "1,1,28,42,5",
  },
  buildos_pq_hybrid_kem_zeroc: {
    fn: "pq_hybrid_kem_run",
    count: 23,
    headLen: 5,
    head: "1,1,3329,256,2",
  },
  buildos_quic_zero_copy_net_zeroc: {
    fn: "quic_stage1_transport_firewall",
    count: 25,
    headLen: 7,
    head: "1,1,8,5550,4950,107,255",
  },
  buildos_wasm_cap_vm_zeroc: {
    fn: "vm_stage1_execute",
    count: 23,
    headLen: 5,
    head: "1,1,512,447,3",
  },
};

async function verifyV6Extension(slug, loaded) {
  const spec = V6_SPECS[slug];
  if (!spec) {
    throw new WasmBridgeError("unknown_module", `Unknown V6 extension module: ${slug}`);
  }
  const ex = loaded.exports;
  const count = Number(ex.main());
  const mem = new BigInt64Array(ex.memory.buffer);
  const head = [];
  for (let i = 1; i <= spec.headLen; i++) head.push(Number(mem[i]));
  const attacks = await runZeroCAttacks(loaded.module, spec.fn, [1, 2, 3, 4]);
  const ok = loaded.imports.length === 0
    && count === spec.count
    && head.join(",") === spec.head
    && attacks[1] === -101
    && attacks[2] === -201
    && attacks[3] === -301
    && attacks[4] === -401;
  return { ok, count, head, attacks };
}

const V6_EXTENSIONS = new Set(Object.keys(V6_SPECS));

export async function runAllBridgeV6Verifiers(manifest, readBytesFn) {
  const v5Mods = manifest.modules.filter((m) => !V6_EXTENSIONS.has(m.slug));
  const v6Mods = manifest.modules.filter((m) => V6_EXTENSIONS.has(m.slug));
  const v5Summary = await runAllBridgeV5Verifiers({ ...manifest, modules: v5Mods }, readBytesFn);
  const results = [...v5Summary.results];
  for (const mod of v6Mods) {
    const raw = await readBytesFn(mod.wasm_path);
    const loaded = await loadVerifiedWasm(raw, mod.sha256);
    const out = await verifyV6Extension(mod.slug, loaded);
    results.push({ slug: mod.slug, bytes: loaded.bytes, imports: loaded.imports.length, sha256: loaded.sha256, ...out });
  }
  return { ok: results.every((r) => r.ok), count: results.length, results };
}
