// The signed head: a small JSON document that names one release's SHA256SUMS and the catalogue by
// hash, with a version that only goes up, the time it was signed and a date it expires. A device
// keeps the highest version it has accepted and the highest signed time it has seen, so an old but
// validly signed release can no longer pass for the current one (RESILIENCE.md 5.3).
//
//   { kind, version, time, expires, release: { name, sums }, catalogue: { version, sha256 },
//     signers: { k, keys: [key id, ...] } }
//
// HEAD.json holds the canonical JSON of the head (src/core/sig.js canonicalJSON). HEAD.sig holds
// { signatures: [{ keyId, value }] }, each an ECDSA P-256 signature over those bytes made with the
// same primitives as release and pack signatures. No new cryptography.
//
// Checked in this order, and the first rule that fails names the refusal:
//   1. size and form: at most 4 KB, strict fields, canonical bytes, before any signature work;
//   2. signatures: at least k valid ones from distinct keys that are both listed and trusted here;
//   3. rollback: a version lower than one accepted here is refused, as is a different head under
//      a version already accepted;
//   4. expiry: a head past its expiry is accepted and marked Expired, never refused;
//   5. files: SHA256SUMS and the catalogue, when given, must match the hashes the head lists.
// Time: the signed time is the signer's claim. "Now" is the later of the device clock and the
// highest signed time seen, and the device clock never raises the highest signed time.

import { canonicalJSON, sha256Hex, jwkId, publicJwk, signText, verifyText } from "./sig.js";

export const HEAD_KIND = "daylight-head/1";
export const HEAD_MAX_BYTES = 4096;
export const HEAD_SIG_MAX_BYTES = 4096;
export const AGING_DAYS = 30;
export const HEAD_DOES_NOT_PROVE = "A valid head shows the signer chose these files at that time. It does not show the files are safe.";

const DAY = 86400000;
const HEX64 = /^[0-9a-f]{64}$/, KEY_ID = /^[0-9a-f]{32}$/, TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, B64URL = /^[A-Za-z0-9_-]{80,100}$/;
const NAME = /^[0-9A-Za-z][0-9A-Za-z.+-]{0,63}$/;
const bytes = (s) => new TextEncoder().encode(String(s)).length;
const keysExactly = (o, keys) => o && typeof o === "object" && !Array.isArray(o) && Object.keys(o).sort().join() === [...keys].sort().join();
const time = (s) => (TIME.test(s) && !Number.isNaN(Date.parse(s)) ? Date.parse(s) : null);
const day = (iso) => String(iso).slice(0, 10);

// The key id a head lists: the first 32 hex characters of the SHA-256 of the canonical public JWK.
export const headKeyId = (jwk) => jwkId(publicJwk({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y }), 32);

// Null when the head is well formed, else what is wrong with it.
function formProblem(h) {
  if (!keysExactly(h, ["kind", "version", "time", "expires", "release", "catalogue", "signers"])) return "fields";
  if (h.kind !== HEAD_KIND) return "kind";
  if (!Number.isSafeInteger(h.version) || h.version < 1) return "version";
  const t = time(h.time), e = time(h.expires);
  if (t == null || e == null || e <= t) return "time";
  if (!keysExactly(h.release, ["name", "sums"]) || !NAME.test(h.release.name) || !HEX64.test(h.release.sums)) return "release";
  if (!keysExactly(h.catalogue, ["version", "sha256"]) || !NAME.test(h.catalogue.version) || !HEX64.test(h.catalogue.sha256)) return "catalogue";
  const S = h.signers;
  if (!keysExactly(S, ["k", "keys"]) || !Array.isArray(S.keys) || !S.keys.length || S.keys.length > 16 || !S.keys.every((k) => KEY_ID.test(k))) return "signers";
  if (new Set(S.keys).size !== S.keys.length || !Number.isSafeInteger(S.k) || S.k < 1 || S.k > S.keys.length) return "signers";
  return null;
}

// A head object from its fields; throws when a field is out of form.
export function makeHead({ version, time: t, expires, release, catalogue, signers }) {
  const head = { kind: HEAD_KIND, version, time: t, expires, release, catalogue, signers };
  const bad = formProblem(head);
  if (bad) throw new Error(`head field out of form: ${bad}`);
  if (bytes(headText(head)) > HEAD_MAX_BYTES) throw new Error(`head is larger than ${HEAD_MAX_BYTES} bytes`);
  return head;
}
export const headText = (head) => canonicalJSON(head) + "\n";

export async function signHead(head, privateJwk) {
  return { keyId: await headKeyId(privateJwk), value: await signText(privateJwk, canonicalJSON(head)) };
}
export const sigFileText = (entries) => canonicalJSON({ signatures: entries }) + "\n";

// Strict, size-limited parse: { ok: true, head } or { ok: false, rule, detail }. No signature work.
export function parseHead(text) {
  if (typeof text !== "string" || bytes(text) > HEAD_MAX_BYTES) return { ok: false, rule: "size", detail: "over the size limit" };
  let head;
  try { head = JSON.parse(text); } catch { return { ok: false, rule: "form", detail: "not JSON" }; }
  const bad = formProblem(head);
  if (bad) return { ok: false, rule: "form", detail: bad };
  if (text !== canonicalJSON(head) && text !== canonicalJSON(head) + "\n") return { ok: false, rule: "form", detail: "not canonical" };
  return { ok: true, head };
}

function parseSigs(text) {
  if (typeof text !== "string" || bytes(text) > HEAD_SIG_MAX_BYTES) return null;
  let s;
  try { s = JSON.parse(text); } catch { return null; }
  if (!keysExactly(s, ["signatures"]) || !Array.isArray(s.signatures) || s.signatures.length > 16) return null;
  return s.signatures.every((e) => keysExactly(e, ["keyId", "value"]) && KEY_ID.test(e.keyId) && B64URL.test(e.value)) ? s.signatures : null;
}

