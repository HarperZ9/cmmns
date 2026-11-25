// Deterministic commons-digest/1 and engine-receipt/1 SHA-256 capture receipts for
// daylight.sidecar/1 exports: round-trip verification, determinism across input order,
// fail-closed verdict checks, HMAC signatures, planted 1-byte tamper detection, and CLI integration.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { postMeta, sidecarMarkdown, SIDECAR_FORMAT } from "../src/core/media-meta.js";
import {
  COMMONS_DIGEST_FORMAT, ENGINE_RECEIPT_SCHEMA, canonicalJson, sha256Prefixed,
  sidecarDigest, sidecarEngineReceipt, verifySidecarDigest, verifySidecarEngineReceipt, sidecarReceiptSidecars,
} from "../src/core/sidecar-receipt.js";
import { makeReceipt } from "../src/core/receipt.js";
import { appendSeal, emptySeal, exportSeal } from "../src/core/evidence-seal.js";
import { exportProfile } from "../src/core/export-profiles.js";

const ROOT = join(import.meta.dirname, "..");
const CLI = join(ROOT, "bin", "radar.mjs");
const DEMO = join(ROOT, "docs", "demo");
const NOW = "2026-11-25T12:00:00.000Z";

const sampleMeta = postMeta({
  site: "x",
  text: "Ceramics note: caf\u00e9 glaze test #ceramics https://ex.ample/glaze",
  authorName: "Mara K",
  handle: "@marak",
  postUrl: "https://x.com/marak/status/1957913446118285360",
  postedAt: "2026-11-20T08:15:00Z",
  alt: "Test tile with celadon slip",
}, NOW);

const flipOneByte = (bytes) => {
  const copy = new Uint8Array(bytes);
  copy[copy.length >> 1] ^= 0x01;
  return copy;
};

test("canonicalJson sorts keys recursively and escapes non-ASCII identically to Python ensure_ascii", () => {
  const a = canonicalJson({ b: 2, a: "caf\u00e9", nested: { z: true, y: null, undef: undefined } });
  const b = canonicalJson({ nested: { y: null, z: true }, a: "caf\u00e9", b: 2 });
  assert.equal(a, b);
  assert.equal(a, '{"a":"caf\\u00e9","b":2,"nested":{"y":null,"z":true}}');
});

test("commons-digest/1 and engine-receipt/1 are deterministic regardless of artifact input order", async () => {
  const img = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
  const thread = '{"format":"cmmns.capture-thread/2","comments":[]}\n';
  const md = sidecarMarkdown(sampleMeta, ["tile.jpg"]);
  const optsA = { fileNames: ["tile.jpg"], sidecarMd: md, emittedAt: NOW, files: [{ name: "tile.jpg", data: img }, { name: "tile.thread.json", data: thread }] };
  const optsB = { fileNames: ["tile.jpg"], sidecarMd: md, emittedAt: NOW, files: [{ name: "tile.thread.json", data: thread }, { name: "tile.jpg", data: img }] };

  const dA = await sidecarDigest(sampleMeta, optsA);
  const dB = await sidecarDigest(sampleMeta, optsB);
  assert.equal(JSON.stringify(dA), JSON.stringify(dB));
  assert.equal(dA.format, COMMONS_DIGEST_FORMAT);
  assert.equal(dA.sidecar_format, SIDECAR_FORMAT);
  assert.deepEqual(dA.subject.artifacts.map((a) => a.rel_path), ["tile.jpg", "tile.md", "tile.thread.json"]);

  const rA = await sidecarEngineReceipt(sampleMeta, optsA);
  const rB = await sidecarEngineReceipt(sampleMeta, optsB);
  assert.equal(JSON.stringify(rA), JSON.stringify(rB));
  assert.equal(rA.schema, ENGINE_RECEIPT_SCHEMA);
  assert.equal(rA.verdict, "UNVERIFIABLE");
});

