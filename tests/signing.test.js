// Release signatures (src/core/signing.js, on top of src/core/sig.js): a signature verifies only for
// the same key and the same text, malformed input fails closed, generated public keys never carry
// the private part, and the key id is the one data packs show.
import test from "node:test";
import assert from "node:assert/strict";
import { generateSigningKey, signSums, verifySums, jwkThumbprint, signingKeyId, parseSums } from "../src/core/signing.js";
import { b64url, jwkId, sha256Hex, canonicalJSON } from "../src/core/sig.js";

const { privateJwk, publicJwk: pub } = await generateSigningKey();

test("a signature verifies for the same text and key only", async () => {
  const sig = await signSums(privateJwk, "abc  radar.zip\n");
  assert.equal(await verifySums(pub, "abc  radar.zip\n", sig), true);
  assert.equal(await verifySums(pub, "abc  radar.zip\n", sig + "\n"), true, "a trailing newline in the .sig file is fine");
  assert.equal(await verifySums(pub, "abd  radar.zip\n", sig), false, "one changed byte fails");
  assert.equal(await verifySums((await generateSigningKey()).publicJwk, "abc  radar.zip\n", sig), false, "another key fails");
});

test("malformed keys and signatures fail closed, never throw", async () => {
  for (const [k, s] of [[pub, "!!!"], [pub, ""], [pub, b64url(new Uint8Array(63))], [{ kty: "EC" }, "AAAA"], [null, null]]) assert.equal(await verifySums(k, "x", s), false);
  await assert.rejects(signSums(pub, "x"), /not a private key/);
});

test("generated public keys carry no private scalar; the key id and thumbprint ignore it", async () => {
  assert.equal("d" in pub, false);
  assert.equal(await signingKeyId(privateJwk), await signingKeyId(pub));
  assert.equal(await jwkThumbprint(privateJwk), await jwkThumbprint(pub));
  assert.match(await jwkThumbprint(pub), /^[A-Za-z0-9_-]{43}$/);
});

test("the key id is the data-pack key id, in groups of four, cut from the thumbprint's hash", async () => {
  const id = await signingKeyId(pub);
  assert.match(id, /^([0-9a-f]{4} ){7}[0-9a-f]{4}$/);
  assert.equal(id.replace(/ /g, ""), await jwkId(pub, 32));
  assert.equal((await sha256Hex(canonicalJSON(pub))).slice(0, 32), id.replace(/ /g, ""));
});

test("SHA256SUMS lines", () => {
  assert.deepEqual(parseSums(`${"a".repeat(64)}  radar-chrome-3.0.0.zip\n\n${"b".repeat(64)}  radar.bundle\n`), { "radar-chrome-3.0.0.zip": "a".repeat(64), "radar.bundle": "b".repeat(64) });
  assert.equal(parseSums(`${"a".repeat(64)}  ../etc/passwd`), null);
  assert.equal(parseSums("nonsense"), null);
});
