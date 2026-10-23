// The seal for the evidence layer (project-docs/EVIDENCE-LAYER.md, "Chain of evidence"): an
// append-only, hash-chained local log of receipts, a Merkle root over it, inclusion proofs for one
// receipt, a verifier, and the export a journalist or regulator can check offline.
//
// The Merkle tree follows RFC 6962 / RFC 9162 with domain separation (leaf = SHA-256(0x00 || data),
// node = SHA-256(0x01 || left || right)), the same construction as Flywheel's harness/merkle.py, so
// one verifier reads both. A leaf's data is the receipt's hash as hex text.

import { canonical, sha256Hex, verifyReceipt } from "./receipt.js";

export const SEAL_FORMAT = "radar-seal/1", EXPORT_FORMAT = "radar-evidence-chain/1";
export const SEAL_DOES_NOT_PROVE = "The seal shows these are the receipts this browser recorded, in this order, each unchanged since. Each receipt is as true as its source, and whoever holds the device can start a fresh log.";
const GENESIS = "0".repeat(64);

const hexToBytes = (h) => Uint8Array.from(h.match(/../g).map((x) => parseInt(x, 16)));
const bytesToHex = (b) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
async function sha(bytes) { return new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes)); }
const cat = (...parts) => { const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0)); let i = 0; for (const p of parts) { out.set(p, i); i += p.length; } return out; };
const leafHash = (dataText) => sha(cat(Uint8Array.of(0), new TextEncoder().encode(dataText)));
const nodeHash = (l, r) => sha(cat(Uint8Array.of(1), l, r));
const pow2Below = (n) => { let k = 1; while (k * 2 < n) k *= 2; return k; };

async function mth(hashes) {
  if (!hashes.length) return sha(new Uint8Array(0));
  if (hashes.length === 1) return hashes[0];
  const k = pow2Below(hashes.length);
  return nodeHash(await mth(hashes.slice(0, k)), await mth(hashes.slice(k)));
}
async function proofOf(hashes, m) {
  if (hashes.length <= 1) return [];
  const k = pow2Below(hashes.length);
  return m < k ? [...(await proofOf(hashes.slice(0, k), m)), await mth(hashes.slice(k))] : [...(await proofOf(hashes.slice(k), m - k)), await mth(hashes.slice(0, k))];
}

// Receipt hashes (hex) -> the Merkle root (hex).
export async function merkleRoot(receiptHashes) { return bytesToHex(await mth(await Promise.all(receiptHashes.map(leafHash)))); }

// The inclusion proof for receipt m of n: { index, size, path: [hex] }.
export async function inclusionProof(receiptHashes, m) {
  const leaves = await Promise.all(receiptHashes.map(leafHash));
  return { index: m, size: leaves.length, path: (await proofOf(leaves, m)).map(bytesToHex) };
}

// RFC 9162 section 2.1.3.2.
export async function verifyInclusion(receiptHash, { index, size, path }, rootHex) {
  if (!(index >= 0 && index < size)) return false;
  let fn = index, sn = size - 1, r = await leafHash(receiptHash);
  for (const p of path) {
    if (sn === 0) return false;
    const pb = hexToBytes(p);
    if (fn % 2 === 1 || fn === sn) {
      r = await nodeHash(pb, r);
      if (fn % 2 === 0) while (fn % 2 === 0 && fn !== 0) { fn >>= 1; sn >>= 1; }
    } else r = await nodeHash(r, pb);
    fn >>= 1; sn >>= 1;
  }
  return sn === 0 && bytesToHex(r) === rootHex;
}

export const emptySeal = () => ({ format: SEAL_FORMAT, entries: [] });

// Appends one receipt: { seq, prev, receipt, link } where link = SHA-256(canonical({ seq, prev, hash })).
export async function appendSeal(seal, receipt) {
  const entries = [...((seal && seal.entries) || [])];
  const seq = entries.length, prev = seq ? entries[seq - 1].link : GENESIS;
  const link = await sha256Hex(canonical({ seq, prev, hash: receipt.hash }));
  entries.push({ seq, prev, link, receipt });
  return { format: SEAL_FORMAT, entries };
}

// Checks every receipt's own hash and every link. Returns { ok, problems: [string] }.
export async function verifySeal(seal) {
  const problems = [];
  const entries = (seal && seal.entries) || [];
  let prev = GENESIS;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.seq !== i) problems.push(`entry ${i}: sequence ${e.seq}`);
    if (e.prev !== prev) problems.push(`entry ${i}: does not follow entry ${i - 1}`);
    if (!(await verifyReceipt(e.receipt))) problems.push(`entry ${i}: receipt changed after it was made`);
    if ((await sha256Hex(canonical({ seq: e.seq, prev: e.prev, hash: e.receipt && e.receipt.hash }))) !== e.link) problems.push(`entry ${i}: link does not match`);
    prev = e.link;
  }
  return { ok: !problems.length, problems };
}

