// Signed data packs (src/core/packs.js): a pack verifies only with its own key, unchanged, and is
// trusted only when the user trusts that key. Keys are generated per run and never written to disk.
import test from "node:test";
import assert from "node:assert/strict";
import { signPack, verifyPack, verifyFiles, generateKeyPair, keyIdOf, keyFingerprint, PACK_FORMAT } from "../src/core/packs.js";
import { canonicalJSON as canonical, publicJwk, sha256Hex, lfBytes } from "../src/core/sig.js";

const content = {
  claims: [{ claim: "The bridge closed for good in March 2026.", rating: "False", checker: "Example Checks", url: "https://checks.example.org/bridge", date: "2026-03-04" }],
  siteNotes: [{ domain: "news.example.com", note: "Registered three weeks before the election.", url: "https://whois.example.org/news.example.com" }],
};
const meta = { name: "Test pack", version: "1.0.0", authorName: "Test signer", created: "2026-10-21" };
const clone = (x) => JSON.parse(JSON.stringify(x));

test("canonical JSON (shared with evidence bundles) sorts keys at every level and drops undefined", () => {
  assert.equal(canonical({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: undefined } }), '{"a":{"d":[3,{"y":2,"z":1}]},"b":1}');
  assert.equal(canonical({ x: 1, y: 2 }), canonical({ y: 2, x: 1 }));
});

test("a signed pack verifies, names its key, and is trusted only when that key is", async () => {
  const k = await generateKeyPair();
  const pack = await signPack(meta, k.privateJwk, { content });
  assert.equal(pack.format, PACK_FORMAT);
  assert.equal(pack.manifest.author.keyId, k.keyId);
  assert.ok(!("d" in pack.publicKey), "the pack carries only the public key");
  const untrusted = await verifyPack(pack, []);
  assert.equal(untrusted.ok, true);
  assert.equal(untrusted.trusted, false);
  const trusted = await verifyPack(pack, [{ keyId: k.keyId, label: "mine" }]);
  assert.equal(trusted.trusted, true);
  assert.equal(trusted.label, "mine");
  assert.equal(keyFingerprint("0e5e19840565840c"), "0e5e 1984 0565 840c");
});

test("any change to the content or the manifest after signing fails", async () => {
  const k = await generateKeyPair();
  const pack = await signPack(meta, k.privateJwk, { content });
  const edited = clone(pack); edited.content.claims[0].rating = "True";
  assert.match((await verifyPack(edited)).problems.join(), /content part "claims" changed after signing/);
  const added = clone(pack); added.content.ops = [];
  assert.match((await verifyPack(added)).problems.join(), /"ops" is not listed/);
  const dropped = clone(pack); delete dropped.content.siteNotes;
  assert.match((await verifyPack(dropped)).problems.join(), /"siteNotes" is missing/);
  const renamed = clone(pack); renamed.manifest.name = "Another pack";
  assert.match((await verifyPack(renamed)).problems.join(), /signature does not match/);
});

test("a pack cannot borrow a trusted key id or carry a private key", async () => {
  const good = await generateKeyPair(), bad = await generateKeyPair();
  const forged = await signPack(meta, bad.privateJwk, { content });
  forged.manifest.author.keyId = good.keyId;   // claims the trusted key, signed with another
  const r = await verifyPack(forged, [{ keyId: good.keyId, label: "trusted" }]);
  assert.equal(r.trusted, false);
  assert.match(r.problems.join(), /different key/);
  const swapped = await signPack(meta, bad.privateJwk, { content });
  swapped.publicKey = good.publicJwk;          // the trusted public key, with a signature it did not make
  const s = await verifyPack(swapped, [{ keyId: good.keyId, label: "trusted" }]);
  assert.equal(s.trusted, false);
  const leaky = await signPack(meta, bad.privateJwk, { content });
  leaky.publicKey = bad.privateJwk;
  assert.match((await verifyPack(leaky)).problems.join(), /private key/);
  assert.throws(() => publicJwk(bad.privateJwk), /private key/);
});

test("the key id is the hash of the public key, whatever order its fields are in", async () => {
  const k = await generateKeyPair();
  const { kty, crv, x, y } = k.publicJwk;
  assert.equal(await keyIdOf({ y, x, crv, kty }), k.keyId);
  assert.equal(k.keyId.length, 32);
  assert.equal(k.keyId, (await sha256Hex(canonical({ crv, kty, x, y }))).slice(0, 32));
});

test("a file pack checks each file's bytes against its signed hash", async () => {
  const k = await generateKeyPair(), bytes = { "a.json": new TextEncoder().encode('{"rows":[]}'), "b.json": new TextEncoder().encode("[1,2]") };
  const files = { "a.json": await sha256Hex(bytes["a.json"]), "b.json": await sha256Hex(bytes["b.json"]) };
  const pack = await signPack({ ...meta, name: "Bundled" }, k.privateJwk, { files });
  assert.equal((await verifyPack(pack, [{ keyId: k.keyId, label: "project" }])).trusted, true);
  assert.deepEqual(await verifyFiles(pack, async (n) => bytes[n]), []);
  const tampered = { ...bytes, "b.json": new TextEncoder().encode("[1,2,3]") };
  assert.deepEqual(await verifyFiles(pack, async (n) => tampered[n]), ["b.json differs from the signed copy"]);
  assert.match((await verifyFiles(pack, async () => { throw new Error("gone"); }))[0], /could not be read: gone/);
  const crlf = { "a.json": bytes["a.json"], "b.json": new TextEncoder().encode("[1,\r\n2]") }, lf = new TextEncoder().encode("[1,\n2]");
  assert.deepEqual(lfBytes(crlf["b.json"]), lf, "a Windows checkout hashes the same as a Linux one");
  assert.equal(lfBytes(lf), lf, "bytes without CR are returned as they are");
});

test("anything that is not a pack is refused without throwing", async () => {
  for (const x of [null, {}, { format: "other" }, { format: PACK_FORMAT }]) assert.equal((await verifyPack(x)).ok, false);
});
