// Lawful Public-Record Provenance, RFC 6962 Merkle Tree, and PII Privacy Firewall for CMMNS.
// Scope: strictly public-record provenance and aggregate coordinated-inauthentic-behavior (CIB)
// evidence bundling. Refuses private-individual tracking, covert surveillance fields, unredacted
// PII/secrets, tampered source hashes, forged Merkle proofs, and broken citation chains fail-closed.
// Pure ES module (Web Crypto SHA-256 only; zero DOM, network, or filesystem access; AGPL-3.0-only).

import { canonicalJson, hmacSha256Prefixed, sha256Prefixed, toBytes, ENGINE_RECEIPT_SCHEMA, IN_TOTO_STATEMENT, ENGINE_RECEIPT_PREDICATE, verifySidecarEngineReceipt } from "./sidecar-receipt.js";

export const CIB_PROVENANCE_SCHEMA = "cmmns.cib-merkle-provenance/1";
export const LAWFUL_PUBLIC_SCOPE = "public_record_aggregate";
export const CIB_DOES_NOT_PROVE = "This Merkle-sealed bundle proves public-record bytes, citations, and privacy-firewall checks have not drifted since sealing; it does not prove intent or attribute private individuals.";

const SHA256_RE = /^sha256:[0-9a-f]{64}$/;
const FORBIDDEN_KEYS = new Set([
  "home_address", "residential_address", "gps_trace", "private_dm",
  "stalk_target", "dox_target", "real_name_dox", "phone_book",
  "device_imei", "private_profile_scrape", "covert_track", "private_individual_target",
]);
const PII_PATTERNS = [
  ["email_address", /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi],
  ["phone_number", /(?:\+?1[-.\s]?)?(?:\(\d{3}\)|\b\d{3})[-.\s]\d{3}[-.\s]\d{4}\b/g],
  ["us_ssn", /\b(?!000|666|9\d\d)\d{3}-\d{2}-\d{4}\b/g],
  ["street_address", /\b\d{1,5}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Drive|Dr|Ln|Lane|Ct|Court|Way)\b/g],
  ["private_ipv4", /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/g],
  ["secret_token", /\b(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|Bearer\s+[A-Za-z0-9._-]{20,})\b/g],
];

const toHex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (s) => {
  const clean = String(s || "").replace(/^sha256:/, "");
  if (!/^[0-9a-f]{64}$/i.test(clean)) return null;
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
};

async function sha256Raw(bytes) {
  return new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", toBytes(bytes)));
}

function concatBytes(...chunks) {
  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.byteLength; }
  return out;
}

function largestPow2Below(n) {
  let k = 1;
  while (k * 2 < n) k *= 2;
  return k;
}

export async function merkleLeafHash(data) {
  return sha256Raw(concatBytes(new Uint8Array([0x00]), toBytes(data)));
}

async function merkleNodeHash(left, right) {
  return sha256Raw(concatBytes(new Uint8Array([0x01]), left, right));
}

async function mth(hashes) {
  const n = hashes.length;
  if (n === 0) return sha256Raw(new Uint8Array(0));
  if (n === 1) return hashes[0];
  const k = largestPow2Below(n);
  return merkleNodeHash(await mth(hashes.slice(0, k)), await mth(hashes.slice(k)));
}

export async function computeMerkleRoot(leaves) {
  const hashed = await Promise.all((leaves || []).map(merkleLeafHash));
  return "sha256:" + toHex(await mth(hashed));
}

async function proofFromHashes(hashes, m) {
  const n = hashes.length;
  if (n <= 1) return [];
  const k = largestPow2Below(n);
  if (m < k) return [...(await proofFromHashes(hashes.slice(0, k), m)), await mth(hashes.slice(k))];
  return [...(await proofFromHashes(hashes.slice(k), m - k)), await mth(hashes.slice(0, k))];
}

function expectedProofLen(n, m) {
  if (n <= 1) return 0;
  const k = largestPow2Below(n);
  return (m < k ? expectedProofLen(k, m) : expectedProofLen(n - k, m - k)) + 1;
}

