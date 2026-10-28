// Version 1 evidence documents stay readable after the version 2 rename (doesNotProve -> context):
// a signed version 1 bundle still verifies, fits schema/evidence.v1.json, passes `radar verify`, and
// readEvidence gives its items in version 2 field names without touching the signed original.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { analyzeThread, API_VERSION, EVIDENCE_SCHEMA } from "../src/core/api.js";
import { makeBundle, signBundle, verifyBundle, newBundleKey, readEvidence, EVIDENCE_V1, EVIDENCE_V2, BUNDLE_VERSION } from "../src/core/evidence-bundle.js";
import { validate } from "../bin/lib/jsonschema.mjs";

const schema = (v) => JSON.parse(readFileSync(new URL(`../schema/evidence.v${v}.json`, import.meta.url), "utf8"));
const THREAD = JSON.parse(readFileSync(new URL("./fixtures/integration/thread.json", import.meta.url), "utf8"));
const result = analyzeThread(THREAD, { now: Date.parse("2026-10-02T00:00:00Z") });
const LOCK = { alg: "SHA-256", of: "test", value: "0".repeat(64) };

// The same analysis as a version 1 document: API 1.x, schema v1, bundle version 1, doesNotProve.
function asVersion1(b) {
  const evidence = b.evidence.map(({ context, ...e }) => ({ ...e, doesNotProve: context }));
  return { ...b, version: 1, schema: EVIDENCE_V1, api: "1.1.0", evidence };
}

test("the current API writes version 2: schema v2, API 2.x, bundle version 2, items with context", () => {
  assert.equal(EVIDENCE_SCHEMA, EVIDENCE_V2);
  assert.match(API_VERSION, /^2\./);
  assert.equal(BUNDLE_VERSION, 2);
  assert.ok(result.evidence.every((e) => typeof e.context === "string" && !("doesNotProve" in e)));
});

test("a signed version 1 bundle verifies, fits the v1 schema and reads as version 2", async () => {
  const key = await newBundleKey();
  const v1 = await signBundle(asVersion1(makeBundle(result, { tool: "CMMNS test", dataLock: LOCK }).bundle), key);
  const v = await verifyBundle(v1);
  assert.equal(v.ok, true, JSON.stringify(v.checks));
  assert.deepEqual(validate(schema(1), v1), []);
  assert.notDeepEqual(validate(schema(2), v1), [], "a v1 document is not a v2 document");
  const read = readEvidence(v1);
  assert.ok(read.evidence.every((e) => typeof e.context === "string" && !("doesNotProve" in e)));
  assert.deepEqual(read.evidence.map((e) => e.context), v1.evidence.map((e) => e.doesNotProve));
  assert.ok(v1.evidence.every((e) => "doesNotProve" in e), "the signed original is left as it was");
  assert.equal((await verifyBundle(v1)).ok, true);
  const upgraded = { ...read, version: 2, schema: EVIDENCE_V2, api: API_VERSION };
  delete upgraded.signer; delete upgraded.signature;
  assert.deepEqual(validate(schema(2), upgraded), [], "the read items fit the v2 item shape");
});

test("radar verify accepts a version 1 bundle against its own schema", async () => {
  const key = await newBundleKey();
  const v1 = await signBundle(asVersion1(makeBundle(result, { tool: "CMMNS test", dataLock: LOCK }).bundle), key);
  const file = join(mkdtempSync(join(tmpdir(), "radar-v1-")), "v1.json");
  writeFileSync(file, JSON.stringify(v1));
  const r = spawnSync(process.execPath, [fileURLToPath(new URL("../bin/radar.mjs", import.meta.url)), "verify", file], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /fits schema\/evidence\.v1\.json/);
});

test("readEvidence passes a version 2 document through and ignores a document without evidence", () => {
  assert.deepEqual(readEvidence(result).evidence, result.evidence);
  assert.equal(readEvidence(null), null);
  assert.deepEqual(readEvidence({ kind: "x" }), { kind: "x" });
});
