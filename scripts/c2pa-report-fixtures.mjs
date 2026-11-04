// Builds the synthetic fixtures for the Content Credentials validation report in
// tests/fixtures/c2pa-report/. R&D only, never shipped. Everything is made here: a test root, two
// signer certificates (one later revoked), a CRL, OCSP responses and C2PA 2.x manifests embedded in
// a flat-colour JPEG (tests/fixtures/c2pa/plain.jpg, itself drawn by scripts/c2pa-fixtures.py).
// The keys live only in memory and are discarded, so no private key is ever written or committed.
// No one else's media is used. Rebuilding changes every signature, so rerun the tests after.
//
//   node scripts/c2pa-report-fixtures.mjs
import { createHash, sign } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { newKey, certificate, crl, ocsp } from "./c2pa-pki-fixtures.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "tests", "fixtures", "c2pa-report");
const BASE = readFileSync(join(ROOT, "tests", "fixtures", "c2pa", "plain.jpg"));
const sha256 = (b) => createHash("sha256").update(b).digest();

// CBOR (RFC 8949): maps (Map keeps integer keys), arrays, byte and text strings, integers, null, tag 18.
function cbor(v) {
  const head = (major, n) => (n < 24 ? Buffer.from([(major << 5) | n]) : n < 256 ? Buffer.from([(major << 5) | 24, n]) : n < 65536 ? Buffer.from([(major << 5) | 25, n >> 8, n & 255]) : Buffer.from([(major << 5) | 26, n >>> 24, (n >> 16) & 255, (n >> 8) & 255, n & 255]));
  if (v === null) return Buffer.from([0xf6]);
  if (v === true || v === false) return Buffer.from([v ? 0xf5 : 0xf4]);
  if (v && v.tag18) return Buffer.concat([Buffer.from([0xd2]), cbor(v.tag18)]);
  if (Buffer.isBuffer(v) || v instanceof Uint8Array) return Buffer.concat([head(2, v.length), Buffer.from(v)]);
  if (typeof v === "string") { const s = Buffer.from(v, "utf8"); return Buffer.concat([head(3, s.length), s]); }
  if (Number.isInteger(v)) return v >= 0 ? head(0, v) : head(1, -1 - v);
  if (Array.isArray(v)) return Buffer.concat([head(4, v.length), ...v.map(cbor)]);
  const entries = v instanceof Map ? [...v] : Object.entries(v);
  return Buffer.concat([head(5, entries.length), ...entries.flatMap(([k, x]) => [cbor(k), cbor(x)])]);
}

// JUMBF (ISO/IEC 19566-5) boxes with the C2PA type UUIDs.
const UUID = { store: "63327061", manifest: "63326d61", assertions: "63326173", claim: "6332636c", signature: "63326373", cbor: "63626f72" };
const box = (type, payload) => { const h = Buffer.alloc(8); h.writeUInt32BE(8 + payload.length); h.write(type, 4, "latin1"); return Buffer.concat([h, payload]); };
const jumd = (kind, label) => box("jumd", Buffer.concat([Buffer.from(UUID[kind] + "00110010800000aa00389b71", "hex"), Buffer.from([0x03]), Buffer.from(label + "\0")]));
const superbox = (kind, label, ...children) => box("jumb", Buffer.concat([jumd(kind, label), ...children]));
const assertion = (label, value) => superbox("cbor", label, box("cbor", cbor(value)));
const hashed = (label, a) => ({ url: `self#jumbf=c2pa.assertions/${label}`, hash: sha256(a.subarray(8)) });

// The manifest store for one signer and one actions list, with a data hash whose exclusion is the
// APP11 segment the store will sit in (offset 2, length segLen).
function store({ title, actions, ingredient, signer, chain, stapled }, segLen) {
  const parts = [];
  if (ingredient) parts.push(["c2pa.ingredient.v3", assertion("c2pa.ingredient.v3", ingredient)]);
  const withIngredient = actions.map((a) => (a.action === "c2pa.opened" && ingredient ? { ...a, parameters: { ingredients: [hashed("c2pa.ingredient.v3", parts[0][1])] } } : a));
  parts.push(["c2pa.actions.v2", assertion("c2pa.actions.v2", { actions: withIngredient })]);
  parts.push(["c2pa.hash.data", assertion("c2pa.hash.data", { exclusions: [{ start: 2, length: segLen }], name: "jumbf manifest", alg: "sha256", hash: sha256(BASE), pad: Buffer.alloc(0) })]);
  const claim = cbor({ instanceID: `xmp:iid:${title}`, claim_generator_info: [{ name: "CMMNS report fixture builder", version: "1.0" }], "dc:title": title, signature: "self#jumbf=c2pa.signature", created_assertions: parts.map(([l, a]) => hashed(l, a)), alg: "sha256" });
  const prot = cbor(new Map([[1, -7], [33, chain]]));
  const tbs = cbor(["Signature1", prot, Buffer.alloc(0), claim]);
  const sig = sign("sha256", tbs, { key: signer.privateKey, dsaEncoding: "ieee-p1363" });
  const cose = cbor({ tag18: [prot, stapled ? { rVals: { ocspVals: [stapled] } } : {}, null, sig] });
  const manifest = superbox("manifest", `urn:c2pa:00000000-0000-4000-8000-${sha256(title).toString("hex").slice(0, 12)}`,
    superbox("assertions", "c2pa.assertions", ...parts.map(([, a]) => a)), superbox("claim", "c2pa.claim.v2", box("cbor", claim)), superbox("signature", "c2pa.signature", box("cbor", cose)));
  return superbox("store", "c2pa", manifest);
}

