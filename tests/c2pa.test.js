// Content Credentials reader. Fixtures in tests/fixtures/c2pa/ are synthetic: flat-colour images and
// a minimal MP4 built by scripts/c2pa-fixtures.py and signed by c2patool with its test certificate.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readCredentials, credentialState } from "../src/core/c2pa.js";
import { cborDecode, cborEncode } from "../src/core/cbor.js";

const load = (f) => new Uint8Array(readFileSync(new URL(`./fixtures/c2pa/${f}`, import.meta.url)));
const find = (b, s) => { const n = new TextEncoder().encode(s); outer: for (let i = 0; i < b.length - n.length; i++) { for (let k = 0; k < n.length; k++) if (b[i + k] !== n[k]) continue outer; return i; } return -1; };
const flip = (b, i) => { const c = b.slice(); c[i] ^= 0x01; return c; };

for (const f of ["ai.jpg", "ai.png", "ai.webp", "ai.mp4"]) {
  test(`${f}: credentials found, every check passes, generative AI named`, async () => {
    const r = await readCredentials(load(f));
    assert.equal(r.found, true);
    assert.deepEqual(Object.values(r.checks).map((c) => c.ok), [true, true, true], JSON.stringify(r.checks));
    assert.equal(credentialState(r), "unchanged");
    assert.equal(r.active.ai, true);
    assert.equal(r.active.actions[0].action, "c2pa.created");
    assert.equal(r.active.actions[0].source.code, "trainedAlgorithmicMedia");
    assert.equal(r.active.actions[0].agent, "Synthetic Generator 9.9");
    assert.equal(r.active.generator, "Radar fixture builder 1.0");
    assert.equal(r.active.cert.subject.CN, "C2PA Signer");
    assert.equal(r.active.cert.subject.O, "C2PA Test Signing Cert");
    assert.equal(r.active.alg, "ES256");
  });
}

test("claim version 1 and an RSA-PSS signer verify too", async () => {
  const v1 = await readCredentials(load("camera-v1.jpg"));
  assert.equal(v1.active.claimVersion, 1);
  assert.equal(credentialState(v1), "unchanged");
  assert.equal(v1.active.ai, false);
  assert.equal(v1.active.actions[0].source.kind, "capture");
  const ps = await readCredentials(load("camera-ps256.jpg"));
  assert.equal(ps.active.alg, "PS256");
  assert.equal(ps.checks.signature.ok, true, ps.checks.signature.text);
});

test("an edit of an AI image: the earlier manifest's AI claim is surfaced", async () => {
  const r = await readCredentials(load("edited.jpg"));
  assert.equal(r.manifests, 2);
  assert.equal(r.active.ai, false);
  assert.equal(r.earlier[0].ai, true);
  assert.equal(r.earlier[0].signature.ok, true);
  assert.equal(r.aiAnywhere, true);
  assert.equal(r.active.ingredients[0].relationship, "parentOf");
  assert.equal(credentialState(r), "unchanged");
});

// Controls: each must fail, and fail in the check that covers the change.
test("tampered image bytes fail the binding (committed fixture)", async () => {
  const r = await readCredentials(load("tampered.jpg"));
  assert.equal(r.checks.binding.ok, false);
  assert.equal(r.checks.signature.ok, true);
  assert.equal(credentialState(r), "changed");
});

test("a changed assertion fails the assertion hash, not the signature", async () => {
  const b = load("ai.jpg"), i = find(b, "Synthetic Generator");
  assert.ok(i > 0);
  const r = await readCredentials(flip(b, i + 3));
  assert.equal(r.checks.assertions.ok, false);
  assert.equal(r.checks.signature.ok, true);
  assert.equal(credentialState(r), "changed");
});

test("a changed claim fails the signature", async () => {
  const b = load("ai.jpg"), i = find(b, "dc:title");
  const r = await readCredentials(flip(b, i + 11));
  assert.equal(r.checks.signature.ok, false, r.checks.signature.text);
  assert.equal(credentialState(r), "changed");
});

test("a changed video byte fails the BMFF binding", async () => {
  const b = load("ai.mp4");
  const r = await readCredentials(flip(b, b.length - 5));
  assert.equal(r.checks.binding.ok, false);
  assert.equal(credentialState(r), "changed");
});

test("a partial read leaves the binding unchecked rather than passed", async () => {
  const r = await readCredentials(load("ai.jpg"), { complete: false });
  assert.equal(r.checks.binding.ok, null);
  assert.equal(credentialState(r), "unchecked");
});

test("no credentials: found false, state none, never a pass", async () => {
  const r = await readCredentials(load("plain.jpg"));
  assert.equal(r.found, false);
  assert.equal(credentialState(r), "none");
  for (const junk of [new Uint8Array(0), new Uint8Array(40), Uint8Array.from([0xff, 0xd8, 0xff, 0xeb, 0, 4, 0x4a, 0x50])]) {
    const j = await readCredentials(junk);
    assert.notEqual(credentialState(j), "unchanged");
  }
});

test("a truncated manifest store is reported as unreadable, not as valid", async () => {
  const b = load("ai.png"), i = find(b, "caBX");
  const cut = b.slice(0, i + 600);
  const r = await readCredentials(cut);
  assert.notEqual(credentialState(r), "unchanged");
});

test("cbor round trip for the Sig_structure subset", () => {
  const v = ["Signature1", Uint8Array.of(1, 2, 3), new Uint8Array(0), "x".repeat(300), -7, 70000];
  const back = cborDecode(cborEncode(v));
  assert.equal(back[0], "Signature1");
  assert.deepEqual([...back[1]], [1, 2, 3]);
  assert.equal(back[3].length, 300);
  assert.equal(back[4], -7);
  assert.equal(back[5], 70000);
});

// Fail-safe: a version 1 claim in MP4 is the form where Radar and c2patool 0.27.22 disagreed
// (legacy.mp4 in the c2pa-rs fixtures). Until agreement is shown, it is never "unchanged".
test("a version 1 claim in MP4 reads as not fully verified, never unchanged", async () => {
  const r = await readCredentials(load("camera-v1.mp4"));
  assert.equal(r.active.claimVersion, 1);
  assert.equal(r.checks.signature.ok, true);
  assert.equal(r.checks.format.ok, null);
  assert.match(r.checks.format.text, /could not fully verify \(older manifest format\)/);
  assert.equal(credentialState(r), "unchecked");
});
