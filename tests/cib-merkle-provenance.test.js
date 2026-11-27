import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CIB_PROVENANCE_SCHEMA,
  LAWFUL_PUBLIC_SCOPE,
  buildCibEvidenceBundle,
  buildInclusionProof,
  computeMerkleRoot,
  redactPiiText,
  verifyCibEvidenceBundle,
  verifyInclusionProof,
} from "../src/core/cib-merkle-provenance.js";
import { verifyCibBundleFile } from "../bin/lib/cib-provenance-verify.mjs";
import { main } from "../bin/radar.mjs";

function sampleInputs() {
  return {
    scope: LAWFUL_PUBLIC_SCOPE,
    emittedAt: "2026-11-27T01:05:00.000Z",
    records: [
      {
        record_id: "pub-001",
        platform: "bluesky",
        source_url: "https://bsky.app/profile/example.bsky.social/post/3kabc111",
        captured_at: "2026-11-26T18:00:00Z",
        aggregate_only: true,
        canonical_excerpt: "Public archived reply cluster A posted identical link within 14 seconds.",
      },
      {
        record_id: "pub-002",
        platform: "mastodon",
        source_url: "https://mastodon.social/@publicarchive/1122334455",
        captured_at: "2026-11-26T18:00:14Z",
        aggregate_only: true,
        canonical_excerpt: "Public archived reply cluster B repeated identical headline across 9 accounts.",
      },
      {
        record_id: "pub-003",
        platform: "public_archive",
        source_url: "https://archive.org/details/example-factcheck-2026",
        captured_at: "2026-11-26T18:05:00Z",
        aggregate_only: true,
        canonical_excerpt: "Independent fact-check archive noting manipulated date on recirculated clip.",
      },
    ],
    findings: [
      {
        finding_id: "cib-cluster-01",
        signal_kind: "synchronized_burst",
        summary: "Aggregate burst of 9 public replies sharing identical text within a 14-second window.",
        citations: [],
      },
    ],
  };
}

async function buildValidSample(hmacKey = null) {
  const inp = sampleInputs();
  const seed = await buildCibEvidenceBundle({
    scope: inp.scope,
    emittedAt: inp.emittedAt,
    records: inp.records,
    findings: [],
  });
  inp.findings[0].citations = [
    { record_id: "pub-001", source_sha256: seed.records[0].source_sha256 },
    { record_id: "pub-002", source_sha256: seed.records[1].source_sha256 },
    { record_id: "pub-003", source_sha256: seed.records[2].source_sha256 },
  ];
  return buildCibEvidenceBundle({ ...inp, hmacKey });
}

test("RFC 6962 Merkle root and inclusion proofs verify deterministically across odd leaf counts", async () => {
  const leaves = ["alpha", "beta", "gamma", "delta", "epsilon"];
  const root = await computeMerkleRoot(leaves);
  assert.match(root, /^sha256:[0-9a-f]{64}$/);
  for (let i = 0; i < leaves.length; i++) {
    const proof = await buildInclusionProof(leaves, i);
    assert.equal(await verifyInclusionProof(leaves[i], i, leaves.length, proof, root), true);
    assert.equal(await verifyInclusionProof(leaves[i] + "!", i, leaves.length, proof, root), false);
  }
});

test("Clean lawful public-record CIB bundle seals and verifies MATCH with engine-receipt/1", async () => {
  const bundle = await buildValidSample("wave48c-hmac-key");
  assert.equal(bundle.schema, CIB_PROVENANCE_SCHEMA);
  assert.equal(bundle.merkle.algorithm, "rfc6962-sha256");
  assert.equal(bundle.merkle.leaf_count, 3);
  const res = await verifyCibEvidenceBundle(bundle, { hmacKey: "wave48c-hmac-key" });
  assert.equal(res.ok, true, res.errors.join("; "));
  assert.equal(res.verdict, "MATCH");
  assert.equal(res.checks.lawful_public_scope, true);
  assert.equal(res.checks.pii_firewall_clean, true);
  assert.equal(res.checks.merkle_root_and_proofs_valid, true);
  assert.equal(res.checks.citation_chain_valid, true);
  assert.equal(res.checks.engine_receipt_valid, true);
});

