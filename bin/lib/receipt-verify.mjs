// CLI verifier for commons-digest/1 and engine-receipt/1 sidecar files.
// Reads local sibling files beside the receipt and verifies SHA-256 digests byte-for-byte.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { COMMONS_DIGEST_FORMAT, ENGINE_RECEIPT_SCHEMA, verifySidecarDigest, verifySidecarEngineReceipt } from "../../src/core/sidecar-receipt.js";

export function isSidecarReceipt(doc) {
  return !!(doc && (doc.format === COMMONS_DIGEST_FORMAT || doc.schema === ENGINE_RECEIPT_SCHEMA));
}

function loadSiblings(receiptFile, artifacts = []) {
  const dir = dirname(receiptFile);
  const files = new Map();
  for (const a of artifacts) {
    if (!a || !a.rel_path) continue;
    const p = join(dir, a.rel_path);
    if (existsSync(p)) files.set(a.rel_path, readFileSync(p));
  }
  return files;
}

export async function verifySidecarReceiptFile(receiptFile, doc, { hmacKey = null } = {}) {
  const artifacts = (doc.subject && doc.subject.artifacts) || [];
  const files = loadSiblings(receiptFile, artifacts);
  if (doc.format === COMMONS_DIGEST_FORMAT) {
    const r = await verifySidecarDigest(doc, { files, hmacKey });
    return { format: COMMONS_DIGEST_FORMAT, ok: r.ok, artifacts: artifacts.length, errors: r.errors };
  }
  const r = await verifySidecarEngineReceipt(doc, { files, hmacKey });
  return { schema: ENGINE_RECEIPT_SCHEMA, verdict: r.verdict, ok: r.ok, artifacts: artifacts.length, errors: r.errors };
}

export function receiptLines(file, r) {
  const kind = r.format || r.schema;
  const out = [`${file} (${kind}): ${r.ok ? "ok" : "FAILED"} (${r.artifacts} artifacts checked${r.verdict ? `, verdict ${r.verdict}` : ""})`];
  for (const e of r.errors) out.push(`  fail  ${e}`);
  return out.join("\n") + "\n";
}