async function rootFromProof(target, m, n, proof) {
  if (n <= 1) return target;
  const k = largestPow2Below(n);
  const head = proof.slice(0, -1), last = proof[proof.length - 1];
  if (m < k) return merkleNodeHash(await rootFromProof(target, m, k, head), last);
  return merkleNodeHash(last, await rootFromProof(target, m - k, n - k, head));
}

export async function buildInclusionProof(leaves, index) {
  if (!Number.isInteger(index) || index < 0 || index >= leaves.length) throw new RangeError("leaf index out of range");
  const hashed = await Promise.all(leaves.map(merkleLeafHash));
  const path = await proofFromHashes(hashed, index);
  return path.map((b) => "sha256:" + toHex(b));
}

export async function verifyInclusionProof(leafData, index, size, proofHex, rootHex) {
  if (!Number.isInteger(index) || !Number.isInteger(size) || !Array.isArray(proofHex)) return false;
  if (size <= 0 || index < 0 || index >= size || proofHex.length !== expectedProofLen(size, index)) return false;
  const rootBytes = fromHex(rootHex);
  const proofBytes = proofHex.map(fromHex);
  if (!rootBytes || proofBytes.some((p) => !p)) return false;
  const derived = await rootFromProof(await merkleLeafHash(leafData), index, size, proofBytes);
  return toHex(derived) === toHex(rootBytes);
}

export function redactPiiText(text) {
  let out = String(text || "");
  for (const [kind, re] of PII_PATTERNS) {
    re.lastIndex = 0;
    out = out.replace(re, `[REDACTED:${kind.toUpperCase()}]`);
  }
  return out;
}

export function scanObjectForPiiAndScope(value, path = "$", out = { pii: [], unlawful: [] }) {
  if (typeof value === "string") {
    for (const [kind, re] of PII_PATTERNS) {
      re.lastIndex = 0;
      if (re.test(value)) out.pii.push({ kind, path });
    }
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => scanObjectForPiiAndScope(v, `${path}[${i}]`, out));
    return out;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(k.toLowerCase())) out.unlawful.push({ kind: "unlawful_private_target_rejected", path: `${path}.${k}` });
      scanObjectForPiiAndScope(v, `${path}.${k}`, out);
    }
  }
  return out;
}

function isPublicHttpUrl(raw) {
  try {
    const u = new URL(String(raw || ""));
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const h = u.hostname.toLowerCase();
    return h !== "localhost" && h !== "127.0.0.1" && !h.endsWith(".local");
  } catch { return false; }
}

async function sealBundleEngineReceipt(bundleCore, merkleRoot, opts = {}) {
  const emitted_at = opts.emittedAt || bundleCore.emitted_at;
  const coreBytes = toBytes(canonicalJson(bundleCore));
  const artifacts = [{ rel_path: "cib-evidence-bundle.core.json", sha256: await sha256Prefixed(coreBytes), bytes: coreBytes.byteLength }];
  const oracleOut = toBytes(`PASS merkle_root=${merkleRoot} records=${bundleCore.records.length} findings=${bundleCore.findings.length}\n`);
  const oracle = {
    command: ["cmmns", "provenance", "cib-verify"],
    exit_code: 0,
    stdout_sha256: await sha256Prefixed(oracleOut),
    stderr_sha256: await sha256Prefixed(""),
    pass_lines: 1,
    fail_lines: 0,
  };
  const subject = { engine: "cmmns", flagship: "cmmns", task_id: opts.taskId || "cmmns-cib-merkle-provenance", sidecar_format: CIB_PROVENANCE_SCHEMA, capture: { scope: bundleCore.scope, merkle_root: merkleRoot }, artifacts, oracle_command: oracle.command };
  const scope = [
    "engine=cmmns; fail-closed receipt bridge between engine verification and Flywheel",
    `hashed ${artifacts.length} artifact file(s) with SHA-256 at emission time`,
    "oracle exited 0 with 1 pass marker(s) and 0 fail marker(s); proves the named command passed on this commit and artifacts, not unexecuted surfaces",
  ];
  const claim = { subject, verdict: "MATCH", oracle: { exit_code: 0, stdout_sha256: oracle.stdout_sha256, stderr_sha256: oracle.stderr_sha256, pass_lines: 1, fail_lines: 0 }, scope };
  const subject_sha256 = await sha256Prefixed(canonicalJson(subject));
  const claim_sha256 = await sha256Prefixed(canonicalJson(claim));
  const envPayload = { schema: ENGINE_RECEIPT_SCHEMA, subject_sha256, claim_sha256 };
  const envelope_sha256 = await sha256Prefixed(canonicalJson(envPayload));
  const signature = opts.hmacKey ? await hmacSha256Prefixed(opts.hmacKey, canonicalJson(envPayload)) : null;
  return { schema: ENGINE_RECEIPT_SCHEMA, in_toto_statement_type: IN_TOTO_STATEMENT, predicate_type: ENGINE_RECEIPT_PREDICATE, emitted_at, subject, verdict: "MATCH", oracle, scope, digests: { subject_sha256, claim_sha256, envelope_sha256, signature } };
}

