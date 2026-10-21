// The one copy of Radar's hashing and signing primitives, shared by sealed evidence cards
// (evidence.js), signed evidence bundles (evidence-bundle.js) and signed data packs (packs.js).
// WebCrypto only, so the same code runs in Chrome, Firefox and node with no dependency.
//   canonicalJSON: sorted keys at every level, no spacing, undefined object fields dropped and
//     undefined array items written as null, so the same content always gives the same bytes.
//   ECDSA P-256 with SHA-256; signatures in IEEE P1363 form (r || s), base64url, as WebCrypto
//     produces them.

export const P256 = { name: "ECDSA", namedCurve: "P-256" };
export const P256_SHA256 = { name: "ECDSA", hash: "SHA-256" };
const subtle = () => globalThis.crypto.subtle;
const utf8 = (s) => new TextEncoder().encode(s);
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export function canonicalJSON(v) {
  if (Array.isArray(v)) return "[" + v.map(canonicalJSON).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => JSON.stringify(k) + ":" + canonicalJSON(v[k])).join(",") + "}";
  return JSON.stringify(v === undefined ? null : v);
}

export async function sha256Hex(data) { return hex(await subtle().digest("SHA-256", typeof data === "string" ? utf8(data) : data)); }

// File bytes with CRLF line ends turned to LF, so a Windows checkout and a Linux one hash a text
// table the same. Bytes without a CR come back unchanged.
export function lfBytes(bytes) {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (!u.includes(13)) return u;
  const out = new Uint8Array(u.length);
  let n = 0;
  for (let i = 0; i < u.length; i++) if (!(u[i] === 13 && u[i + 1] === 10)) out[n++] = u[i];
  return out.subarray(0, n);
}

export function b64url(bytes) {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function fromB64url(text) {
  const s = atob(String(text).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(text).length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

// Only the public parts of a P-256 key. A key that carries "d" is a private key and is refused.
export function publicJwk(jwk) {
  if (!jwk || jwk.kty !== "EC" || jwk.crv !== "P-256" || typeof jwk.x !== "string" || typeof jwk.y !== "string") throw new Error("not a P-256 public key");
  if ("d" in jwk) throw new Error("this is a private key; share only the public key");
  return { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y };
}
// A key id: the first `length` hex characters of the SHA-256 of the public key's canonical JWK.
export const jwkId = async (jwk, length) => (await sha256Hex(canonicalJSON(publicJwk(jwk)))).slice(0, length);

// Signs text with a CryptoKey (or a private JWK); returns a base64url P1363 signature.
export async function signText(key, text) {
  const k = key && key.type === "private" ? key : await subtle().importKey("jwk", key, P256, false, ["sign"]);
  return b64url(await subtle().sign(P256_SHA256, k, utf8(text)));
}

// True when sig (base64url) is a valid signature of text by the public JWK; never throws.
export async function verifyText(jwk, sig, text) {
  try {
    const key = await subtle().importKey("jwk", { ...publicJwk(jwk), ext: true }, P256, true, ["verify"]);
    return await subtle().verify(P256_SHA256, key, fromB64url(sig), utf8(text));
  } catch { return false; }
}
