// The published release key is public only, and its key id and thumbprint match it. The tree-wide
// private key scan is tests/no-private-keys.test.js; this file covers the release key itself.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { signingKeyId, jwkThumbprint } from "../src/core/signing.js";
import { PROJECT_KEY } from "../src/core/pack-keys.js";

const key = JSON.parse(readFileSync(new URL("../docs/release-key.json", import.meta.url), "utf8"));

test("the published release key is P-256, public only, and its key id and thumbprint match it", async () => {
  assert.equal(key.kty, "EC"); assert.equal(key.crv, "P-256");
  assert.equal("d" in key, false);
  assert.equal(key.keyId, await signingKeyId(key));
  assert.equal(key.thumbprint, await jwkThumbprint(key));
});

test("releases are signed with the same project key as the data packs", () => {
  assert.equal(key.x, PROJECT_KEY.jwk.x);
  assert.equal(key.y, PROJECT_KEY.jwk.y);
  assert.equal(key.keyId.replace(/ /g, ""), PROJECT_KEY.keyId);
});