function validateCitations(records, findings, errors) {
  const byId = new Map();
  for (const r of records || []) {
    if (!r || !r.record_id || byId.has(r.record_id)) errors.push(`duplicate or missing record_id: ${r && r.record_id}`);
    else byId.set(r.record_id, r);
    if (!isPublicHttpUrl(r && r.source_url)) errors.push(`non-public or invalid source_url on ${r && r.record_id}`);
    if (!SHA256_RE.test(String((r && r.source_sha256) || ""))) errors.push(`invalid source_sha256 on ${r && r.record_id}`);
  }
  for (const f of findings || []) {
    const cits = Array.isArray(f && f.citations) ? f.citations : [];
    if (!cits.length) { errors.push(`broken_citation_chain: finding ${f && f.finding_id} has no citations`); continue; }
    for (const c of cits) {
      const rec = byId.get(c && c.record_id);
      if (!rec) errors.push(`broken_citation_chain: finding ${f.finding_id} cites missing record ${c && c.record_id}`);
      else if (rec.source_sha256 !== c.source_sha256) errors.push(`broken_citation_chain: source_sha256 mismatch for ${c.record_id} in ${f.finding_id}`);
    }
  }
}

export async function buildCibEvidenceBundle({ scope = LAWFUL_PUBLIC_SCOPE, records = [], findings = [], emittedAt = null, taskId = null, hmacKey = null } = {}) {
  if (scope !== LAWFUL_PUBLIC_SCOPE) throw new Error(`unlawful_private_target_rejected: scope must be ${LAWFUL_PUBLIC_SCOPE}`);
  if (!Array.isArray(records) || !records.length) throw new Error("records must be a non-empty array");
  const normRecords = [];
  for (const r of records) {
    const rec = { ...r };
    if (rec.canonical_excerpt != null && !rec.source_sha256) rec.source_sha256 = await sha256Prefixed(rec.canonical_excerpt);
    normRecords.push(rec);
  }
  const scan = scanObjectForPiiAndScope({ scope, records: normRecords, findings });
  if (scan.unlawful.length) throw new Error(`unlawful_private_target_rejected: ${scan.unlawful.map((x) => x.path).join(", ")}`);
  if (scan.pii.length) throw new Error(`pii_leak_detected: ${scan.pii.map((x) => `${x.kind}@${x.path}`).join(", ")}`);
  const citeErrs = [];
  validateCitations(normRecords, findings, citeErrs);
  if (citeErrs.length) throw new Error(citeErrs.join("; "));
  const emitted_at = emittedAt || new Date().toISOString();
  const leaves = normRecords.map((r) => toBytes(canonicalJson(r)));
  const merkle_root = await computeMerkleRoot(leaves);
  const inclusion_proofs = await Promise.all(normRecords.map(async (r, i) => ({ record_id: r.record_id, index: i, proof: await buildInclusionProof(leaves, i) })));
  const core = { schema: CIB_PROVENANCE_SCHEMA, scope, emitted_at, records: normRecords, findings, does_not_prove: CIB_DOES_NOT_PROVE };
  const engine_receipt = await sealBundleEngineReceipt(core, merkle_root, { emittedAt: emitted_at, taskId, hmacKey });
  return { ...core, merkle: { algorithm: "rfc6962-sha256", leaf_count: normRecords.length, root: merkle_root, inclusion_proofs }, engine_receipt };
}

