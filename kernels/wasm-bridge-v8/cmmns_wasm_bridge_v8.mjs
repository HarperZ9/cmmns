// SPDX-FileCopyrightText: 2026 Zain Dana Harper and the CMMNS contributors
// SPDX-License-Identifier: MIT
//
// CMMNS Browser + Node V8 WebAssembly Verification Bridge V8 (32 MIT kernels <= 625 KB).
// Zero Node-only imports, zero network calls, WebCrypto SHA-256 verification before compile.
// Reuses all 28 V7 verifiers and adds 4 pure-OSI MIT modules:
// Slice 36 (3,5) Shamir Threshold HSM (0 imports), Slice 37 RS(4,2) RAID-6 FS (0 imports),
// Titan Oracle-Gated RSI Pareto Orchestrator (5 no-op print stubs), and
// Superframe PaletteLight Renderer Module #34 (5 no-op print stubs, 0-ULP C++23 parity).
import {
  WasmBridgeError,
  hasWasmMagic,
  loadVerifiedWasm,
  runAllBridgeV7Verifiers,
  sha256Hex,
  toUint8Array,
} from "../wasm-bridge-v7/cmmns_wasm_bridge_v7.mjs";

export { WasmBridgeError, hasWasmMagic, loadVerifiedWasm, sha256Hex, toUint8Array };

export const EXPECTED_HSM_ROOT = "0b8beced748fd9708385180f42c36f74fad38ed16bf745c6e2d0cd6698caba7c";
export const EXPECTED_RAID_ROOT = "8050f7383227a958ec45a50716a9545d526b55bc16fd06911976db045d52c8f0";
export const EXPECTED_PALETTELIGHT_HASH = "0xf692a347dda950e0";

const PRINT_ONLY_NAMES = new Set(["print_i64", "print_u64", "print_f64", "print_bool", "print_str"]);

function isPrintOnlyImports(mod) {
  return WebAssembly.Module.imports(mod).every((imp) => imp.module === "env" && PRINT_ONLY_NAMES.has(imp.name));
}

async function runZeroCAttacks(mod, fnName, modes) {
  const out = {};
  for (const m of modes) {
    const inst = await WebAssembly.instantiate(mod, {});
    out[m] = Number(inst.exports[fnName](BigInt(m)));
  }
  return out;
}

function readRootWords(mem, startIdx) {
  let hex = "";
  for (let i = startIdx; i < startIdx + 8; i++) {
    hex += (Number(mem[i]) >>> 0).toString(16).padStart(8, "0");
  }
  return hex;
}

const ZEROC_V8_SPECS = {
  buildos_shamir_threshold_hsm_zeroc: {
    fn: "hsm_stage1_execute",
    count: 24,
    headLen: 6,
    head: "1,1,3,5,2147483647,98784247763",
    rootIdx: 17,
    expectedRoot: EXPECTED_HSM_ROOT,
    modes: [1, 2, 3, 4],
  },
  buildos_erasure_coded_raid_fs_zeroc: {
    fn: "raid_stage1_execute",
    count: 19,
    headLen: 8,
    head: "1,1,4,2,7,15,192,2880",
    rootIdx: 12,
    expectedRoot: EXPECTED_RAID_ROOT,
    modes: [1, 2, 3, 4],
  },
};

async function verifyV8Extension(slug, loaded) {
  const zspec = ZEROC_V8_SPECS[slug];
  if (zspec) {
    const ex = loaded.exports;
    const count = Number(ex.main());
    const mem = new BigInt64Array(ex.memory.buffer);
    const head = [];
    for (let i = 1; i <= zspec.headLen; i++) head.push(Number(mem[i]));
    const rootHex = readRootWords(mem, zspec.rootIdx);
    const attacks = await runZeroCAttacks(loaded.module, zspec.fn, zspec.modes);
    const attacksOk = zspec.modes.every((m) => attacks[m] === -(m * 100 + 1));
    const ok = loaded.imports.length === 0
      && count === zspec.count
      && head.join(",") === zspec.head
      && rootHex === zspec.expectedRoot
      && attacksOk;
    return { ok, count, head, rootHex, attacks };
  }
  if (slug === "titan_rsi_pareto_orchestrator") {
    const ex = loaded.exports;
    const hdr = ex.run_titan_rsi_pareto_wasm();
    const dv = new DataView(ex.memory.buffer);
    const ptr = dv.getUint32(hdr, true);
    const len = dv.getUint32(hdr + 4, true);
    const vals = Array.from(new Float64Array(ex.memory.buffer, ptr, len));
    const compoundGainX = vals[2];
    const goodhartTrapsBlocked = Math.round(vals[9]);
    const regressions = Math.round(vals[10]);
    const monotonicOk = Math.round(vals[11]);
    const paretoHash = Math.round(vals[12]);
    const failures = Math.round(vals[15]);
    const attacks = {
      1: Number(ex.anti_goodhart_valve(0, -0.1, 0.95, 0.1, 100.0, 2.0)),
      2: Number(ex.anti_goodhart_valve(1, 0.05, 0.0, 0.1, 0.0, 2.0)),
    };
    const ok = isPrintOnlyImports(loaded.module)
      && len === 16
      && compoundGainX > 3.0
      && goodhartTrapsBlocked === 40
      && regressions === 0
      && monotonicOk === 1
      && paretoHash === 1468869863
      && failures === 0
      && attacks[1] === -101
      && attacks[2] === -201;
    return { ok, compoundGainX, goodhartTrapsBlocked, regressions, paretoHash, attacks };
  }
  if (slug === "superframe_art_palettelight") {
    const ex = loaded.exports;
    const rawHash = ex.palettelight_hash();
    const u64Hex = `0x${BigInt.asUintN(64, rawHash).toString(16).padStart(16, "0")}`;
    const ok = isPrintOnlyImports(loaded.module) && u64Hex === EXPECTED_PALETTELIGHT_HASH;
    return { ok, paletteHash: u64Hex };
  }
  throw new WasmBridgeError("unknown_module", `Unknown V8 extension module: ${slug}`);
}

const V8_EXTENSIONS = new Set([
  ...Object.keys(ZEROC_V8_SPECS),
  "titan_rsi_pareto_orchestrator",
  "superframe_art_palettelight",
]);

export async function runAllBridgeV8Verifiers(manifest, readBytesFn) {
  const v7Mods = manifest.modules.filter((m) => !V8_EXTENSIONS.has(m.slug));
  const v8Mods = manifest.modules.filter((m) => V8_EXTENSIONS.has(m.slug));
  const v7Summary = await runAllBridgeV7Verifiers({ ...manifest, modules: v7Mods }, readBytesFn);
  const results = [...v7Summary.results];
  for (const mod of v8Mods) {
    const raw = await readBytesFn(mod.wasm_path);
    const loaded = await loadVerifiedWasm(raw, mod.sha256);
    const out = await verifyV8Extension(mod.slug, loaded);
    results.push({ slug: mod.slug, bytes: loaded.bytes, imports: loaded.imports.length, sha256: loaded.sha256, ...out });
  }
  return { ok: results.every((r) => r.ok), count: results.length, results };
}
