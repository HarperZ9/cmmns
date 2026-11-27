// Offline CLI runner for `cmmns provenance cib-verify <bundle.json> [--json]`.
// Verifies a cmmns.cib-merkle-provenance/1 lawful public-record CIB evidence bundle
// fail-closed (RFC 6962 Merkle root, inclusion proofs, PII firewall, citation chain, engine-receipt/1).
import { readFileSync } from "node:fs";
import { verifyCibEvidenceBundle } from "../../src/core/cib-merkle-provenance.js";

export async function verifyCibBundleFile(filePath, { hmacKey = null } = {}) {
  const raw = readFileSync(filePath, "utf8");
  let bundle;
  try {
    bundle = JSON.parse(raw);
  } catch (e) {
    return { schema: "cmmns.cib-merkle-provenance/1", ok: false, verdict: "UNVERIFIABLE", errors: [`invalid JSON: ${e.message}`], checks: {}, pii_findings: [] };
  }
  return verifyCibEvidenceBundle(bundle, { hmacKey });
}

export function cibProvenanceLines(filePath, r) {
  const out = [`${filePath} (${r.schema}): ${r.verdict} (merkle=${r.merkle_root || "none"}, errors=${(r.errors || []).length})`];
  for (const e of r.errors || []) out.push(`  fail  ${e}`);
  return out.join("\n") + "\n";
}
