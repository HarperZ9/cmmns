// The signed head on the release side (src/core/head.js): scripts/release.mjs writes HEAD.json and
// HEAD.sig beside SHA256SUMS, and scripts/verify-release.mjs checks the head before anything else.
// A state file (default ~/.radar/head-state.json) keeps the highest head version this machine has
// accepted, so an older release, or one with no head, is refused after a newer one was checked.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { makeHead, headText, signHead, sigFileText, checkHead, headKeyId, refusalSentence, HEAD_DOES_NOT_PROVE } from "../src/core/head.js";
import { verifyDir, SUMS } from "./release-lib.mjs";
import { sha256Hex, canonicalJSON } from "../src/core/sig.js";

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

// Same version, different head: say in plain words what that means and what to do. The usual cause
// is a local or test build of a version that was checked on this machine before the published one;
// the other cause, the one the rule exists for, is someone serving different files under a version
// number already seen. The state file is never changed here.
export async function forkHelp(head, state, statePath) {
  const mine = head ? await sha256Hex(canonicalJSON(head)) : "unknown";
  const day = (t) => String(t || "unknown").slice(0, 10);
  return [
    "what this means",
    `  This machine already accepted a signed head for release ${state.release || "?"} (version ${state.version}) on ${day(state.seenAt)}.`,
    `  That head was signed ${day(state.maxTime)}; the one in this download was signed ${day(head && head.time)}.`,
    `  Stored head hash   ${state.headSha256}`,
    `  This head's hash   ${mine}`,
    "  Two different heads under one version means one of them was not the published release:",
    "  usually a local or test build checked here first, and rarely someone serving other files.",
    "what to do",
    "  1. Compare this download's SHA256SUMS with the one on the release page, from another device or person.",
    "  2. If they match, this download is the published release and the stored entry came from an earlier build.",
    `     Check it once with --no-state to see every other check pass, then move ${statePath || "the state file"} aside`,
    "     (rename it, for example to head-state.json.old) and check again, so this head becomes the one remembered.",
    "  3. If they do not match, do not install this download.",
    "  Checking any newer release also replaces the stored entry, because a higher version is always accepted.",
  ];
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
    if (!r.ok) { lines.push(r.sentence); if (r.rule === "fork") lines.push(...await forkHelp(r.head, state, statePath)); }
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
