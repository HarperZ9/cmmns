// SPDX-FileCopyrightText: 2026 Zain Dana Harper and the CMMNS contributors
// SPDX-License-Identifier: MIT
//
// CMMNS Browser + Node V8 WebAssembly Verification Bridge V3 (12 MIT kernels <= 75 KB).
// Zero Node-only imports, zero network calls, WebCrypto SHA-256 verification before compile.

const ALLOWED_IMPORTS = new Set([
  "env.print_i64",
  "env.print_u64",
  "env.print_f64",
  "env.print_bool",
  "env.print_str",
]);

const NOOP_ENV = Object.freeze({
  print_i64() {},
  print_u64() {},
  print_f64() {},
  print_bool() {},
  print_str() {},
});

export class WasmBridgeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "WasmBridgeError";
    this.code = code;
  }
}

export function toUint8Array(input) {
  if (input instanceof Uint8Array) return input;
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  throw new WasmBridgeError("invalid_buffer", "Expected ArrayBuffer or TypedArray");
}

export async function sha256Hex(input) {
  const bytes = toUint8Array(input);
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new WasmBridgeError("missing_webcrypto", "WebCrypto subtle.digest unavailable");
  const view = new Uint8Array(await subtle.digest("SHA-256", bytes));
  let hex = "";
  for (let i = 0; i < view.length; i++) hex += view[i].toString(16).padStart(2, "0");
  return hex;
}

export function hasWasmMagic(b) {
  return b.byteLength >= 8 && b[0] === 0x00 && b[1] === 0x61 && b[2] === 0x73 && b[3] === 0x6d;
}

export async function loadVerifiedWasm(wasmBytes, expectedSha256) {
  const bytes = toUint8Array(wasmBytes);
  const expected = String(expectedSha256 || "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(expected)) {
    throw new WasmBridgeError("invalid_sha256", "Expected 64-char lowercase hex SHA-256 digest");
  }
  const actualSha256 = await sha256Hex(bytes);
  if (actualSha256 !== expected) {
    throw new WasmBridgeError("sha256_mismatch", `SHA-256 mismatch: expected ${expected}, got ${actualSha256}`);
  }
  if (!hasWasmMagic(bytes)) {
    throw new WasmBridgeError("invalid_wasm_magic", "Buffer lacks 0x0061736d WebAssembly magic");
  }
  const mod = await WebAssembly.compile(bytes);
  const imports = WebAssembly.Module.imports(mod);
  for (const imp of imports) {
    const key = `${imp.module}.${imp.name}`;
    if (!ALLOWED_IMPORTS.has(key)) {
      throw new WasmBridgeError("disallowed_import", `Unexpected WASM import: ${key}`);
    }
  }
  const instance = await WebAssembly.instantiate(mod, imports.length > 0 ? { env: NOOP_ENV } : {});
  return {
    module: mod,
    exports: instance.exports,
    sha256: actualSha256,
    bytes: bytes.byteLength,
    imports: imports.map((imp) => `${imp.module}.${imp.name}`),
  };
}