// The export: the whole seal, its head link, its Merkle root, and an inclusion proof per receipt.
export async function exportSeal(seal, { title = null, at = new Date().toISOString() } = {}) {
  const hashes = seal.entries.map((e) => e.receipt.hash);
  const root = await merkleRoot(hashes);
  const proofs = await Promise.all(hashes.map((_, i) => inclusionProof(hashes, i)));
  return { format: EXPORT_FORMAT, title, at, head: seal.entries.length ? seal.entries[seal.entries.length - 1].link : GENESIS, root, size: hashes.length, seal, proofs, dnp: SEAL_DOES_NOT_PROVE };
}

// Offline check of an export: the seal, the head, the root and every proof.
export async function verifyExport(x) {
  if (!x || x.format !== EXPORT_FORMAT) return { ok: false, problems: ["not a Daylight Commons evidence chain"] };
  if (!x.seal || !Array.isArray(x.seal.entries) || !Array.isArray(x.proofs)) return { ok: false, problems: ["the file lacks a seal or its proofs"] };
  const s = await verifySeal(x.seal), problems = [...s.problems];
  const hashes = x.seal.entries.map((e) => e.receipt.hash);
  if ((await merkleRoot(hashes)) !== x.root) problems.push("root does not match the receipts");
  const head = hashes.length ? x.seal.entries[hashes.length - 1].link : GENESIS;
  if (head !== x.head) problems.push("head does not match the last entry");
  for (let i = 0; i < hashes.length; i++) if (!(await verifyInclusion(hashes[i], x.proofs[i] || {}, x.root))) problems.push(`proof ${i} fails`);
  return { ok: !problems.length, problems };
}

// The same check as named lines, for the command line and the Analyse a file page: { ok, size,
// root, checks: [{ name, ok, text }], receipts: [{ kind, subject, source, at }], dnp }. Each line is
// one property a reader can recheck by hand; the receipts list says what the chain holds.
export async function chainChecks(x) {
  if (!x || x.format !== EXPORT_FORMAT) return { ok: false, size: 0, root: null, checks: [{ name: "format", ok: false, text: "not a Daylight Commons evidence chain" }], receipts: [], dnp: SEAL_DOES_NOT_PROVE };
  const entries = (x.seal && Array.isArray(x.seal.entries)) ? x.seal.entries : null;
  if (!entries || !Array.isArray(x.proofs)) return { ok: false, size: 0, root: x.root || null, checks: [{ name: "format", ok: false, text: "the file lacks a seal or its proofs" }], receipts: [], dnp: SEAL_DOES_NOT_PROVE };
  const n = entries.length, hashes = entries.map((e) => (e && e.receipt && e.receipt.hash) || "");
  let edited = 0, broken = 0, prev = GENESIS, proofsBad = 0;
  for (let i = 0; i < n; i++) {
    const e = entries[i] || {};
    if (!(await verifyReceipt(e.receipt))) edited++;
    const link = await sha256Hex(canonical({ seq: e.seq, prev: e.prev, hash: e.receipt && e.receipt.hash }));
    if (e.seq !== i || e.prev !== prev || link !== e.link) broken++;
    prev = e.link;
  }
  const root = await merkleRoot(hashes);
  for (let i = 0; i < n; i++) if (!(await verifyInclusion(hashes[i], x.proofs[i] || {}, x.root))) proofsBad++;
  const head = n ? entries[n - 1].link : GENESIS;
  const checks = [
    { name: "receipts", ok: !edited, text: edited ? `${edited} of ${n} receipts changed after they were made` : `all ${n} receipts match their own hash` },
    { name: "chain", ok: !broken, text: broken ? `${broken} of ${n} entries break from the one before (edited, removed or reordered)` : `all ${n} entries follow the one before, in order` },
    { name: "head", ok: head === x.head, text: head === x.head ? "the head matches the last entry" : "the head differs from the last entry" },
    { name: "Merkle root", ok: root === x.root, text: root === x.root ? `the root ${String(x.root).slice(0, 16)}... is the root of these receipts` : "the root differs from the root of these receipts" },
    { name: "inclusion proofs", ok: !proofsBad && x.proofs.length === n, text: proofsBad ? `${proofsBad} of ${n} proofs fail against the root` : `all ${n} proofs place their receipt under the root` },
  ];
  const receipts = entries.map((e) => { const r = (e && e.receipt) || {}; return { kind: r.kind || null, subject: r.subject || null, source: r.source || null, at: r.at || null }; });
  return { ok: checks.every((c) => c.ok), size: n, root: x.root || null, checks, receipts, dnp: SEAL_DOES_NOT_PROVE };
}
