// The Content Credentials validation report and its badge. Fixtures in tests/fixtures/c2pa-report/
// are synthetic, built by scripts/c2pa-report-fixtures.mjs with throwaway keys: a test root, a signer,
// a signer revoked on 2026-06-01, a CRL and OCSP responses, and manifests in a flat-colour JPEG.
// Each case has a positive, a negative and a false-positive control. Times are fixed so the
// results do not drift: the CRL and the OCSP responses "now" are current from 2026-10-01 to 2027-01-01.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { c2paReport, C2PA_REPORT_SCHEMA } from "../src/core/c2pa-report.js";
import { credentialState, readCredentials } from "../src/core/c2pa.js";
import { credentialRows } from "../src/core/mediacheck.js";
import { credentialReport } from "../src/core/api.js";

const load = (f) => new Uint8Array(readFileSync(new URL(`./fixtures/${f}`, import.meta.url)));
const R = (f) => load(`c2pa-report/${f}`);
const NOW = "2026-11-02T00:00:00Z";
const PKI = { now: NOW, trustAnchors: [R("root.der")], crls: [R("crl.der")] };
const ids = (r) => r.weaknesses.map((w) => w.id);
const flipLast = (b, back = 10) => { const c = b.slice(); c[c.length - back] ^= 0x01; return c; };
const BANNED = /authentic|genuine|\bfake\b|\breal\b|verified as true|\bnot revoked\b/i;

// 1. A revoked certificate. The C2PA checks alone still pass: that is the failure mode.
test("revoked: the C2PA checks pass, and the report says revoked since the CRL's date", async () => {
  assert.equal(credentialState(await readCredentials(R("revoked.jpg"))), "unchanged");
  const r = await c2paReport(R("revoked.jpg"), PKI);
  assert.equal(r.signature.valid, true);
  assert.equal(r.chain.trusted, true);
  assert.equal(r.revocation.atSigning.status, "good", "stapled at signing, before the revocation");
  assert.equal(r.revocation.now.status, "revoked");
  assert.equal(r.revocation.now.method, "crl");
  assert.equal(r.revocation.now.revokedAt, "2026-06-01T00:00:00.000Z");
  assert.equal(r.revocation.now.reason, "keyCompromise");
  assert.equal(r.revocation.now.checkedAt, "2026-11-02T00:00:00.000Z");
  assert.equal(r.badge.level, "flag");
  assert.match(r.badge.text, /^signed by CMMNS Fixture Signer Revoked; certificate revoked since 2026-06-01;/);
  assert.ok(ids(r).includes("revoked-after-signing"));
});

test("revoked: an OCSP response the caller fetched gives the same answer", async () => {
  const r = await c2paReport(R("revoked.jpg"), { now: NOW, trustAnchors: [R("root.der")], ocsp: [R("ocsp-revoked.der")] });
  assert.equal(r.revocation.now.status, "revoked");
  assert.equal(r.revocation.now.method, "ocsp");
  assert.equal(r.revocation.now.authorityTime, "2026-10-01T00:00:00.000Z");
});

test("revoked, negative: the same CRL leaves the unrevoked signer good", async () => {
  const r = await c2paReport(R("complete.jpg"), PKI);
  assert.equal(r.revocation.now.status, "good");
  assert.doesNotMatch(r.badge.text, /revoked/);
  assert.ok(!ids(r).includes("revoked-after-signing"));
});