// The JPEG with the store in one APP11 segment after SOI. The exclusion length is part of the
// store, so the length is settled by repeating until it no longer changes.
function embed(spec) {
  let segLen = 0, s;
  for (let k = 0; k < 6; k++) { s = store(spec, segLen); const next = 4 + 8 + s.length; if (next === segLen) break; segLen = next; }
  const head = Buffer.alloc(12); head.writeUInt16BE(0xffeb, 0); head.writeUInt16BE(segLen - 2, 2); head.write("JP", 4, "latin1"); head.writeUInt16BE(1, 6); head.writeUInt32BE(1, 8);
  return Buffer.concat([BASE.subarray(0, 2), head, s, BASE.subarray(2)]);
}

const CA = { O: "CMMNS Test PKI", CN: "CMMNS Fixture Root" };
const POINTERS = { ocspUrl: "http://ocsp.example.test/", crlUrl: "http://crl.example.test/root.crl" };
const LIFE = { notBefore: "2026-01-01T00:00:00Z", notAfter: "2035-12-31T00:00:00Z" };
const AI = "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia";
const AGENT = { name: "Synthetic Generator", version: "9.9" };

function main() {
  mkdirSync(OUT, { recursive: true });
  const rootKey = newKey(), impostorKey = newKey(), goodKey = newKey(), revokedKey = newKey();
  const root = certificate(rootKey, rootKey, { serial: 1, issuer: CA, subject: CA, ca: true, ...LIFE });
  const impostor = certificate(impostorKey, impostorKey, { serial: 1, issuer: { ...CA, CN: "CMMNS Impostor Root" }, subject: { ...CA, CN: "CMMNS Impostor Root" }, ca: true, ...LIFE });
  const leaf = (key, serial, CN) => certificate(key, rootKey, { serial, issuer: CA, subject: { O: "CMMNS Test Signing", CN }, eku: ["1.3.6.1.5.5.7.3.4"], ...POINTERS, ...LIFE });
  const good = leaf(goodKey, 0x1001, "CMMNS Fixture Signer"), revoked = leaf(revokedKey, 0x1002, "CMMNS Fixture Signer Revoked");
  const atSigning = { producedAt: "2026-03-01T00:00:00Z", thisUpdate: "2026-03-01T00:00:00Z", nextUpdate: "2026-03-08T00:00:00Z" };
  const later = { producedAt: "2026-10-01T00:00:00Z", thisUpdate: "2026-10-01T00:00:00Z", nextUpdate: "2027-01-01T00:00:00Z" };
  const REVOKED = { revokedAt: "2026-06-01T00:00:00Z", reason: 1 };
  const write = (f, b) => writeFileSync(join(OUT, f), b);
  write("root.der", root); write("impostor-root.der", impostor);
  write("crl.der", crl(rootKey, { issuer: CA, thisUpdate: later.thisUpdate, nextUpdate: later.nextUpdate, entries: [{ serial: 0x1002, at: REVOKED.revokedAt, reason: 1 }] }));
  write("crl-forged.der", crl(impostorKey, { issuer: CA, thisUpdate: later.thisUpdate, nextUpdate: later.nextUpdate }));
  write("ocsp-revoked.der", ocsp(rootKey, { issuer: CA, serial: 0x1002, status: REVOKED, ...later }));
  write("ocsp-good.der", ocsp(rootKey, { issuer: CA, serial: 0x1001, status: "good", ...later }));
  const created = [{ action: "c2pa.created", digitalSourceType: AI, softwareAgent: AGENT }];
  const staple = (serial) => ocsp(rootKey, { issuer: CA, serial, status: "good", ...atSigning });
  write("complete.jpg", embed({ title: "complete.jpg", actions: created, signer: goodKey, chain: [good, root], stapled: staple(0x1001) }));
  write("revoked.jpg", embed({ title: "revoked.jpg", actions: created, signer: revokedKey, chain: [revoked, root], stapled: staple(0x1002) }));
  // The AI-origin field left out, as in arXiv:2603.02378: opened from an ingredient with no manifest of
  // its own, then edited. Conforming to the spec; no digitalSourceType anywhere.
  const ingredient = { "dc:title": "source.jpg", "dc:format": "image/jpeg", relationship: "parentOf" };
  write("ai-stripped.jpg", embed({ title: "ai-stripped.jpg", actions: [{ action: "c2pa.opened" }, { action: "c2pa.edited", softwareAgent: { name: "PhotoEditor", version: "2.0" } }], ingredient, signer: goodKey, chain: [good, root], stapled: staple(0x1001) }));
  // c2pa.created without its required digitalSourceType: a claim generator rule no validator step checks.
  write("created-no-source.jpg", embed({ title: "created-no-source.jpg", actions: [{ action: "c2pa.created", softwareAgent: AGENT }], signer: goodKey, chain: [good, root], stapled: staple(0x1001) }));
  console.log(`wrote fixtures to ${OUT}`);
}

main();
