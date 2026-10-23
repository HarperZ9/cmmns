// Checking a signed evidence bundle (made by src/core/evidence-bundle.js), with nothing but the
// shared primitives in sig.js, so the offline kit page (docs/verify-offline.html) can carry it.
// What a valid signature shows: the bundle has not changed since the holder of that key signed it.
// It does not show who holds the key, that the posts said what the spans say, or that the evidence
// is right. A carrier-safe bundle's key was made for that bundle alone, so its signature says
// nothing about who made it.

import { canonicalJSON, jwkId, verifyText } from "./sig.js";

export const BUNDLE_KIND = "radar-evidence-bundle";
export const BUNDLE_VERSION = 1;
export const BUNDLE_SIG_ALG = "ECDSA P-256 SHA-256";
export const BUNDLE_DOES_NOT_PROVE = "A valid signature shows the holder of this key signed the bundle and that it is unchanged since. Check the key id with the signer by another route, and read each span against its post.";
export const CARRIER_SAFE = "carrier-safe";
export const CARRIER_SAFE_NOTE = "carrier-safe: the signature proves the bundle is unchanged; it says nothing about who made it";

// Spans and post references inside the bundle agree with themselves: every post an item names is
// listed, and when text is included every located span is the text at that place.
export function bundleConsistency(bundle) {
  const ids = new Set((bundle.posts || []).map((p) => p.id)), text = new Map((bundle.posts || []).filter((p) => p.text != null).map((p) => [p.id, p.text]));
  const missing = [], wrong = [];
  for (const e of bundle.evidence || []) {
    for (const p of e.posts || []) if (!ids.has(p)) missing.push(`${e.id}: ${p}`);
    for (const s of e.spans || []) {
      const t = text.get(s.post);
      if (t != null && s.start != null && t.slice(s.start, s.end) !== s.text) wrong.push(`${e.id}: ${s.post}`);
    }
  }
  return { ok: !missing.length && !wrong.length, missing, wrong };
}

async function signatureOk(bundle) {
  const { signature, ...body } = bundle, S = body.signer;
  if (!signature || !S || S.alg !== BUNDLE_SIG_ALG || !S.publicKey) return { ok: false, text: "the bundle lacks an ECDSA P-256 signature with its public key" };
  const jwk = { kty: S.publicKey.kty, crv: S.publicKey.crv, x: S.publicKey.x, y: S.publicKey.y };
  let id = null;
  try { id = await jwkId(jwk, 16); } catch { return { ok: false, text: "the public key cannot be read" }; }
  if (id !== S.keyId) return { ok: false, text: "the key id belongs to a different public key" };
  const good = await verifyText(jwk, signature.value, canonicalJSON(body));
  return good ? { ok: true, text: "the signature matches the content and the key in the bundle" } : { ok: false, text: "the signature fails: the bundle changed after signing, or another key signed it" };
}

// opts.keyId: the key id you expect, from the signer by another route. Resolves to
// { ok, keyId, checks: [{ name, ok, text }] }; ok is true only when every check passes.
export async function verifyBundle(bundle, opts = {}) {
  const checks = [];
  if (!bundle || bundle.kind !== BUNDLE_KIND) return { ok: false, keyId: null, checks: [{ name: "kind", ok: false, text: "this file lacks the Daylight Commons evidence bundle kind" }] };
  checks.push({ name: "version", ok: bundle.version === BUNDLE_VERSION, text: bundle.version === BUNDLE_VERSION ? `bundle version ${BUNDLE_VERSION}` : `bundle version ${bundle.version}; this Daylight Commons reads version ${BUNDLE_VERSION}` });
  checks.push({ name: "signature", ...(await signatureOk(bundle)) });
  if (bundle.profile !== undefined) checks.push(bundle.profile === CARRIER_SAFE ? { name: "profile", ok: true, text: CARRIER_SAFE_NOTE } : { name: "profile", ok: false, text: `profile "${bundle.profile}" is unknown to this Daylight Commons` });
  const keyId = bundle.signer ? bundle.signer.keyId : null;
  if (opts.keyId) checks.push({ name: "key", ok: opts.keyId === keyId, text: opts.keyId === keyId ? "signed by the key you expected" : `signed by key ${keyId}, not ${opts.keyId}` });
  const C = bundleConsistency(bundle);
  checks.push({ name: "consistency", ok: C.ok, text: C.ok ? (bundle.textIncluded ? "every item's posts are listed and every span matches the included text" : "every item's posts are listed; post text is not included, so spans were not checked against it") : `items name posts missing from the list (${C.missing.length}) or spans that differ from the text (${C.wrong.length})` });
  return { ok: checks.every((c) => c.ok), keyId, checks };
}
