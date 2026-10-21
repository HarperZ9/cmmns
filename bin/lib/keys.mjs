// The CLI's bundle-signing key: an ECDSA P-256 key pair kept as a JWK file in the user's home
// folder (~/.radar/bundle-key.jwk, readable only by the user where the system allows). It is made
// on first use, never printed, and never belongs in a repository.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { newBundleKey } from "../../src/core/evidence-bundle.js";

export const DEFAULT_KEY = join(homedir(), ".radar", "bundle-key.jwk");
const ALG = { name: "ECDSA", namedCurve: "P-256" };

export async function loadOrMakeKey(path = DEFAULT_KEY) {
  const subtle = globalThis.crypto.subtle;
  if (existsSync(path)) {
    const jwk = JSON.parse(readFileSync(path, "utf8"));
    const pub = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
    return { made: false, keyPair: { privateKey: await subtle.importKey("jwk", jwk, ALG, false, ["sign"]), publicKey: await subtle.importKey("jwk", pub, ALG, true, ["verify"]) } };
  }
  const keyPair = await newBundleKey({ extractable: true });
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(await subtle.exportKey("jwk", keyPair.privateKey)) + "\n", { mode: 0o600 });
  return { made: true, keyPair };
}
