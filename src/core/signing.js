// Release signatures: detached ECDSA P-256 signatures over a release's SHA256SUMS, made and checked
// with Radar's one copy of the signing primitives (src/core/sig.js), the same code that signs data
// packs and evidence bundles. It runs in node (scripts/release.mjs, scripts/verify-release.mjs), in
// the extension and on the public install page (docs/signing.js, a generated copy). No library, no
// network.
//
// A key is named for people by its key id: the first 32 hex characters of the SHA-256 of its
// canonical public JWK, in groups of four, the same id data packs show. The RFC 7638 thumbprint
// (the same hash, base64url) is kept for tools that expect one.
//
// What a valid signature proves: whoever held the private key for this public key signed these
// exact bytes. It does not prove the signer is who they say, that the key was not stolen, or that
// the signed files are safe. Those rest on how the public key reached you (INSTALL.md).

import { P256, b64url, canonicalJSON, jwkId, signText, verifyText } from "./sig.js";

// Only the public members, from a public or a private JWK.
const publicPart = (jwk) => {
  if (!jwk || jwk.kty !== "EC" || jwk.crv !== "P-256" || !jwk.x || !jwk.y) throw new Error("not a P-256 key");
  return { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y };
};

export async function signingKeyId(jwk) {
  return (await jwkId(publicPart(jwk), 32)).match(/.{4}/g).join(" ");
}

export async function jwkThumbprint(jwk) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalJSON(publicPart(jwk))));
  return b64url(new Uint8Array(digest));
}

// A new key pair as JWKs. The private JWK must be stored outside any repository.
export async function generateSigningKey() {
  const s = globalThis.crypto.subtle;
  const pair = await s.generateKey(P256, true, ["sign", "verify"]);
  const [priv, pub] = await Promise.all([s.exportKey("jwk", pair.privateKey), s.exportKey("jwk", pair.publicKey)]);
  return { privateJwk: { ...publicPart(priv), d: priv.d }, publicJwk: publicPart(pub) };
}

export async function signSums(privateJwk, text) {
  if (!privateJwk || !privateJwk.d) throw new Error("not a private key");
  return signText({ ...publicPart(privateJwk), d: privateJwk.d }, String(text));
}

// True only for a well-formed signature by this key over this text; never throws.
export async function verifySums(jwk, text, signature) {
  try { return await verifyText(publicPart(jwk), String(signature || "").trim(), String(text)); } catch { return false; }
}

// SHA256SUMS lines ("<64 hex>  <name>") to a map, ignoring blank lines; null when a line is malformed.
export function parseSums(text) {
  const out = {};
  for (const line of String(text || "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const m = line.match(/^([0-9a-f]{64}) [ *]([^\s/\\][^\\]*)$/);
    if (!m || m[2].includes("..")) return null;
    out[m[2]] = m[1];
  }
  return out;
}

export const SIGNATURE_DOES_NOT_PROVE = "A valid signature shows the files were signed by the holder of this key and not changed since. It does not show who holds the key, that the key was never stolen, or that the code is safe. Compare the key id with one you got another way.";