const u32BeHex = (w) => (w >>> 0).toString(16).padStart(8, "0");
const u32LeHex = (w) => {
  const u = w >>> 0;
  return [u & 255, (u >>> 8) & 255, (u >>> 16) & 255, (u >>> 24) & 255]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

async function verifyModule(slug, loaded) {
  const ex = loaded.exports;
  if (slug === "merkle_rfc6962") {
    let rootHex = "";
    for (let i = 0; i < 8; i++) rootHex += u32BeHex(ex.merkle_root_word(0, i));
    const ok = rootHex === "3c534b22b2e8c8fff07416469d39d9553b4d325e51874140e429b2c2a9ae22d2"
      && ex.merkle_verify_all(0) === 4 && ex.merkle_verify_all(1) === -902 && ex.merkle_verify_all(2) === -903;
    return { ok, rootHex };
  }
  if (slug === "honest_exit_valve") {
    const ok = ex.arm_metric(0, 0) > 0.95 && ex.arm_metric(2, 0) === 0.0
      && ex.arm_reseats(2, 600) === 300 && ex.audit_arm_safety(2) === 0 && ex.audit_arm_safety(3) === -101;
    return { ok, reseatsC: 300 };
  }
  if (slug === "isomorphism_entropy") {
    const ok = ex.channel_h_cond(0) === 0.0 && ex.channel_roundtrip_exact(0) === 256
      && Math.abs(ex.channel_h_cond(1) - 4.0) < 1e-12
      && Math.abs(ex.channel_h_cond(2) - 2 / 256) < 1e-12
      && ex.check_isomorphism_mode(0) === 0 && ex.check_isomorphism_mode(1) === -401 && ex.check_isomorphism_mode(2) === -401;
    return { ok, roundtrip: 256 };
  }
  if (slug === "confidence_word_calib") {
    const bands = [ex.confidence_band(0.004, 0.03, 1), ex.confidence_band(0.03, 0.08, 1), ex.confidence_band(0.1, 0.2, 1), ex.confidence_band(0.45, 0.4, 1)];
    const ok = bands.join(",") === "3,2,1,0" && ex.audit_claim(0.004, 0.03, 1, 3, 0) === 0
      && ex.audit_claim(0.04, 0.22, 1, 1, 1) === -401 && ex.audit_claim(0.002, 0.02, 0, 3, 0) === -402
      && ex.audit_claim(1.5, -0.1, 1, 0, 0) === -403;
    return { ok, bands };
  }
  if (slug === "sha256_zeroc") {
    let abcHex = "";
    for (let i = 0; i < 8; i++) abcHex += u32BeHex(ex.sha256_abc_word(i, 0));
    const ok = abcHex === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
      && ex.sha256_verify_flip_caught() === 8;
    return { ok, abcHex };
  }
  if (slug === "aead_chacha20_poly1305") {
    let tagHex = "";
    for (let i = 0; i < 4; i++) tagHex += u32LeHex(ex.aead_tag_word(0, 0, i));
    const ok = tagHex === "1ae10b594f09e26a7e902ecbd0600691"
      && u32LeHex(ex.aead_ct_first_word()) === "d31a8d34" && ex.aead_verify_tampers_caught() === 2;
    return { ok, tagHex };
  }
  if (slug === "x25519_curve25519_zeroc") {
    const cnt = Number(ex.main());
    const mem = new BigInt64Array(ex.memory.buffer);
    const vals = Array.from({ length: cnt }, (_, i) => Number(mem[i + 1]));
    const shared = vals.slice(16, 24).map(u32LeHex).join("");
    const tInst = await WebAssembly.instantiate(loaded.module, {});
    const tamperRc = Number(tInst.exports.x25519_suite(1n));
    const ok = shared === "4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742"
      && vals[24] === 1 && vals[25] === 1 && tamperRc === 0;
    return { ok, shared, tamperRc };
  }
  if (slug === "three_control_negatives") {
    const pSig = ex.perm_p_value(1);
    const pNull = ex.perm_p_value(0);
    const ok = ex.pearson_r(1, -1) > 0.999 && pSig <= 0.01 && pNull > 0.05
      && ex.validate_three_controls(1, 1, 1, 1, pSig, 0.05) === 0
      && ex.validate_three_controls(0, 0, 1, 1, pSig, 0.05) === -201
      && ex.validate_three_controls(1, 1, 0, 0, pSig, 0.05) === -202
      && ex.validate_three_controls(1, 1, 1, 1, pNull, 0.05) === -203;
    return { ok, pSig, pNull };
  }
  if (slug === "tls_mini_handshake_zeroc") {
    const count = Number(ex.main());
    const mem = new BigInt64Array(ex.memory.buffer);
    const status = Number(mem[1]), tagOk = Number(mem[2]), ptOk = Number(mem[3]);
    const mitmRc = Number((await WebAssembly.instantiate(loaded.module, {})).exports.tls_handshake_run(1n));
    const tamperRc = Number((await WebAssembly.instantiate(loaded.module, {})).exports.tls_handshake_run(2n));
    const ok = count === 26 && status === 1 && tagOk === 1 && ptOk === 1 && mitmRc === -101 && tamperRc === -201;
    return { ok, status, tagOk, ptOk, mitmRc, tamperRc };
  }
  if (slug === "cmmns_evidence_quorum") {
    let pinHex = "";
    for (let i = 0; i < 8; i++) pinHex += u32BeHex(ex.quorum_pin_f1_word(i));
    const ok = pinHex === "834a66c94b8b1a7d87a3a199cb5bc8f8af6759c35c1df67ceef6f84b9aec7f0c"
      && ex.verify_bft_mode(0) === 0 && ex.verify_bft_mode(1) === -501
      && ex.verify_bft_mode(2) === -502 && ex.verify_bft_mode(3) === -503 && ex.verify_bft_mode(4) === -503;
    return { ok, pinHex };
  }
  if (slug === "cmmns_citation_decay") {
    const sSpof = ex.spof_survival(10.0), sQuad = ex.quad_survival(10.0, 0.0);
    const ok = Math.abs(sSpof - 0.135335283) < 1e-6 && Math.abs(sQuad - 0.996396682) < 1e-6
      && ex.check_archival_policy(4, 0.005, 10.0, 0.0) === 0
      && ex.check_archival_policy(1, 0.2, 10.0, 0.0) === -601
      && ex.check_archival_policy(4, -0.1, 10.0, 0.0) === -602
      && ex.check_archival_policy(4, 0.005, 10.0, 1.0) === -603;
    return { ok, sSpof, sQuad };
  }
  if (slug === "cmmns_attention_valve") {
    const ok = ex.audit_attention_valve(20, 30, 0, 0, 0, 0) === 0
      && ex.audit_attention_valve(30, 30, 1, 0, 0, 0) === 0
      && ex.audit_attention_valve(12, 30, 0, 1, 1, 1) === -901
      && ex.audit_attention_valve(45, 30, 0, 0, 0, 0) === -902
      && ex.audit_attention_valve(10, 0, 0, 0, 0, 0) === -903
      && ex.dark_pattern_score(1, 1, 1) === 9 && ex.stop_ramp_active(30, 30, 1) === 1;
    return { ok, darkScore: 9, rampActive: 1 };
  }
  throw new WasmBridgeError("unknown_module", `Unknown WASM module: ${slug}`);
}

export async function runAllBridgeV3Verifiers(manifest, readBytesFn) {
  const results = [];
  for (const mod of manifest.modules) {
    const raw = await readBytesFn(mod.wasm_path);
    const loaded = await loadVerifiedWasm(raw, mod.sha256);
    const out = await verifyModule(mod.slug, loaded);
    results.push({ slug: mod.slug, bytes: loaded.bytes, imports: loaded.imports.length, sha256: loaded.sha256, ...out });
  }
  return { ok: results.every((r) => r.ok), count: results.length, results };
}
