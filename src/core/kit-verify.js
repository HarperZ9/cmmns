// The offline kit check (docs/verify-offline.html, scripts/kit.mjs): given the files a person picked
// from a kit and the keys built into the page, check the signed head, the signature over
// SHA256SUMS, every listed file's hash, and name any file the signature does not cover. Pure: no
// network, no storage, no DOM. The page prints `lines` as they come.
//
// What a pass shows: the files match what the holder of a built-in key signed. It does not show
// that the built-in key is right if the page itself came from an attacker. The printed card and a
// second source are the defence (KIT-GUIDE.txt says so).

import { sha256Hex } from "./sig.js";
import { verifySums, parseSums, signingKeyId, SIGNATURE_DOES_NOT_PROVE } from "./signing.js";
import { checkHead, HEAD_DOES_NOT_PROVE } from "./head.js";

export const KIT_SIGNED_FILES = ["SHA256SUMS", "SHA256SUMS.sig", "HEAD.json", "HEAD.sig"];
const text = (b) => new TextDecoder().decode(b);
const spaced = (id) => String(id).replace(/\s/g, "").match(/.{1,4}/g).join(" ");

// The key id a kit's own key file or head signature names, for the "found" line.
async function foundKeyId(files) {
  try { if (files.has("release-key.json")) return await signingKeyId(JSON.parse(text(files.get("release-key.json")))); } catch { /* not a key */ }
  try { if (files.has("HEAD.sig")) return spaced(JSON.parse(text(files.get("HEAD.sig"))).signatures[0].keyId); } catch { /* not a head signature */ }
  return null;
}

async function headLines(files, trusted, sums, out) {
  if (!files.has("HEAD.json")) { out.bad("HEAD.json is missing, so this kit cannot show its age or version. Do not install from it."); return false; }
  const r = await checkHead({ head: text(files.get("HEAD.json")), sig: files.has("HEAD.sig") ? text(files.get("HEAD.sig")) : "", trusted: trusted.map((t) => t.jwk), state: null, sums, catalogue: null, now: Date.now() });
  if (!r.ok) { out.bad(r.sentence); return false; }
  const sigs = `${r.valid} of ${r.needed} signature${r.needed === 1 ? "" : "s"}${r.needed === 1 ? " (single-signer release)" : ""}`;
  out.good(`Signed head: release ${r.head.release.name}, version ${r.head.version}, signed ${r.head.time.slice(0, 10)}, valid until ${r.head.expires.slice(0, 10)}, ${sigs}.`);
  if (r.status === "expired") out.note(`The head expired on ${r.head.expires.slice(0, 10)}. The catalogue in this kit may miss newer campaigns.`);
  out.note("This page keeps no record between visits, so it cannot tell whether a newer head exists. Compare the version with the newest one you have seen.");
  return true;
}

// files: Map of name to Uint8Array. trusted: [{ keyId, label, jwk }]. Resolves to
// { ok, keyIdBuiltIn, keyIdFound, uncovered, failed, lines: [{ kind: good|bad|note, text }] }.
export async function checkKit(files, { trusted }) {
  const lines = [], add = (kind) => (t) => lines.push({ kind, text: t }), out = { good: add("good"), bad: add("bad"), note: add("note") };
  const builtIn = trusted.map((t) => spaced(t.keyId)).join(", ");
  out.note(`Key built into this page: ${builtIn}. Compare it with the printed card or a second source.`);
  const result = (ok, extra = {}) => ({ ok, keyIdBuiltIn: builtIn, keyIdFound: null, uncovered: [], failed: [], lines, ...extra });
  if (!files.has("SHA256SUMS")) { out.bad("SHA256SUMS is missing, so nothing here can be checked. Pick every file in the kit."); return result(false); }
  if (!files.has("SHA256SUMS.sig")) { out.bad("SHA256SUMS.sig is missing, so no file here is covered by a signature. Do not install these files."); return result(false); }
  const sums = text(files.get("SHA256SUMS")), sig = text(files.get("SHA256SUMS.sig"));
  let signed = false;
  for (const t of trusted) if (await verifySums(t.jwk, sums, sig)) signed = true;
  if (!signed) {
    const found = await foundKeyId(files);
    out.bad(`The signature over SHA256SUMS does not match the key built into this page.${found ? ` The kit names key ${found} instead.` : ""} Do not install these files.`);
    return result(false, { keyIdFound: found });
  }
  out.good("Signature over SHA256SUMS: valid for the built-in key.");
  const headOk = await headLines(files, trusted, sums, out);
  const listed = parseSums(sums);
  if (!listed) { out.bad("SHA256SUMS is not in the expected form."); return result(false); }
  const failed = [];
  for (const [name, want] of Object.entries(listed)) {
    if (!files.has(name)) { out.note(`${name}: not in this kit, not checked.`); continue; }
    const got = await sha256Hex(files.get(name));
    if (got === want) out.good(`${name}: matches.`);
    else { failed.push(name); out.bad(`${name}: DOES NOT MATCH the signed list. Do not install it.`); }
  }
  const uncovered = [...files.keys()].filter((n) => !(n in listed) && !KIT_SIGNED_FILES.includes(n)).sort();
  for (const n of uncovered) out.bad(`${n}: not in SHA256SUMS, so the signature does not cover it. Ignore it.`);
  const ok = headOk && !failed.length;
  out[ok ? "good" : "bad"](ok ? `Kit verified: every signed file present matches${uncovered.length ? `; ${uncovered.length} extra file${uncovered.length === 1 ? " is" : "s are"} not covered` : ""}.` : "Kit not verified. Do not install from it.");
  out.note(SIGNATURE_DOES_NOT_PROVE);
  out.note(HEAD_DOES_NOT_PROVE);
  return result(ok, { failed, uncovered, keyIdFound: builtIn });
}
