// SPDX-FileCopyrightText: 2026 Zain Dana Harper and the CMMNS contributors
// SPDX-License-Identifier: MIT
//
// CMMNS Browser + Node V8 WebAssembly Verification Bridge V7 (28 MIT kernels <= 575 KB).
// Zero Node-only imports, zero network calls, WebCrypto SHA-256 verification before compile.
// Reuses all 24 V6 verifiers and adds 4 Zero-C 0-import sovereign modules:
// BFT Consensus Ledger (Slice 33), Curve25519 Pedersen/Schnorr ZK (Slice 34),
// BuildOS-2.1 Distributed Cluster (Slice 35), and Unified BuildOS-2.0 Kernel (Slice 30),
// verifying 22/22 live fail-closed attacks plus the 12-leaf RFC 6962 Sovereign Root.
import {
  WasmBridgeError,
  hasWasmMagic,
  loadVerifiedWasm,
  runAllBridgeV6Verifiers,
  sha256Hex,
  toUint8Array,
} from "../wasm-bridge-v6/cmmns_wasm_bridge_v6.mjs";

export { WasmBridgeError, hasWasmMagic, loadVerifiedWasm, sha256Hex, toUint8Array };

export const EXPECTED_V2_SOVEREIGN_ROOT = "b0169274ea5bb300813d8d409c1098cbd92cb7490dcaf3fe30865b15eddc393f";

async function runZeroCAttacks(mod, fnName, modes) {
  const out = {};
  for (const m of modes) {
    const inst = await WebAssembly.instantiate(mod, {});
    out[m] = Number(inst.exports[fnName](BigInt(m)));
  }
  return out;
}

const V7_SPECS = {
  buildos_bft_consensus_ledger_zeroc: {
    fn: "bft_consensus_run",
    count: 24,
    headLen: 5,
    head: "1,1,4,3,3",
    modes: [1, 2, 3, 4],
  },
  buildos_zk_pedersen_merkle_zeroc: {
    fn: "zk_pedersen_run",
    count: 26,
    headLen: 6,
    head: "1,1,0,1000,625,375",
    modes: [1, 2, 3, 4],
  },
  buildos_v2_distributed_sovereign_zeroc: {
    fn: "buildos_v21_cluster_run",
    count: 20,
    headLen: 6,
    head: "1,1,4,7,512,447",
    modes: [1, 2, 3, 4, 5, 6],
  },
  buildos_v2_sovereign_zeroc: {
    fn: "buildos_v2_run",
    count: 22,
    headLen: 6,
    head: "1,1,12,3,4,3329",
    modes: [1, 2, 3, 4, 5, 6, 7, 8],
    checkRoot: true,
  },
};

async function verifyV7Extension(slug, loaded) {
  const spec = V7_SPECS[slug];
  if (!spec) {
    throw new WasmBridgeError("unknown_module", `Unknown V7 extension module: ${slug}`);
  }
  const ex = loaded.exports;
  const count = Number(ex.main());
  const mem = new BigInt64Array(ex.memory.buffer);
  const head = [];
  for (let i = 1; i <= spec.headLen; i++) head.push(Number(mem[i]));
  let sovereignRoot = null;
  if (spec.checkRoot) {
    sovereignRoot = "";
    for (let i = 15; i <= 22; i++) {
      sovereignRoot += (Number(mem[i]) >>> 0).toString(16).padStart(8, "0");
    }
  }
  const attacks = await runZeroCAttacks(loaded.module, spec.fn, spec.modes);
  const attacksOk = spec.modes.every((m) => attacks[m] === -(m * 100 + 1));
  const rootOk = !spec.checkRoot || sovereignRoot === EXPECTED_V2_SOVEREIGN_ROOT;
  const ok = loaded.imports.length === 0
    && count === spec.count
    && head.join(",") === spec.head
    && attacksOk
    && rootOk;
  return { ok, count, head, attacks, ...(sovereignRoot ? { sovereignRoot } : {}) };
}

const V7_EXTENSIONS = new Set(Object.keys(V7_SPECS));

export async function runAllBridgeV7Verifiers(manifest, readBytesFn) {
  const v6Mods = manifest.modules.filter((m) => !V7_EXTENSIONS.has(m.slug));
  const v7Mods = manifest.modules.filter((m) => V7_EXTENSIONS.has(m.slug));
  const v6Summary = await runAllBridgeV6Verifiers({ ...manifest, modules: v6Mods }, readBytesFn);
  const results = [...v6Summary.results];
  for (const mod of v7Mods) {
    const raw = await readBytesFn(mod.wasm_path);
    const loaded = await loadVerifiedWasm(raw, mod.sha256);
    const out = await verifyV7Extension(mod.slug, loaded);
    results.push({ slug: mod.slug, bytes: loaded.bytes, imports: loaded.imports.length, sha256: loaded.sha256, ...out });
  }
  return { ok: results.every((r) => r.ok), count: results.length, results };
}
