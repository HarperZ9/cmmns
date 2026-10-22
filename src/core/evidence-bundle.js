// Signed evidence bundles: what Daylight Commons found on a thread, as a file anyone can check offline. A
// bundle carries post ids, the evidence with the matched spans needed to check it, the Daylight Commons and
// API versions, a hash of the data tables used, and the time; it is signed with a per-install
// ECDSA P-256 key through WebCrypto, and the public key travels inside the bundle.
//
// Privacy: other people's full post text stays out unless the user opts in (includeText). The
// bundle names no account, and a thread bundle needs as many reply accounts as a thread card.
//
// What a valid signature shows: the bundle has not changed since the holder of that key signed
// it. It does not show who holds the key, that the posts said what the spans say, or that the
// evidence is right. Compare the key id with one you got from its holder some other way.

import { MIN_CARD_ACCOUNTS } from "./evidence.js";
import { canonicalJSON, sha256Hex, lfBytes, jwkId, signText, verifyText, P256 } from "./sig.js";

export const BUNDLE_KIND = "radar-evidence-bundle";
export const BUNDLE_VERSION = 1;
export const BUNDLE_SIG_ALG = "ECDSA P-256 SHA-256";
export const BUNDLE_DOES_NOT_PROVE = "A valid signature shows the bundle has not changed since the holder of this key signed it. It does not show who holds the key, that the posts said what the spans say, or that the evidence is right.";
// Canonical JSON, hashing, base64url and ECDSA P-256 live in sig.js, shared with data packs.
const subtle = () => globalThis.crypto.subtle;

// The hash of the data tables: SHA-256 over lines "<sha256>  <name>", names sorted, each file
// hashed with LF line ends. Those per-file hashes are the ones data/LOCK.json records for the
// tables and src/ext/radar-data.pack.json signs, so dataLockFromHashes() gives the same value
// from either (tests/datalock.bundle.test.js).
export async function dataLockOf(files) {
  const hashes = {};
  for (const [name, bytes] of files) hashes[name] = await sha256Hex(lfBytes(bytes));
  return dataLockFromHashes(hashes);
}
export async function dataLockFromHashes(hashes) {
  const lines = Object.keys(hashes).sort().map((name) => `${hashes[name]}  ${name}`);
  return { alg: "SHA-256", of: "lines \"<sha256>  <file>\" for each data table, sorted by name; files hashed with LF line ends", value: await sha256Hex(lines.join("\n") + "\n") };
}

// A new key pair. extractable: false keeps the private key inside the browser's key store.
export async function newBundleKey({ extractable = false } = {}) {
  return subtle().generateKey(P256, extractable, ["sign", "verify"]);
}

// The public half as a JWK with only the fields a verifier needs, and its id: the first 16 hex
// characters of the SHA-256 of that JWK's canonical JSON.
export async function publicKeyOf(publicKey) {
  const j = await subtle().exportKey("jwk", publicKey);
  const jwk = { kty: j.kty, crv: j.crv, x: j.x, y: j.y };
  return { jwk, keyId: await jwkId(jwk, 16) };
}

// result: an analyzeThread or analyzeText envelope. opts: { tool, dataLock, savedAt, page, texts,
// includeText, source }. texts: { postId: text }, used only when includeText is true.
// Returns { ok: true, bundle } or { ok: false, reason }.
export function makeBundle(result, opts = {}) {
  if (!result || !Array.isArray(result.evidence)) return { ok: false, reason: "There is no analysis to put in a bundle." };
  const archive = opts.source === "export";
  if (result.kind === "thread" && !archive && (result.posts.accounts || 0) < MIN_CARD_ACCOUNTS) {
    return { ok: false, reason: `This thread has ${result.posts.accounts || 0} accounts. A bundle needs at least ${MIN_CARD_ACCOUNTS}, so it cannot be about one person.` };
  }
  const ids = (result.posts && result.posts.ids) || [...new Set(result.evidence.flatMap((e) => e.posts))];
  const texts = opts.includeText ? opts.texts || {} : {};
  const bundle = {
    kind: BUNDLE_KIND, version: BUNDLE_VERSION, schema: result.schema, api: result.api, tool: opts.tool || "Daylight Commons",
    savedAt: opts.savedAt || new Date().toISOString(), dataLock: opts.dataLock || null,
    input: { kind: result.kind, site: result.site || null, page: opts.page || null, source: archive ? "export" : "thread", accounts: result.posts ? result.posts.accounts : null },
    posts: ids.map((id) => (opts.includeText && texts[id] != null ? { id, text: String(texts[id]) } : { id })),
    textIncluded: !!opts.includeText,
    evidence: result.evidence, limits: [...(result.limits || []), BUNDLE_DOES_NOT_PROVE],
  };
  return { ok: true, bundle };
}

// Signs a bundle with a key pair from newBundleKey(). Returns a new bundle with `signature`.
export async function signBundle(bundle, keyPair) {
  const { signature, ...body } = bundle;
  const { jwk, keyId } = await publicKeyOf(keyPair.publicKey);
  const signed = { ...body, signer: { alg: BUNDLE_SIG_ALG, keyId, publicKey: jwk } };
  const value = await signText(keyPair.privateKey, canonicalJSON(signed));
  return { ...signed, signature: { of: "canonical JSON of this bundle without the signature field (sorted keys, no spaces)", value } };
}

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
  if (!signature || !S || S.alg !== BUNDLE_SIG_ALG || !S.publicKey) return { ok: false, text: "the bundle carries no signature Daylight Commons can check" };
  const jwk = { kty: S.publicKey.kty, crv: S.publicKey.crv, x: S.publicKey.x, y: S.publicKey.y };
  let id = null;
  try { id = await jwkId(jwk, 16); } catch { return { ok: false, text: "the public key cannot be read" }; }
  if (id !== S.keyId) return { ok: false, text: "the key id does not match the public key" };
  const good = await verifyText(jwk, signature.value, canonicalJSON(body));
  return good ? { ok: true, text: "the signature matches the content and the key in the bundle" } : { ok: false, text: "the signature does not match: the bundle changed after signing, or was signed with another key" };
}

// opts.keyId: the key id you expect, from the signer by another route. Resolves to
// { ok, keyId, checks: [{ name, ok, text }] }; ok is true only when every check passes.
export async function verifyBundle(bundle, opts = {}) {
  const checks = [];
  if (!bundle || bundle.kind !== BUNDLE_KIND) return { ok: false, keyId: null, checks: [{ name: "kind", ok: false, text: "this is not a Daylight Commons evidence bundle" }] };
  checks.push({ name: "version", ok: bundle.version === BUNDLE_VERSION, text: bundle.version === BUNDLE_VERSION ? `bundle version ${BUNDLE_VERSION}` : `bundle version ${bundle.version} is not one this Daylight Commons reads` });
  checks.push({ name: "signature", ...(await signatureOk(bundle)) });
  const keyId = bundle.signer ? bundle.signer.keyId : null;
  if (opts.keyId) checks.push({ name: "key", ok: opts.keyId === keyId, text: opts.keyId === keyId ? "signed by the key you expected" : `signed by key ${keyId}, not ${opts.keyId}` });
  const C = bundleConsistency(bundle);
  checks.push({ name: "consistency", ok: C.ok, text: C.ok ? (bundle.textIncluded ? "every item's posts are listed and every span matches the included text" : "every item's posts are listed; post text is not included, so spans were not checked against it") : `items name posts not listed (${C.missing.length}) or spans that differ from the text (${C.wrong.length})` });
  return { ok: checks.every((c) => c.ok), keyId, checks };
}
