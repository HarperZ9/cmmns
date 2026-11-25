// Deterministic SHA-256 capture receipts for daylight.sidecar/1 exports:
//   - commons-digest/1: portable CMMNS sidecar digest covering the note and attached files.
//   - engine-receipt/1: canonical Flywheel verification envelope (in-toto Statement/v1),
//     fail-closed (UNVERIFIABLE without a passing exit-0 oracle, MATCH only with one).
// Pure Web Crypto (Node 22 and MV3 browsers); no DOM, no network, no filesystem access.

import { SIDECAR_FORMAT, sidecarMarkdown, sidecarJson, sidecarStem } from "./media-meta.js";

export const COMMONS_DIGEST_FORMAT = "commons-digest/1";
export const ENGINE_RECEIPT_SCHEMA = "engine-receipt/1";
export const IN_TOTO_STATEMENT = "https://in-toto.io/Statement/v1";
export const ENGINE_RECEIPT_PREDICATE = "https://flywheel.dev/EngineReceipt/v1";
export const COMMONS_DIGEST_DOES_NOT_PROVE = "This receipt proves these sidecar and artifact bytes have not changed since they were hashed; it does not prove the source page or author was accurate.";

const enc = (s) => new TextEncoder().encode(String(s));
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const escapeAscii = (s) => s.replace(/[\u007f-\uffff]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));

// Compact, key-sorted, ASCII-escaped JSON matching Python json.dumps(..., sort_keys=True, separators=(",", ":"), ensure_ascii=True).
export function canonicalJson(v) {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  if (v && typeof v === "object") {
    const keys = Object.keys(v).sort().filter((k) => v[k] !== undefined);
    return `{${keys.map((k) => `${escapeAscii(JSON.stringify(k))}:${canonicalJson(v[k])}`).join(",")}}`;
  }
  return escapeAscii(JSON.stringify(v === undefined ? null : v));
}

export function toBytes(data) {
  if (data instanceof Uint8Array) return data;
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return enc(data == null ? "" : data);
}

export async function sha256Prefixed(data) {
  return "sha256:" + hex(await globalThis.crypto.subtle.digest("SHA-256", toBytes(data)));
}

