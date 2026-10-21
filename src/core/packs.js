// Signed data packs (project-docs/DATA-SOVEREIGNTY.md). A pack is one JSON file: a manifest, the
// content it adds (claims, operation indicators, site notes) or, for Radar's own bundled data, the
// SHA-256 of each bundled file, the signer's public key and an ECDSA P-256 signature over the
// manifest. WebCrypto only, so the same code verifies in Chrome, Firefox and node with no
// dependency. A valid signature says who signed the pack and that nothing changed since; it never
// says the content is true. Packs are never downloaded: the user picks a file.

import { canonicalJSON, sha256Hex, lfBytes, publicJwk, jwkId, signText, verifyText, P256 } from "./sig.js";

export const PACK_FORMAT = "radar-pack/1";
export const PACK_DOES_NOT_PROVE = "A valid signature shows which key signed this pack and that its content has not changed since. It does not show that the content is right, or who holds the key: trust a key only when you know where it came from.";
const subtle = () => globalThis.crypto.subtle;

// The key id: the first 32 hex characters of the SHA-256 of the public key's canonical JWK.
export const keyIdOf = (jwk) => jwkId(jwk, 32);
export const keyFingerprint = (keyId) => String(keyId || "").match(/.{1,4}/g)?.join(" ") || "";

export async function generateKeyPair() {
  const pair = await subtle().generateKey(P256, true, ["sign", "verify"]);
  const [priv, pub] = await Promise.all([subtle().exportKey("jwk", pair.privateKey), subtle().exportKey("jwk", pair.publicKey)]);
  return { privateJwk: priv, publicJwk: publicJwk(pub), keyId: await keyIdOf(pub) };
}

// Hashes of each content part, as the manifest lists them.
export async function contentHashes(content) {
  const out = {};
  for (const k of Object.keys(content || {}).sort()) out[k] = await sha256Hex(canonicalJSON(content[k]));
  return out;
}

// meta: { name, version, description, authorName, created }; content: { claims, ops, siteNotes }
// or files: { "name.json": sha256 }. Returns the pack object, ready to save as JSON.
export async function signPack(meta, privateJwk, { content = null, files = null } = {}) {
  const pub = publicJwk({ kty: privateJwk.kty, crv: privateJwk.crv, x: privateJwk.x, y: privateJwk.y });
  const manifest = {
    name: String(meta.name), version: String(meta.version), description: meta.description ? String(meta.description) : undefined,
    author: { keyId: await keyIdOf(pub), name: meta.authorName ? String(meta.authorName) : undefined },
    created: meta.created || new Date().toISOString().slice(0, 10),
    ...(content ? { hashes: await contentHashes(content), counts: Object.fromEntries(Object.entries(content).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0])) } : {}),
    ...(files ? { files } : {}),
  };
  const signature = await signText(privateJwk, canonicalJSON(manifest));
  return JSON.parse(JSON.stringify({ format: PACK_FORMAT, manifest, ...(content ? { content } : {}), publicKey: pub, signature }));
}

const signatureValid = (pack) => verifyText(pack.publicKey, pack.signature, canonicalJSON(pack.manifest));

// Checks the format, the key id, the signature and every content hash. trusted: [{ keyId, label }].
// Returns { ok, problems, keyId, trusted, label, manifest }. ok means the signature and hashes hold;
// trusted means the user chose to trust this key. Neither says the content is right.
export async function verifyPack(pack, trusted = []) {
  const problems = [];
  if (!pack || pack.format !== PACK_FORMAT) return { ok: false, problems: [`not a ${PACK_FORMAT} file`], keyId: null, trusted: false };
  const m = pack.manifest || {};
  let keyId = null;
  try { keyId = await keyIdOf(pack.publicKey); } catch (e) { problems.push(e.message); }
  if (keyId && (!m.author || m.author.keyId !== keyId)) problems.push("the manifest names a different key from the one in the pack");
  if (keyId && !(await signatureValid(pack))) problems.push("the signature does not match the manifest");
  problems.push(...(await hashProblems(pack)));
  const t = trusted.find((k) => k.keyId === keyId);
  return { ok: problems.length === 0, problems, keyId, trusted: !!t && problems.length === 0, label: t ? t.label : null, manifest: m };
}

async function hashProblems(pack) {
  const m = pack.manifest || {}, listed = m.hashes || {}, content = pack.content || {}, out = [];
  if (!pack.content && !m.files) return ["the pack has neither content nor a file list"];
  for (const k of Object.keys(content)) if (!(k in listed)) out.push(`content part "${k}" is not listed in the signed manifest`);
  for (const [k, h] of Object.entries(listed)) {
    if (!(k in content)) out.push(`signed content part "${k}" is missing`);
    else if ((await sha256Hex(canonicalJSON(content[k]))) !== h) out.push(`content part "${k}" changed after signing`);
  }
  return out;
}

// A file pack (Radar's bundled data): readBytes(name) resolves to the file's bytes. Line ends are
// hashed as LF (sig.js lfBytes), the same as data/LOCK.json and evidence bundles.
export async function verifyFiles(pack, readBytes) {
  const out = [];
  for (const [name, want] of Object.entries((pack.manifest && pack.manifest.files) || {})) {
    try {
      if ((await sha256Hex(lfBytes(await readBytes(name)))) !== want) out.push(`${name} differs from the signed copy`);
    } catch (e) { out.push(`${name} could not be read: ${e.message}`); }
  }
  return out;
}
