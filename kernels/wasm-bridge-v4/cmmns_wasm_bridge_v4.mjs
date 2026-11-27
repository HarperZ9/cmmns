// SPDX-FileCopyrightText: 2026 Zain Dana Harper and the CMMNS contributors
// SPDX-License-Identifier: MIT
//
// CMMNS Browser + Node V8 WebAssembly Verification Bridge V4 (16 MIT kernels <= 125 KB).
// Zero Node-only imports, zero network calls, WebCrypto SHA-256 verification before compile.
// Reuses all 12 V3 verifiers and adds 3 Zero-C 0-import BuildOS modules (Slices 20, 22, 23)
// plus the CS-024 posterior rare-tail importance-sampling verifier.
import {
  WasmBridgeError,
  hasWasmMagic,
  loadVerifiedWasm,
  runAllBridgeV3Verifiers,
  sha256Hex,
  toUint8Array,
} from "../wasm-bridge-v3/cmmns_wasm_bridge_v3.mjs";

export { WasmBridgeError, hasWasmMagic, loadVerifiedWasm, sha256Hex, toUint8Array };

async function runZeroCAttacks(mod, fnName, modes) {
  const out = {};
  for (const m of modes) {
    const inst = await WebAssembly.instantiate(mod, {});
    out[m] = Number(inst.exports[fnName](BigInt(m)));
  }
  return out;
}

async function verifyV4Extension(slug, loaded) {
  const ex = loaded.exports;
  if (slug === "buildos_e2e_triad_zeroc") {
    const count = Number(ex.main());
    const mem = new BigInt64Array(ex.memory.buffer);
    const head = [1, 2, 3, 4, 5, 6].map((i) => Number(mem[i]));
    const attacks = await runZeroCAttacks(loaded.module, "buildos_triad_run", [1, 2, 3, 4]);
    const ok = loaded.imports.length === 0 && count === 30
      && head.join(",") === "1,1,2,20,9,4"
      && attacks[1] === -101 && attacks[2] === -201 && attacks[3] === -301 && attacks[4] === -401;
    return { ok, count, head, attacks };
  }
  if (slug === "buildos_compositor_zeroc") {
    const count = Number(ex.main());
    const mem = new BigInt64Array(ex.memory.buffer);
    const head = [1, 2, 3, 4].map((i) => Number(mem[i]));
    const p0 = Number(mem[5]) >>> 0;
    const attacks = await runZeroCAttacks(loaded.module, "compositor_run", [1, 2, 3, 4]);
    const ok = loaded.imports.length === 0 && count === 24
      && head.join(",") === "1,1,2,16" && p0 === 0xff182638
      && attacks[1] === -101 && attacks[2] === -201 && attacks[3] === -301 && attacks[4] === -401;
    return { ok, count, head, p0, attacks };
  }
  if (slug === "buildos_input_audio_zeroc") {
    const count = Number(ex.main());
    const mem = new BigInt64Array(ex.memory.buffer);
    const head = [1, 2, 3, 4, 5, 6].map((i) => Number(mem[i]));
    const attacks = await runZeroCAttacks(loaded.module, "input_audio_run", [1, 2, 3, 4]);
    const ok = loaded.imports.length === 0 && count === 22
      && head.join(",") === "1,1,16,2,32,5"
      && attacks[1] === -101 && attacks[2] === -201 && attacks[3] === -301 && attacks[4] === -401;
    return { ok, count, head, attacks };
  }
  if (slug === "cs024_posterior_rare_tail_audit") {
    const rcClean = ex.run_audit(0);
    const tailBase = ex.cs024_metric(0);
    const tailEst = ex.cs024_metric(2);
    const relErr = ex.cs024_metric(3);
    const probOk = ex.validate_prob_sum(1.0);
    const probBad = ex.validate_prob_sum(0.85);
    const martOk = ex.validate_martingale(1.0);
    const martBad = ex.validate_martingale(0.5);
    const ok = rcClean === 0 && tailBase > 0 && tailEst > 0 && relErr < 0.25
      && probOk === 0 && probBad === -241 && martOk === 0 && martBad === -242;
    return { ok, rcClean, tailBase, tailEst, relErr, probBad, martBad };
  }
  throw new WasmBridgeError("unknown_module", `Unknown V4 extension module: ${slug}`);
}

const V4_EXTENSIONS = new Set([
  "buildos_e2e_triad_zeroc",
  "buildos_compositor_zeroc",
  "buildos_input_audio_zeroc",
  "cs024_posterior_rare_tail_audit",
]);

export async function runAllBridgeV4Verifiers(manifest, readBytesFn) {
  const v3Mods = manifest.modules.filter((m) => !V4_EXTENSIONS.has(m.slug));
  const v4Mods = manifest.modules.filter((m) => V4_EXTENSIONS.has(m.slug));
  const v3Summary = await runAllBridgeV3Verifiers({ ...manifest, modules: v3Mods }, readBytesFn);
  const results = [...v3Summary.results];
  for (const mod of v4Mods) {
    const raw = await readBytesFn(mod.wasm_path);
    const loaded = await loadVerifiedWasm(raw, mod.sha256);
    const out = await verifyV4Extension(mod.slug, loaded);
    results.push({ slug: mod.slug, bytes: loaded.bytes, imports: loaded.imports.length, sha256: loaded.sha256, ...out });
  }
  return { ok: results.every((r) => r.ok), count: results.length, results };
}