// Valid signatures from distinct keys that the head lists and this device trusts.
async function countSignatures(head, sigs, trusted) {
  const ids = new Map();
  for (const jwk of trusted) ids.set(await headKeyId(jwk), jwk);
  const body = canonicalJSON(head), good = new Set();
  let bad = 0, known = 0;
  for (const s of sigs) {
    if (good.has(s.keyId) || !head.signers.keys.includes(s.keyId) || !ids.has(s.keyId)) continue;
    known++;
    if (await verifyText(ids.get(s.keyId), s.value, body)) good.add(s.keyId); else bad++;
  }
  return { valid: good.size, bad, known };
}

const SENTENCES = {
  size: () => `Refused: the head is larger than ${HEAD_MAX_BYTES / 1024} KB, so it was not read.`,
  form: () => "Refused: the head is not in the expected form.",
  signature: () => "Refused: a signature does not match the head, so it changed after signing or was signed with another key.",
  untrusted: () => "Refused: the head is not signed by a key this device trusts.",
  threshold: ({ valid, needed }) => `Refused: the head carries ${valid} valid signature${valid === 1 ? "" : "s"} and needs ${needed}.`,
  rollback: ({ version, stored }) => `Refused (rollback): this head is version ${version}, older than version ${stored} already accepted here.`,
  fork: ({ version }) => `Refused: a different head with version ${version} was already accepted here.`,
  sums: () => "Refused: SHA256SUMS does not match the hash the head lists.",
  catalogue: () => "Refused: the catalogue here does not match the hash the head lists.",
  missing: () => "Refused (rollback): this release has no signed head, and a signed head was already accepted here.",
};
// One plain sentence naming the rule a head failed.
export const refusalSentence = (rule, ctx = {}) => (SENTENCES[rule] || SENTENCES.form)(ctx);

// The later of the device clock and the highest signed time seen.
export function effectiveNow(state, now = Date.now()) {
  const seen = state && time(state.maxTime);
  return Math.max(Number(now), seen || 0);
}

// opts: { head, sig (file texts), trusted: [public JWK], state, now, sums (SHA256SUMS text or null),
// catalogue (dataLock value or null), minK }. Resolves to { ok, rule, sentence, status, head, state,
// valid, needed }. state is the new state on acceptance and the old one, untouched, on refusal.
export async function checkHead(opts) {
  const old = opts.state || null;
  const refuse = (rule, ctx, extra = {}) => ({ ok: false, rule, sentence: refusalSentence(rule, ctx), status: null, state: old, ...extra });
  const p = parseHead(opts.head);
  if (!p.ok) return refuse(p.rule, {}, { detail: p.detail });
  const head = p.head, sigs = parseSigs(opts.sig);
  if (!sigs) return refuse("form", {}, { detail: "signature file" });
  const needed = Math.max(head.signers.k, opts.minK || 1);
  const c = await countSignatures(head, sigs, opts.trusted || []);
  if (!c.known) return refuse("untrusted", {}, { head });
  if (c.valid < needed) return refuse(c.bad ? "signature" : "threshold", { valid: c.valid, needed }, { head, valid: c.valid, needed });
  const hash = await sha256Hex(canonicalJSON(head));
  if (old && head.version < old.version) return refuse("rollback", { version: head.version, stored: old.version }, { head });
  if (old && head.version === old.version && hash !== old.headSha256) return refuse("fork", { version: head.version }, { head });
  if (opts.sums != null && (await sha256Hex(String(opts.sums))) !== head.release.sums) return refuse("sums", {}, { head });
  if (opts.catalogue != null && opts.catalogue !== head.catalogue.sha256) return refuse("catalogue", {}, { head });
  const maxTime = old && time(old.maxTime) > time(head.time) ? old.maxTime : head.time;
  const now = effectiveNow({ maxTime }, opts.now ?? Date.now());
  const state = {
    version: head.version, headSha256: hash, maxTime, seenAt: new Date(now).toISOString().replace(/\.\d{3}Z$/, "Z"),
    expires: head.expires, release: head.release.name, catalogue: { version: head.catalogue.version }, valid: c.valid, needed,
  };
  return { ok: true, rule: null, sentence: null, status: freshness(state, { now: opts.now ?? Date.now() }).status, head, state, valid: c.valid, needed };
}

// What the card and the popup say about the catalogue's age. state: from checkHead, or null when
// no head has been checked here. catalogue: { version, date } of the tables this install carries.
// Statuses: current, aging (head last seen over AGING_DAYS ago), expired, none. Never an alarm.
export function freshness(state, { now = Date.now(), catalogue = null } = {}) {
  const dated = catalogue && catalogue.date ? `Catalogue dated ${day(catalogue.date)}.` : "Catalogue date unknown.";
  if (!state) return { status: "none", label: "Not checked", line: `${dated} No signed head checked on this device yet.` };
  const t = effectiveNow(state, now), sigs = `${state.valid} of ${state.needed} signature${state.needed === 1 ? "" : "s"}${state.needed === 1 ? " (single-signer release)" : ""}`;
  const seen = `Signed head version ${state.version} last seen ${day(state.seenAt)}, valid until ${day(state.expires)}, ${sigs}.`;
  if (t >= Date.parse(state.expires)) return { status: "expired", label: "Expired", line: `${dated} Newer campaigns may be missing. ${seen}` };
  const aging = t - Date.parse(state.seenAt) > AGING_DAYS * DAY;
  return { status: aging ? "aging" : "current", label: aging ? "Aging" : "Current", line: `${dated} ${seen}` };
}
