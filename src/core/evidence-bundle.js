// Signed evidence bundles: what CMMNS found on a thread, as a file anyone can check offline. A
// bundle carries post ids, the evidence with the matched spans needed to check it, the CMMNS and
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
import { canonicalJSON, sha256Hex, lfBytes, jwkId, signText, P256 } from "./sig.js";
import { BUNDLE_KIND, BUNDLE_VERSION, BUNDLE_VERSIONS, BUNDLE_SIG_ALG, BUNDLE_DOES_NOT_PROVE, CARRIER_SAFE, CARRIER_SAFE_NOTE, EVIDENCE_V1, EVIDENCE_V2, bundleConsistency, readEvidence, verifyBundle } from "./bundle-verify.js";

// Checking a bundle lives in bundle-verify.js, which the offline kit page carries on its own.
export { BUNDLE_KIND, BUNDLE_VERSION, BUNDLE_VERSIONS, BUNDLE_SIG_ALG, BUNDLE_DOES_NOT_PROVE, CARRIER_SAFE, CARRIER_SAFE_NOTE, EVIDENCE_V1, EVIDENCE_V2, bundleConsistency, readEvidence, verifyBundle };
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

// A time of day becomes spaces of the same length, so the date stays and every span offset into the
// text still holds: after a date or a bare "T" ("2026-10-01T09:30:00Z", "2026-10-01 09:30 UTC"), or
// a clock time with a zone or am/pm ("at 12:10 UTC", "9:05 pm"). A ratio or verse number is kept.
const TIME_OF_DAY = /(?:(?<=\d{4}-\d{2}-\d{2})[T ]|T)\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:\s?(?:Z|UTC|[+-]\d{2}:?\d{2}))?|\b\d{1,2}:\d{2}(?::\d{2})?\s?(?:UTC|GMT|Z|am|pm)\b/gi;
const blankTimes = (v) => (typeof v === "string" ? v.replace(TIME_OF_DAY, (m) => " ".repeat(m.length)) : Array.isArray(v) ? v.map(blankTimes) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, blankTimes(x)])) : v);
// "CMMNS 3.1.0 (CLI)" becomes "CMMNS 3".
export const carrierTool = (tool) => { const m = String(tool || "").match(/^(.*?)(\d+)\.\d+(\.\d+)?/); return m ? `${m[1]}${m[2]}`.trim() : "CMMNS"; };

// result: an analyzeThread or analyzeText envelope. opts: { tool, dataLock, savedAt, page, texts,
// includeText, source, profile, typedPage }. texts: { postId: text }, used only when includeText
// is true. profile "carrier-safe" uses typedPage (what the user typed) and never page.
// Returns { ok: true, bundle } or { ok: false, reason }.
export function makeBundle(result, opts = {}) {
  if (!result || !Array.isArray(result.evidence)) return { ok: false, reason: "Run an analysis first, then put it in a bundle." };
  const archive = opts.source === "export";
  if (result.kind === "thread" && !archive && (result.posts.accounts || 0) < MIN_CARD_ACCOUNTS) {
    return { ok: false, reason: `This thread has ${result.posts.accounts || 0} accounts. A bundle needs at least ${MIN_CARD_ACCOUNTS}, so it cannot be about one person.` };
  }
  const ids = (result.posts && result.posts.ids) ? [...result.posts.ids, ...(result.posts.quoted || [])] : [...new Set(result.evidence.flatMap((e) => e.posts))];
  const texts = opts.includeText ? opts.texts || {} : {};
  const bundle = {
    kind: BUNDLE_KIND, version: BUNDLE_VERSION, schema: result.schema, api: result.api, tool: opts.tool || "CMMNS",
    savedAt: opts.savedAt || new Date().toISOString(), dataLock: opts.dataLock || null,
    input: { kind: result.kind, site: result.site || null, page: opts.page || null, source: archive ? "export" : "thread", accounts: result.posts ? result.posts.accounts : null },
    posts: ids.map((id) => (opts.includeText && texts[id] != null ? { id, text: String(texts[id]) } : { id })),
    textIncluded: !!opts.includeText,
    evidence: result.evidence, limits: [...(result.limits || []), BUNDLE_DOES_NOT_PROVE],
  };
  if (opts.profile === CARRIER_SAFE) {
    const safe = blankTimes({ ...bundle, savedAt: undefined, tool: undefined });
    return { ok: true, bundle: { ...safe, profile: CARRIER_SAFE, tool: carrierTool(bundle.tool), savedAt: bundle.savedAt.slice(0, 10), input: { ...safe.input, page: opts.typedPage ? String(opts.typedPage) : null }, limits: [...bundle.limits, CARRIER_SAFE_NOTE] } };
  }
  return { ok: true, bundle };
}

// Signs a carrier-safe bundle with a key made for it alone; the key is dropped when this returns
// and is never stored or exported.
export async function signCarrierSafe(bundle) {
  if (bundle.profile !== CARRIER_SAFE) throw new Error("not a carrier-safe bundle");
  return signBundle(bundle, await newBundleKey({ extractable: false }));
}

// Signs a bundle with a key pair from newBundleKey(). Returns a new bundle with `signature`.
export async function signBundle(bundle, keyPair) {
  const { signature, ...body } = bundle;
  const { jwk, keyId } = await publicKeyOf(keyPair.publicKey);
  const signed = { ...body, signer: { alg: BUNDLE_SIG_ALG, keyId, publicKey: jwk } };
  const value = await signText(keyPair.privateKey, canonicalJSON(signed));
  return { ...signed, signature: { of: "canonical JSON of this bundle without the signature field (sorted keys, no spaces)", value } };
}