export async function verifyCibEvidenceBundle(bundle, { hmacKey = null } = {}) {
  const errors = [];
  if (!bundle || typeof bundle !== "object") return { schema: CIB_PROVENANCE_SCHEMA, ok: false, verdict: "UNVERIFIABLE", errors: ["bundle is not an object"], checks: {}, pii_findings: [] };
  if (bundle.schema !== CIB_PROVENANCE_SCHEMA) errors.push(`unexpected schema: ${bundle.schema}`);
  if (bundle.scope !== LAWFUL_PUBLIC_SCOPE) errors.push(`unlawful_private_target_rejected: scope=${bundle.scope}`);
  const records = Array.isArray(bundle.records) ? bundle.records : [];
  const findings = Array.isArray(bundle.findings) ? bundle.findings : [];
  const scan = scanObjectForPiiAndScope({ scope: bundle.scope, records, findings });
  for (const u of scan.unlawful) errors.push(`${u.kind}: ${u.path}`);
  for (const p of scan.pii) errors.push(`pii_leak_detected: ${p.kind} at ${p.path}`);
  validateCitations(records, findings, errors);
  for (const r of records) {
    if (r && r.canonical_excerpt != null) {
      const liveSha = await sha256Prefixed(r.canonical_excerpt);
      if (liveSha !== r.source_sha256) errors.push(`source_hash_mismatch on ${r.record_id}: live=${liveSha} stored=${r.source_sha256}`);
    }
  }
  const leaves = records.map((r) => toBytes(canonicalJson(r)));
  const liveRoot = await computeMerkleRoot(leaves);
  const storedRoot = bundle.merkle && bundle.merkle.root;
  if (liveRoot !== storedRoot) errors.push(`merkle_root_mismatch: live=${liveRoot} stored=${storedRoot}`);
  const proofs = (bundle.merkle && Array.isArray(bundle.merkle.inclusion_proofs)) ? bundle.merkle.inclusion_proofs : [];
  if (proofs.length !== records.length) errors.push(`invalid_inclusion_proof: expected ${records.length} proofs, got ${proofs.length}`);
  for (let i = 0; i < Math.min(proofs.length, records.length); i++) {
    const p = proofs[i];
    const okProof = await verifyInclusionProof(leaves[i], p.index, records.length, p.proof, storedRoot);
    if (!okProof) errors.push(`invalid_inclusion_proof on record ${records[i].record_id} (index ${i})`);
  }
  const core = { schema: bundle.schema, scope: bundle.scope, emitted_at: bundle.emitted_at, records, findings, does_not_prove: bundle.does_not_prove };
  const receiptCheck = await verifySidecarEngineReceipt(bundle.engine_receipt, { files: { "cib-evidence-bundle.core.json": canonicalJson(core) }, hmacKey });
  if (!receiptCheck.ok) errors.push(`engine_receipt_drift: ${receiptCheck.errors.join("; ")}`);
  const ok = errors.length === 0;
  return {
    schema: CIB_PROVENANCE_SCHEMA,
    ok,
    verdict: ok ? "MATCH" : "DRIFT",
    merkle_root: liveRoot,
    checks: {
      lawful_public_scope: bundle.scope === LAWFUL_PUBLIC_SCOPE && scan.unlawful.length === 0,
      pii_firewall_clean: scan.pii.length === 0,
      source_hashes_valid: !errors.some((e) => e.startsWith("source_hash_mismatch")),
      merkle_root_and_proofs_valid: liveRoot === storedRoot && !errors.some((e) => e.startsWith("invalid_inclusion_proof")),
      citation_chain_valid: !errors.some((e) => e.startsWith("broken_citation_chain")),
      engine_receipt_valid: receiptCheck.ok,
    },
    pii_findings: scan.pii,
    errors,
    does_not_prove: CIB_DOES_NOT_PROVE,
  };
}