export async function hmacSha256Prefixed(key, data) {
  const k = await globalThis.crypto.subtle.importKey("raw", enc(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return "hmac-sha256:" + hex(await globalThis.crypto.subtle.sign("HMAC", k, toBytes(data)));
}

function captureSummary(meta = {}) {
  return {
    site: meta.site || null,
    adapter: meta.adapter || null,
    kind: meta.kind || "media",
    handle: (meta.author && meta.author.handle) || null,
    post_url: meta.postUrl || null,
    page_url: meta.postUrl ? null : (meta.pageUrl || null),
    posted_at: meta.postedAt || null,
    saved_at: meta.savedAt || null,
  };
}

async function normaliseArtifacts(entries = []) {
  const byPath = new Map();
  for (const item of entries) {
    if (!item) continue;
    const rel = String(item.rel_path || item.name || "").replace(/\\/g, "/");
    if (!rel) continue;
    if (typeof item.sha256 === "string" && typeof item.bytes === "number" && item.data === undefined) {
      byPath.set(rel, { rel_path: rel, sha256: item.sha256, bytes: item.bytes });
      continue;
    }
    const raw = toBytes(item.data !== undefined ? item.data : item.content);
    byPath.set(rel, { rel_path: rel, sha256: await sha256Prefixed(raw), bytes: raw.byteLength });
  }
  return [...byPath.values()].sort((a, b) => (a.rel_path < b.rel_path ? -1 : a.rel_path > b.rel_path ? 1 : 0));
}

function deriveReceiptScope(engine, oracle, artifacts) {
  const lines = [
    `engine=${engine}; fail-closed receipt bridge between engine verification and Flywheel`,
    `hashed ${artifacts.length} artifact file(s) with SHA-256 at emission time`,
  ];
  if (!oracle) lines.push("no oracle command executed: standing remains UNVERIFIABLE until an oracle runs");
  else if (oracle.exit_code === 0) lines.push(`oracle exited 0 with ${oracle.pass_lines} pass marker(s) and ${oracle.fail_lines} fail marker(s); proves the named command passed on this commit and artifacts, not unexecuted surfaces`);
  else lines.push(`oracle exited ${oracle.exit_code}: standing is DRIFT`);
  return lines;
}

function defaultSidecarName(fileNames, sidecarName) {
  if (sidecarName) return sidecarName;
  const stem = sidecarStem(fileNames);
  return stem ? `${stem}.md` : "sidecar.md";
}

function buildEntryList(meta, opts = {}) {
  const entries = [];
  if (opts.includeSidecar !== false) {
    const mdName = defaultSidecarName(opts.fileNames, opts.sidecarName);
    const md = opts.sidecarMd != null ? opts.sidecarMd : sidecarMarkdown(meta, opts.fileNames);
    entries.push({ rel_path: mdName, data: md });
    if (opts.sidecarJsonText != null) entries.push({ rel_path: mdName.replace(/\.md$/, ".json"), data: opts.sidecarJsonText });
  }
  for (const f of opts.files || []) entries.push(f);
  return entries;
}

async function sealDigests(kindKey, kindVal, subject, claim, hmacKey) {
  const subject_sha256 = await sha256Prefixed(canonicalJson(subject));
  const claim_sha256 = await sha256Prefixed(canonicalJson(claim));
  const payload = { [kindKey]: kindVal, subject_sha256, claim_sha256 };
  const envelope_sha256 = await sha256Prefixed(canonicalJson(payload));
  const signature = hmacKey ? await hmacSha256Prefixed(hmacKey, canonicalJson(payload)) : null;
  return { subject_sha256, claim_sha256, envelope_sha256, signature };
}

// Deterministic commons-digest/1 capture receipt for a daylight.sidecar/1 export.
export async function sidecarDigest(meta = {}, opts = {}) {
  const tool = opts.tool || "CMMNS";
  const emitted_at = opts.emittedAt || meta.savedAt || new Date().toISOString();
  const artifacts = await normaliseArtifacts(buildEntryList(meta, opts));
  const subject = { sidecar_format: SIDECAR_FORMAT, capture: captureSummary(meta), artifacts };
  const claim = { format: COMMONS_DIGEST_FORMAT, sidecar_format: SIDECAR_FORMAT, tool, subject, dnp: COMMONS_DIGEST_DOES_NOT_PROVE };
  const digests = await sealDigests("format", COMMONS_DIGEST_FORMAT, subject, claim, opts.hmacKey || null);
  return { format: COMMONS_DIGEST_FORMAT, sidecar_format: SIDECAR_FORMAT, emitted_at, tool, subject, dnp: COMMONS_DIGEST_DOES_NOT_PROVE, digests };
}

// Canonical engine-receipt/1 envelope for a daylight.sidecar/1 export (fail-closed).
export async function sidecarEngineReceipt(meta = {}, opts = {}) {
  const engine = opts.engine || "cmmns";
  const flagship = opts.flagship || "cmmns";
  const task_id = opts.taskId || "daylight-sidecar-export";
  const emitted_at = opts.emittedAt || meta.savedAt || new Date().toISOString();
  const artifacts = await normaliseArtifacts(buildEntryList(meta, opts));
  const oracle = opts.oracle || null;
  const verdict = !oracle ? "UNVERIFIABLE" : oracle.exit_code === 0 && (oracle.fail_lines || 0) === 0 ? "MATCH" : "DRIFT";
  const subject = { engine, flagship, task_id, sidecar_format: SIDECAR_FORMAT, capture: captureSummary(meta), artifacts, oracle_command: oracle ? (oracle.command || []) : [] };
  const oracleClaim = oracle ? { exit_code: oracle.exit_code, stdout_sha256: oracle.stdout_sha256, stderr_sha256: oracle.stderr_sha256, pass_lines: oracle.pass_lines || 0, fail_lines: oracle.fail_lines || 0 } : null;
  const scope = deriveReceiptScope(engine, oracle, artifacts);
  const claim = { subject, verdict, oracle: oracleClaim, scope };
  const digests = await sealDigests("schema", ENGINE_RECEIPT_SCHEMA, subject, claim, opts.hmacKey || null);
  return { schema: ENGINE_RECEIPT_SCHEMA, in_toto_statement_type: IN_TOTO_STATEMENT, predicate_type: ENGINE_RECEIPT_PREDICATE, emitted_at, subject, verdict, oracle, scope, digests };
}

async function checkFiles(artifacts, files, errors) {
  if (!files) return;
  const lookup = files instanceof Map ? (k) => (files.has(k) ? files.get(k) : undefined) : (k) => (Object.prototype.hasOwnProperty.call(files, k) ? files[k] : undefined);
  for (const art of artifacts || []) {
    const raw = lookup(art.rel_path);
    if (raw === undefined) { errors.push(`missing artifact file: ${art.rel_path}`); continue; }
    const bytes = toBytes(raw);
    if (bytes.byteLength !== art.bytes) errors.push(`artifact byte length drift on ${art.rel_path}: live=${bytes.byteLength} receipt=${art.bytes}`);
    const liveSha = await sha256Prefixed(bytes);
    if (liveSha !== art.sha256) errors.push(`artifact SHA-256 drift on ${art.rel_path}: live=${liveSha} receipt=${art.sha256}`);
  }
}

function checkDigests(stored, expected, hmacKey, errors) {
  for (const k of ["subject_sha256", "claim_sha256", "envelope_sha256"]) {
    if (!stored || stored[k] !== expected[k]) errors.push(`digest mismatch on ${k}`);
  }
  if (hmacKey && (!stored || stored.signature !== expected.signature)) errors.push("HMAC-SHA256 signature mismatch");
}

export async function verifySidecarDigest(digest, { files = null, hmacKey = null } = {}) {
  const errors = [];
  if (!digest || typeof digest !== "object") return { ok: false, errors: ["digest is not an object"] };
  if (digest.format !== COMMONS_DIGEST_FORMAT) errors.push(`unexpected format: ${digest.format}`);
  if (digest.sidecar_format !== SIDECAR_FORMAT) errors.push(`unexpected sidecar_format: ${digest.sidecar_format}`);
  const subject = digest.subject || {};
  const claim = { format: digest.format, sidecar_format: digest.sidecar_format, tool: digest.tool, subject, dnp: digest.dnp };
  const expected = await sealDigests("format", COMMONS_DIGEST_FORMAT, subject, claim, hmacKey);
  checkDigests(digest.digests, expected, hmacKey, errors);
  await checkFiles(subject.artifacts, files, errors);
  return { ok: errors.length === 0, errors };
}

export async function verifySidecarEngineReceipt(receipt, { files = null, hmacKey = null } = {}) {
  const errors = [];
  if (!receipt || typeof receipt !== "object") return { ok: false, verdict: null, errors: ["receipt is not an object"] };
  if (receipt.schema !== ENGINE_RECEIPT_SCHEMA) errors.push(`unexpected schema: ${receipt.schema}`);
  const subject = receipt.subject || {};
  const oracle = receipt.oracle && typeof receipt.oracle === "object" ? receipt.oracle : null;
  const oracleClaim = oracle ? { exit_code: oracle.exit_code, stdout_sha256: oracle.stdout_sha256, stderr_sha256: oracle.stderr_sha256, pass_lines: oracle.pass_lines || 0, fail_lines: oracle.fail_lines || 0 } : null;
  const verdict = receipt.verdict;
  if (verdict === "MATCH" && (!oracleClaim || oracleClaim.exit_code !== 0 || oracleClaim.fail_lines !== 0)) errors.push("fail-closed violation: MATCH verdict without passing exit-0 oracle");
  const expectedScope = deriveReceiptScope(subject.engine || "", oracle, subject.artifacts || []);
  if (canonicalJson(receipt.scope) !== canonicalJson(expectedScope)) errors.push("scope mismatch: derived scope does not match stored scope");
  const claim = { subject, verdict, oracle: oracleClaim, scope: expectedScope };
  const expected = await sealDigests("schema", ENGINE_RECEIPT_SCHEMA, subject, claim, hmacKey);
  checkDigests(receipt.digests, expected, hmacKey, errors);
  await checkFiles(subject.artifacts, files, errors);
  return { ok: errors.length === 0, verdict, errors };
}

// One-call Daylight sidecar + receipt sidecar emitter: returns markdown, optional json,
// commons-digest/1, engine-receipt/1, and a filename -> UTF-8 string map ready to write.
export async function sidecarReceiptSidecars(meta, opts = {}) {
  const mdName = defaultSidecarName(opts.fileNames, opts.sidecarName);
  const stem = mdName.replace(/\.md$/, "");
  const sidecarMd = opts.sidecarMd != null ? opts.sidecarMd : sidecarMarkdown(meta, opts.fileNames);
  const sidecarJsonText = opts.includeJson ? sidecarJson(meta, opts.fileNames) : null;
  const common = { ...opts, sidecarName: mdName, sidecarMd, sidecarJsonText };
  const digest = await sidecarDigest(meta, common);
  const engineReceipt = await sidecarEngineReceipt(meta, common);
  const files = {
    [mdName]: sidecarMd,
    ...(sidecarJsonText != null ? { [`${stem}.json`]: sidecarJsonText } : {}),
    [`${stem}.digest.json`]: JSON.stringify(digest, null, 2) + "\n",
    [`${stem}.receipt.json`]: JSON.stringify(engineReceipt, null, 2) + "\n",
  };
  return { stem, sidecarMd, sidecarJson: sidecarJsonText, digest, engineReceipt, files };
}