test("Planted failing control 1: tampered source hash or 1-byte excerpt mutation fails closed (DRIFT)", async () => {
  const bundle = await buildValidSample();
  const mutated = structuredClone(bundle);
  mutated.records[0].canonical_excerpt += " ";
  const res = await verifyCibEvidenceBundle(mutated);
  assert.equal(res.ok, false);
  assert.equal(res.verdict, "DRIFT");
  assert.equal(res.checks.source_hashes_valid, false);
  assert.equal(res.checks.merkle_root_and_proofs_valid, false);
  assert.equal(res.checks.engine_receipt_valid, false);
});

test("Planted failing control 2: unredacted PII or secret leak is refused at build and verify", async () => {
  const inp = sampleInputs();
  inp.records[0].canonical_excerpt = "Contact private user jane.doe@example.org or 555-234-5678 or SSN 123-45-6789.";
  await assert.rejects(() => buildCibEvidenceBundle({ ...inp, findings: [] }), /pii_leak_detected/);

  const redacted = redactPiiText(inp.records[0].canonical_excerpt);
  assert.ok(!redacted.includes("jane.doe@example.org") && !redacted.includes("123-45-6789"));

  const bundle = await buildValidSample();
  const leaked = structuredClone(bundle);
  leaked.findings[0].summary += " leak token ghp_1234567890abcdefghij123456";
  const res = await verifyCibEvidenceBundle(leaked);
  assert.equal(res.ok, false);
  assert.equal(res.verdict, "DRIFT");
  assert.equal(res.checks.pii_firewall_clean, false);
  assert.ok(res.pii_findings.some((p) => p.kind === "secret_token"));
});

test("Planted failing control 3: broken citation chain (missing record or mismatched source hash) fails closed", async () => {
  const bundle = await buildValidSample();
  const brokenMissing = structuredClone(bundle);
  brokenMissing.findings[0].citations.push({ record_id: "pub-999", source_sha256: bundle.records[0].source_sha256 });
  const r1 = await verifyCibEvidenceBundle(brokenMissing);
  assert.equal(r1.ok, false);
  assert.equal(r1.checks.citation_chain_valid, false);

  const brokenHash = structuredClone(bundle);
  brokenHash.findings[0].citations[0].source_sha256 = "sha256:" + "0".repeat(64);
  const r2 = await verifyCibEvidenceBundle(brokenHash);
  assert.equal(r2.ok, false);
  assert.equal(r2.checks.citation_chain_valid, false);
});

test("Planted failing control 4: private-individual tracking or covert surveillance scope is refused", async () => {
  const inp = sampleInputs();
  await assert.rejects(
    () => buildCibEvidenceBundle({ ...inp, scope: "private_individual_tracking", findings: [] }),
    /unlawful_private_target_rejected/,
  );
  inp.records[0].home_address = "123 Private Ln";
  await assert.rejects(
    () => buildCibEvidenceBundle({ ...inp, findings: [] }),
    /unlawful_private_target_rejected/,
  );
  const bundle = await buildValidSample();
  const bad = structuredClone(bundle);
  bad.records[0].gps_trace = [[47.38, -122.23]];
  const res = await verifyCibEvidenceBundle(bad);
  assert.equal(res.ok, false);
  assert.equal(res.checks.lawful_public_scope, false);
});

test("Planted failing control 5: forged Merkle inclusion proof fails closed and CLI exits non-zero", async () => {
  const bundle = await buildValidSample();
  const forged = structuredClone(bundle);
  forged.merkle.inclusion_proofs[0].proof[0] = "sha256:" + "f".repeat(64);
  const res = await verifyCibEvidenceBundle(forged);
  assert.equal(res.ok, false);
  assert.equal(res.checks.merkle_root_and_proofs_valid, false);

  const dir = mkdtempSync(join(tmpdir(), "cmmns-cib-"));
  try {
    const okPath = join(dir, "ok.bundle.json");
    const badPath = join(dir, "forged.bundle.json");
    writeFileSync(okPath, JSON.stringify(bundle, null, 2));
    writeFileSync(badPath, JSON.stringify(forged, null, 2));
    assert.equal((await verifyCibBundleFile(okPath)).ok, true);
    assert.equal((await verifyCibBundleFile(badPath)).ok, false);
    assert.equal(await main(["provenance", "cib-verify", okPath, "--json"]), 0);
    assert.equal(await main(["provenance", "cib-verify", badPath, "--json"]), 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
