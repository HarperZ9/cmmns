// Evidence receipts (project-docs/EVIDENCE-LAYER.md). Every fact the evidence layer returns comes
// back as one: what was observed, about what, from which source and address, when, a SHA-256 hash
// over all of that, and what the fact does not prove. The hash lets anyone holding the receipt see
// that it was not edited after it was made; it does not show that the source was right.

export const RECEIPT_FORMAT = "radar-receipt/1";

// JSON with keys sorted at every level, so the same receipt always hashes the same.
export function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
  return JSON.stringify(v === undefined ? null : v);
}

export async function sha256Hex(text) {
  const buf = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(text)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// The capture method and version of the code that read the fact, kept in every receipt.
export const ADAPTER_VERSION = "radar-evidence/1";

// { kind, subject, observed, source, url, at, dnp, raw?, method?, witness?, cites?, catalogue? } ->
// the receipt with its hash. raw is the source fragment the fact was read from: only its hash is
// kept. cites lists the hashes of the observations a finding rests on, catalogue the catalogue
// version of any definition it uses. For the export profiles (project-docs/EVIDENCE-LAYER.md, "Data
// model for exports"): subjectKind says whether the subject is an artefact (a repository, a domain,
// a post), an organisation the platform discloses, or a private account, which is only ever held
// as a pseudonym (pseudonymFor); labeller and stratum are set on hand-labelled observations.
export const SUBJECT_KINDS = ["artefact", "organisation", "private-pseudonym"];
export async function makeReceipt({ kind, subject, observed, source, url, at = new Date().toISOString(), dnp, raw, method = "fetch", witness, cites, catalogue, subjectKind = "artefact", labeller, stratum }) {
  if (!SUBJECT_KINDS.includes(subjectKind)) throw new Error(`unknown subject kind ${subjectKind}`);
  if (!kind || !source || !dnp) throw new Error("a receipt needs a kind, a source and a does-not-prove line");
  const body = { format: RECEIPT_FORMAT, kind, subject: subject || null, observed, source, url: url || null, at, dnp,
    capture: { method, adapter: ADAPTER_VERSION, rawHash: raw === undefined ? null : await sha256Hex(canonical(raw)) },
    subjectKind, content: "features", witness: witness || undefined, cites: cites && cites.length ? [...cites] : undefined, catalogue: catalogue || undefined,
    labeller: labeller || undefined, stratum: stratum || undefined };
  return { ...body, hash: await sha256Hex(canonical(body)) };
}

export async function verifyReceipt(r) {
  if (!r || r.format !== RECEIPT_FORMAT || !r.hash) return false;
  const { hash, ...body } = r;
  return (await sha256Hex(canonical(body))) === hash;
}

// A private account's stable pseudonym inside one export: salted, so exports with different salts
// cannot be joined, and the handle never appears.
export async function pseudonymFor(salt, handle) {
  return "acct-" + (await sha256Hex(`${salt}|${String(handle || "").toLowerCase()}`)).slice(0, 16);
}
