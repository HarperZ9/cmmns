// The signed head on the release side (src/core/head.js): scripts/release.mjs writes HEAD.json and
// HEAD.sig beside SHA256SUMS, and scripts/verify-release.mjs checks the head before anything else.
// A state file (default ~/.radar/head-state.json) keeps the highest head version this machine has
// accepted, so an older release, or one with no head, is refused after a newer one was checked.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { makeHead, headText, signHead, sigFileText, checkHead, headKeyId, refusalSentence, HEAD_DOES_NOT_PROVE } from "../src/core/head.js";
import { verifyDir, SUMS } from "./release-lib.mjs";
import { sha256Hex } from "../src/core/sig.js";

export const HEAD = "HEAD.json", HEAD_SIG = "HEAD.sig";
export const DEFAULT_STATE = join(homedir(), ".radar", "head-state.json");
const DAY = 86400000;
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");

// A release's head version: 3.2.0 gives 3002000, so versions rise with releases.
export function headVersionOf(semver) {
  const m = String(semver).match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m || +m[2] > 999 || +m[3] > 999) throw new Error(`not a release version: ${semver}`);
  return +m[1] * 1e6 + +m[2] * 1e3 + +m[3];
}
// Signed time and expiry from the release commit's time, so the same commit gives the same head.
export const headTimes = (commitIso, days = 90) => ({ time: iso(Date.parse(commitIso)), expires: iso(Date.parse(commitIso) + days * DAY) });

// Writes HEAD.json and HEAD.sig for a signed release directory. opts: { version, time, expires,
// release (name), catalogue: { version, sha256 } }. The head names the directory's SHA256SUMS by hash.
export async function writeHead(dir, privateJwk, opts) {
  const head = makeHead({
    version: opts.version, time: opts.time, expires: opts.expires,
    release: { name: opts.release, sums: await sha256Hex(readFileSync(join(dir, SUMS), "utf8")) },
    catalogue: opts.catalogue, signers: { k: 1, keys: [await headKeyId(privateJwk)] },
  });
  writeFileSync(join(dir, HEAD), headText(head));
  if (privateJwk && privateJwk.d) writeFileSync(join(dir, HEAD_SIG), sigFileText([await signHead(head, privateJwk)]));
  return head;
}

const readState = (p) => (p && existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null);
function saveState(p, state) {
  if (!p) return;
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
}

// The head first, then the signature over SHA256SUMS and every file. opts: { key (public JWK),
// statePath (null for none), now }. Resolves to { ok, lines }.
export async function verifyRelease(dir, { key, statePath = null, now = Date.now() } = {}) {
  const lines = [], state = readState(statePath);
  let headOk = true;
  if (existsSync(join(dir, HEAD))) {
    const sig = existsSync(join(dir, HEAD_SIG)) ? readFileSync(join(dir, HEAD_SIG), "utf8") : "";
    const sums = existsSync(join(dir, SUMS)) ? readFileSync(join(dir, SUMS), "utf8") : "";
    const r = await checkHead({ head: readFileSync(join(dir, HEAD), "utf8"), sig, trusted: [key], state, now, sums, catalogue: null });
    headOk = r.ok;
    if (!r.ok) lines.push(r.sentence);
    else {
      const sigs = `${r.valid} of ${r.needed} signature${r.needed === 1 ? "" : "s"}${r.needed === 1 ? " (single-signer release)" : ""}`;
      lines.push(`head      version ${r.head.version}, signed ${r.head.time.slice(0, 10)}, valid until ${r.head.expires.slice(0, 10)}, ${sigs}`);
      if (r.status === "expired") lines.push("head      expired: the catalogue in this release may miss newer campaigns");
      saveState(statePath, r.state);
    }
  } else if (state && state.version) {
    headOk = false;
    lines.push(refusalSentence("missing"));
  } else lines.push("head      none: this release cannot show its age (releases before 3.2.0 have no head)");

  const r = await verifyDir(dir, key);
  lines.push(`key id ${r.keyId}`);
  lines.push(`signature over SHA256SUMS: ${r.signature ? "valid" : "NOT VALID"}`);
  for (const f of r.files) lines.push(`${f.ok ? "ok      " : "MISMATCH"}  ${f.name}`);
  for (const n of r.unlisted || []) lines.push(`unlisted  ${n} (not covered by the signature)`);
  lines.push(HEAD_DOES_NOT_PROVE);
  return { ok: headOk && r.ok, lines };
}
