// Test-only X.509 for the validation report fixtures: a DER writer and builders for certificates,
// CRLs and OCSP responses, signed with throwaway P-256 keys made by node:crypto. R&D only, never
// shipped; scripts/c2pa-report-fixtures.mjs uses it. Every name and address is invented (the
// .test top-level domain is reserved and resolves nowhere).
import { generateKeyPairSync, sign, createHash } from "node:crypto";

const lenBytes = (n) => (n < 128 ? [n] : n < 256 ? [0x81, n] : n < 65536 ? [0x82, n >> 8, n & 255] : [0x83, n >> 16, (n >> 8) & 255, n & 255]);
export const tlv = (tag, ...parts) => { const body = Buffer.concat(parts.map((p) => Buffer.from(p))); return Buffer.concat([Buffer.from([tag, ...lenBytes(body.length)]), body]); };
export const seq = (...p) => tlv(0x30, ...p);
const set = (...p) => tlv(0x31, ...p);
const explicit = (n, ...p) => tlv(0xa0 + n, ...p);
const octet = (b) => tlv(0x04, b);
const bits = (b) => tlv(0x03, [0], b);
const bool = () => tlv(0x01, [0xff]);
const enumerated = (n) => tlv(0x0a, [n]);
const uri = (s) => tlv(0x86, Buffer.from(s));

export function int(v) {
  let h = BigInt(v).toString(16);
  if (h.length % 2) h = "0" + h;
  let b = Buffer.from(h, "hex");
  if (b[0] & 0x80) b = Buffer.concat([Buffer.from([0]), b]);
  return tlv(0x02, b);
}

export function oid(s) {
  const p = s.split(".").map(Number), out = [p[0] * 40 + p[1]];
  for (const x of p.slice(2)) {
    const enc = [x & 0x7f];
    for (let v = Math.floor(x / 128); v > 0; v = Math.floor(v / 128)) enc.unshift((v & 0x7f) | 0x80);
    out.push(...enc);
  }
  return tlv(0x06, out);
}

const pad = (n) => String(n).padStart(2, "0");
const stamp = (d) => `${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
const utc = (iso) => { const d = new Date(iso); return tlv(0x17, Buffer.from(pad(d.getUTCFullYear() % 100) + stamp(d))); };
const gen = (iso) => { const d = new Date(iso); return tlv(0x18, Buffer.from(d.getUTCFullYear() + stamp(d))); };
export const name = ({ O, CN }) => seq(set(seq(oid("2.5.4.10"), tlv(0x0c, Buffer.from(O)))), set(seq(oid("2.5.4.3"), tlv(0x0c, Buffer.from(CN)))));
const ECDSA_SHA256 = seq(oid("1.2.840.10045.4.3.2"));
const sha1 = (b) => createHash("sha1").update(b).digest();

// A throwaway P-256 key: { privateKey, spki, keyBits }. keyBits is the public key BIT STRING's value.
export function newKey() {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const spki = publicKey.export({ type: "spki", format: "der" });
  return { privateKey, spki, keyBits: spki.subarray(spki.length - 65) };
}

const signed = (tbs, key) => seq(tbs, ECDSA_SHA256, bits(sign("sha256", tbs, { key: key.privateKey, dsaEncoding: "der" })));

function extensions({ ca, ocspUrl, crlUrl, eku }) {
  const ext = (id, critical, value) => seq(oid(id), ...(critical ? [bool()] : []), octet(value));
  const out = [ext("2.5.29.19", true, ca ? seq(bool()) : seq()), ext("2.5.29.15", true, ca ? tlv(0x03, [0x01, 0x06]) : tlv(0x03, [0x07, 0x80]))];
  if (eku) out.push(ext("2.5.29.37", false, seq(...eku.map(oid))));
  if (crlUrl) out.push(ext("2.5.29.31", false, seq(seq(explicit(0, explicit(0, uri(crlUrl)))))));
  if (ocspUrl) out.push(ext("1.3.6.1.5.5.7.1.1", false, seq(seq(oid("1.3.6.1.5.5.7.48.1"), uri(ocspUrl)))));
  return tlv(0xa3, seq(...out));
}

// A certificate for subject's key, signed by issuerKey. opts: { serial, issuer, subject, notBefore,
// notAfter, ca, ocspUrl, crlUrl, eku }.
export function certificate(subjectKey, issuerKey, o) {
  const tbs = seq(explicit(0, int(2)), int(o.serial), ECDSA_SHA256, name(o.issuer), seq(utc(o.notBefore), utc(o.notAfter)), name(o.subject), subjectKey.spki, extensions(o));
  return signed(tbs, issuerKey);
}

// A version 2 CRL. entries: [{ serial, at, reason }] with RFC 5280 reason codes.
export function crl(issuerKey, { issuer, thisUpdate, nextUpdate, entries = [] }) {
  const entry = (e) => seq(int(e.serial), utc(e.at), ...(e.reason != null ? [seq(seq(oid("2.5.29.21"), octet(enumerated(e.reason))))] : []));
  const tbs = seq(int(1), ECDSA_SHA256, name(issuer), utc(thisUpdate), utc(nextUpdate), ...(entries.length ? [seq(...entries.map(entry))] : []), explicit(0, seq(seq(oid("2.5.29.20"), octet(int(1))))));
  return signed(tbs, issuerKey);
}

// An OCSP response from the issuer itself (responder by key hash) about one certificate.
// status: "good", "unknown" or { revokedAt, reason }.
export function ocsp(issuerKey, { issuer, serial, status, producedAt, thisUpdate, nextUpdate }) {
  const certId = seq(seq(oid("1.3.14.3.2.26"), tlv(0x05)), octet(sha1(name(issuer))), octet(sha1(issuerKey.keyBits)), int(serial));
  const st = status === "good" ? Buffer.from([0x80, 0x00]) : status === "unknown" ? Buffer.from([0x82, 0x00]) : tlv(0xa1, gen(status.revokedAt), explicit(0, enumerated(status.reason)));
  const single = seq(certId, st, gen(thisUpdate), explicit(0, gen(nextUpdate)));
  const data = seq(tlv(0xa2, octet(sha1(issuerKey.keyBits))), gen(producedAt), seq(single));
  const basic = signed(data, issuerKey);
  return seq(enumerated(0), explicit(0, seq(oid("1.3.6.1.5.5.7.48.1.1"), octet(basic))));
}