test("revoked, false-positive controls: no evidence, a forged CRL, a stale CRL or the wrong OCSP answer never read as good", async () => {
  const offline = await c2paReport(R("revoked.jpg"), { now: NOW, trustAnchors: [R("root.der")] });
  assert.equal(offline.revocation.now.status, "unknown");
  assert.match(offline.revocation.now.text, /offline/);
  assert.match(offline.badge.text, /not checked: revocation/);
  const forged = await c2paReport(R("revoked.jpg"), { now: NOW, trustAnchors: [R("root.der")], crls: [R("crl-forged.der")] });
  assert.equal(forged.revocation.now.status, "unknown");
  assert.match(forged.revocation.now.text, /not signed by the certificate's issuer/);
  const stale = await c2paReport(R("revoked.jpg"), { ...PKI, now: "2027-02-01T00:00:00Z" });
  assert.equal(stale.revocation.now.status, "unknown");
  assert.match(stale.revocation.now.text, /expired on 2027-01-01/);
  const other = await c2paReport(R("revoked.jpg"), { now: NOW, trustAnchors: [R("root.der")], ocsp: [R("ocsp-good.der")] });
  assert.equal(other.revocation.now.status, "unknown", "a good answer about another serial says nothing");
  for (const r of [offline, forged, stale, other]) assert.doesNotMatch(r.badge.text, BANNED);
});

// 2. The AI-origin field stripped, as in arXiv:2603.02378. Still validates under the spec.
test("AI field stripped: every C2PA check passes, and the report names the absent field", async () => {
  for (const f of ["ai-stripped.jpg", "created-no-source.jpg"]) {
    assert.equal(credentialState(await readCredentials(R(f))), "unchanged", f);
    const r = await c2paReport(R(f), PKI);
    assert.equal(r.signature.valid, true, f);
    assert.equal(r.binding.hard.valid, true, f);
    assert.equal(r.fields.aiOrigin, "absent", f);
    assert.equal(r.fields.digitalSourceType, null, f);
    assert.ok(ids(r).includes("ai-origin-optional"), f);
    assert.match(r.badge.text, /AI-origin field absent, which the spec does not require/, f);
  }
  const opened = await c2paReport(R("ai-stripped.jpg"), PKI);
  assert.deepEqual(opened.fields.actions.map((a) => a.action), ["c2pa.opened", "c2pa.edited"]);
});

test("AI field stripped, negative: the complete manifest declares AI and the weakness does not apply", async () => {
  const r = await c2paReport(R("complete.jpg"), PKI);
  assert.equal(r.fields.aiOrigin, "declared-ai");
  assert.equal(r.fields.digitalSourceType.code, "trainedAlgorithmicMedia");
  assert.equal(r.fields.softwareAgent, "Synthetic Generator 9.9");
  assert.ok(!ids(r).includes("ai-origin-optional"));
  assert.match(r.badge.text, /says it was made with generative AI \(Synthetic Generator 9\.9\)/);
});

test("AI field stripped, false-positive controls: a capture claim is not 'absent', and a changed file is not hidden", async () => {
  const cam = await c2paReport(load("c2pa/camera-ps256.jpg"), { now: NOW });
  assert.equal(cam.fields.aiOrigin, "declared-not-ai");
  assert.ok(!ids(cam).includes("ai-origin-optional"));
  assert.match(cam.badge.text, /declares its source: captured by a camera or recorder \(digitalCapture\)/);
  const edited = await c2paReport(load("c2pa/edited.jpg"), { now: NOW });
  assert.equal(edited.fields.aiOrigin, "earlier-ai", "an earlier manifest's AI claim counts");
  const changed = await c2paReport(flipLast(R("ai-stripped.jpg")), PKI);
  assert.equal(changed.binding.hard.valid, false);
  assert.equal(changed.badge.level, "flag");
  assert.match(changed.badge.text, /the file changed after signing/);
});

// 3. A valid, complete manifest.
test("complete: every field checks out against the anchor and the CRL", async () => {
  const r = await c2paReport(R("complete.jpg"), PKI);
  assert.equal(r.schema, C2PA_REPORT_SCHEMA);
  assert.equal(r.signature.valid, true);
  assert.equal(r.assertions.valid, true);
  assert.equal(r.chain.trusted, true);
  assert.equal(r.chain.anchor.CN, "CMMNS Fixture Root");
  assert.equal(r.binding.hard.type, "c2pa.hash.data");
  assert.equal(r.binding.hard.valid, true);
  assert.deepEqual(r.binding.hard.exclusions.map((e) => e.onlyCredentials), [true]);
  assert.equal(r.binding.soft.present, false);
  assert.equal(r.signer.serial, "1001");
  assert.deepEqual(r.signer.revocationPointers, { ocsp: ["http://ocsp.example.test/"], crl: ["http://crl.example.test/root.crl"] });
  assert.equal(r.fields.claimGenerator, "CMMNS report fixture builder 1.0");
  assert.equal(r.badge.text, "signed by CMMNS Fixture Signer; says it was made with generative AI (Synthetic Generator 9.9)");
  assert.deepEqual(ids(r), ["revocation-optional", "expiry-unverifiable", "validators-disagree"]);
  assert.deepEqual(JSON.parse(JSON.stringify(r)), r, "plain JSON, no byte arrays");
});

test("complete, negative: a changed pixel byte fails the binding, a changed claim fails the signature", async () => {
  const pixel = await c2paReport(flipLast(R("complete.jpg")), PKI);
  assert.equal(pixel.binding.hard.valid, false);
  assert.equal(pixel.badge.level, "flag");
  const b = R("complete.jpg"), i = Buffer.from(b).indexOf("dc:title");
  const claim = b.slice(); claim[i + 11] ^= 0x01;
  const r = await c2paReport(claim, PKI);
  assert.equal(r.signature.valid, false);
  assert.match(r.badge.text, /^the signature does not match the claim/);
});

test("complete, false-positive controls: without the right anchor the name is never 'signed by'", async () => {
  const none = await c2paReport(R("complete.jpg"), { now: NOW, crls: [R("crl.der")] });
  assert.equal(none.chain.trusted, null);
  assert.match(none.badge.text, /^valid signature from a certificate naming "CMMNS Fixture Signer";.*not checked: trust list$/);
  const wrong = await c2paReport(R("complete.jpg"), { ...PKI, trustAnchors: [R("impostor-root.der")] });
  assert.equal(wrong.chain.trusted, false);
  assert.equal(wrong.badge.level, "warn");
  assert.doesNotMatch(wrong.badge.text, /^signed by/);
  const expired = await c2paReport(R("complete.jpg"), { ...PKI, now: "2036-06-01T00:00:00Z" });
  assert.equal(expired.chain.trusted, false, "past the certificates' dates");
  for (const r of [none, wrong, expired]) assert.doesNotMatch(r.badge.text, BANNED);
});

test("no credentials and unreadable files: the badge says so and lists no weakness", async () => {
  const r = await c2paReport(load("c2pa/plain.jpg"), { now: NOW });
  assert.equal(r.found, false);
  assert.equal(r.badge.text, "no Content Credentials found");
  assert.deepEqual(r.weaknesses, []);
  const b = R("complete.jpg"), cut = b.slice(0, Buffer.from(b).indexOf("c2pa.signature") + 40);
  const t = await c2paReport(cut, { now: NOW });
  assert.doesNotMatch(t.badge.text, /valid signature|signed by/, "a cut-off store is never read as signed");
});

test("every report fits schema/c2pa-report.v1.json, the shape the docs describe", async () => {
  const { validate } = await import("../bin/lib/jsonschema.mjs");
  const schema = JSON.parse(readFileSync(new URL("../schema/c2pa-report.v1.json", import.meta.url), "utf8"));
  const cases = [["c2pa-report/complete.jpg", PKI], ["c2pa-report/revoked.jpg", PKI], ["c2pa-report/revoked.jpg", { now: NOW, crls: [R("crl-forged.der")] }], ["c2pa-report/ai-stripped.jpg", { now: NOW }], ["c2pa/camera-ps256.jpg", { now: NOW }], ["c2pa/edited.jpg", { now: NOW }], ["c2pa/plain.jpg", { now: NOW }], ["c2pa/tampered.jpg", { now: NOW }], ["c2pa/camera-v1.mp4", { now: NOW }]];
  for (const [f, o] of cases) assert.deepEqual(validate(schema, await c2paReport(load(f), o)), [], f);
  const r = await c2paReport(R("complete.jpg"), PKI);
  assert.notDeepEqual(validate(schema, { ...r, extra: 1 }), [], "the schema rejects an undocumented field");
  assert.notDeepEqual(validate(schema, { ...r, revocation: { ...r.revocation, now: { ...r.revocation.now, status: "fine" } } }), []);
});

test("the window shows the badge line first, and the API and the bundle expose the report", async () => {
  const reading = await readCredentials(R("revoked.jpg"));
  reading.report = await credentialReport(R("revoked.jpg"), { now: NOW });
  const rows = credentialRows(reading);
  assert.deepEqual(rows[0], ["What CMMNS can say", reading.report.badge.text]);
  assert.match(rows[0][1], /not checked: trust list, revocation$/);
  await import("../src/ext/core.bundle.js");
  for (const name of ["c2paReport", "c2paBadge", "C2PA_WEAKNESSES"]) assert.ok(name in globalThis.PB, name);
});