test("planted 1-byte tamper on sidecar markdown, media bytes, or receipt fields breaks verification", async () => {
  const media = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const bundle = await sidecarReceiptSidecars(sampleMeta, {
    fileNames: ["tile.jpg"],
    includeJson: true,
    emittedAt: NOW,
    files: [{ name: "tile.jpg", data: media }],
  });
  assert.ok(bundle.sidecarMd.startsWith('---\nformat: "daylight.sidecar/1"\n'));
  const intact = new Map([
    ["tile.md", new TextEncoder().encode(bundle.sidecarMd)],
    ["tile.json", new TextEncoder().encode(bundle.sidecarJson)],
    ["tile.jpg", media],
  ]);

  assert.equal((await verifySidecarDigest(bundle.digest, { files: intact })).ok, true);
  assert.equal((await verifySidecarEngineReceipt(bundle.engineReceipt, { files: intact })).ok, true);

  // 1-byte tamper in sidecar markdown
  const tamperedMd = new Map(intact);
  tamperedMd.set("tile.md", flipOneByte(intact.get("tile.md")));
  const dMd = await verifySidecarDigest(bundle.digest, { files: tamperedMd });
  const rMd = await verifySidecarEngineReceipt(bundle.engineReceipt, { files: tamperedMd });
  assert.equal(dMd.ok, false);
  assert.match(dMd.errors.join("; "), /SHA-256 drift on tile\.md/);
  assert.equal(rMd.ok, false);
  assert.match(rMd.errors.join("; "), /SHA-256 drift on tile\.md/);

  // 1-byte tamper in attached media file
  const tamperedImg = new Map(intact);
  tamperedImg.set("tile.jpg", flipOneByte(media));
  assert.equal((await verifySidecarDigest(bundle.digest, { files: tamperedImg })).ok, false);
  assert.equal((await verifySidecarEngineReceipt(bundle.engineReceipt, { files: tamperedImg })).ok, false);

  // 1-byte tamper inside the digest JSON itself
  const forgedDigest = structuredClone(bundle.digest);
  forgedDigest.subject.capture.site = "y";
  const dForged = await verifySidecarDigest(forgedDigest, { files: intact });
  assert.equal(dForged.ok, false);
  assert.match(dForged.errors.join("; "), /digest mismatch on subject_sha256/);

  // 1-byte tamper inside engine-receipt/1 JSON
  const forgedReceipt = structuredClone(bundle.engineReceipt);
  forgedReceipt.subject.task_id = "daylight-sidecar-exporu";
  const rForged = await verifySidecarEngineReceipt(forgedReceipt, { files: intact });
  assert.equal(rForged.ok, false);
  assert.match(rForged.errors.join("; "), /digest mismatch on subject_sha256/);
});

test("engine-receipt/1 is fail-closed and validates HMAC signatures", async () => {
  const oracle = {
    command: ["node", "--test", "tests/sidecar-receipt.test.js"],
    exit_code: 0,
    stdout_sha256: await sha256Prefixed("ok\n"),
    stderr_sha256: await sha256Prefixed(""),
    pass_lines: 1,
    fail_lines: 0,
  };
  const key = "test-hmac-secret";
  const receipt = await sidecarEngineReceipt(sampleMeta, { fileNames: ["tile.jpg"], emittedAt: NOW, oracle, hmacKey: key });
  assert.equal(receipt.verdict, "MATCH");
  assert.match(receipt.digests.signature, /^hmac-sha256:[0-9a-f]{64}$/);
  assert.equal((await verifySidecarEngineReceipt(receipt, { hmacKey: key })).ok, true);
  assert.equal((await verifySidecarEngineReceipt(receipt, { hmacKey: "wrong-secret" })).ok, false);

  // Forged MATCH without a passing oracle is rejected even if digests were recomputed
  const noOracle = await sidecarEngineReceipt(sampleMeta, { fileNames: ["tile.jpg"], emittedAt: NOW });
  assert.equal(noOracle.verdict, "UNVERIFIABLE");
  const forgedMatch = structuredClone(noOracle);
  forgedMatch.verdict = "MATCH";
  const res = await verifySidecarEngineReceipt(forgedMatch);
  assert.equal(res.ok, false);
  assert.match(res.errors.join("; "), /fail-closed violation/);
});

test("exportProfile --receipt emits verifiable commons-digest.json and engine-receipt.json and CLI verify catches 1-byte tamper", async () => {
  const r1 = await makeReceipt({ kind: "domain-age", subject: "example.org", observed: { daysBeforePost: 14 }, source: "RDAP", at: NOW, dnp: "Registration age only." });
  const chain = await exportSeal(await appendSeal(emptySeal(), r1), { title: "t", at: NOW });
  const exported = await exportProfile(chain, "legal", { at: NOW, tool: "test", receipt: true });
  assert.equal(exported.ok, true);
  assert.ok(exported.files["commons-digest.json"] && exported.files["engine-receipt.json"]);

  const dir = mkdtempSync(join(tmpdir(), "cmmns-receipt-cli-"));
  try {
    const out = join(dir, "legal");
    const run = (...args) => spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
    const ex = run("export", join(DEMO, "demo-evidence-chain.json"), "--profile", "legal", "--out", out, "--receipt");
    assert.equal(ex.status, 0, ex.stderr);
    assert.equal(run("verify", join(out, "commons-digest.json")).status, 0);
    assert.equal(run("verify", join(out, "engine-receipt.json")).status, 0);

    // Plant a 1-byte tamper in DOSSIER.md and confirm CLI verify fails closed
    const dossierPath = join(out, "DOSSIER.md");
    const orig = readFileSync(dossierPath);
    writeFileSync(dossierPath, flipOneByte(orig));
    const vDigest = run("verify", join(out, "commons-digest.json"));
    const vReceipt = run("verify", join(out, "engine-receipt.json"));
    assert.equal(vDigest.status, 1);
    assert.match(vDigest.stdout, /SHA-256 drift on DOSSIER\.md/);
    assert.equal(vReceipt.status, 1);
    assert.match(vReceipt.stdout, /SHA-256 drift on DOSSIER\.md/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
