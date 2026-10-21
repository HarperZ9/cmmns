// Shared by scripts/release.mjs, scripts/verify-release.mjs and scripts/keygen.mjs: where a private
// key may live, signing a release directory's SHA256SUMS, and checking a release directory against
// a public key. The signing itself is src/core/signing.js, the same code the install page uses.
import { readFileSync, writeFileSync, readdirSync, existsSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve, relative, isAbsolute, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { signSums, verifySums, signingKeyId, parseSums } from "../src/core/signing.js";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const PUBLIC_KEY = join(ROOT, "docs", "release-key.json");
export const SUMS = "SHA256SUMS", SIG = "SHA256SUMS.sig";
const sha = (b) => createHash("sha256").update(b).digest("hex");

// True when p is this repository or inside it. A private key must never be.
const realDir = (d) => { try { return realpathSync.native(d); } catch { return resolve(d); } };
export function insideRepo(p, root = ROOT) {
  const t = join(realDir(dirname(resolve(p))), basename(resolve(p)));
  const fold = (x) => (process.platform === "win32" ? x.toLowerCase() : x);
  const rel = relative(fold(realDir(root)), fold(t));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export function readPrivateKey(path) {
  if (!path) throw new Error("no signing key: pass --key <file> or set RADAR_SIGNING_KEY; keep the file outside the repository");
  if (insideRepo(path)) throw new Error(`refusing a signing key inside the repository: ${path}`);
  const jwk = JSON.parse(readFileSync(path, "utf8"));
  if (!jwk.d) throw new Error("the key file has no private part");
  return jwk;
}

// SHA256SUMS for every file in dir except the sums and the signature.
export function writeSums(dir) {
  const names = readdirSync(dir).filter((n) => n !== SUMS && n !== SIG).sort();
  const sums = names.map((n) => `${sha(readFileSync(join(dir, n)))}  ${n}`).join("\n") + "\n";
  writeFileSync(join(dir, SUMS), sums);
  return { names, sums };
}

// The sums, then their detached signature.
export async function signDir(dir, privateJwk) {
  const { names, sums } = writeSums(dir);
  writeFileSync(join(dir, SIG), (await signSums(privateJwk, sums)) + "\n");
  return { names, keyId: await signingKeyId(privateJwk) };
}

// { ok, signature, keyId, files: [{ name, ok }], unlisted } for a release directory.
export async function verifyDir(dir, jwk) {
  const key = jwk;
  const sumsPath = join(dir, SUMS), sigPath = join(dir, SIG);
  if (!existsSync(sumsPath) || !existsSync(sigPath)) return { ok: false, signature: false, files: [], error: "SHA256SUMS or SHA256SUMS.sig is missing" };
  const sums = readFileSync(sumsPath, "utf8");
  const signature = await verifySums(key, sums, readFileSync(sigPath, "utf8"));
  const listed = parseSums(sums) || {};
  const files = Object.entries(listed).map(([name, want]) => ({ name, ok: existsSync(join(dir, name)) && sha(readFileSync(join(dir, name))) === want }));
  const unlisted = readdirSync(dir).filter((n) => n !== SUMS && n !== SIG && !(n in listed));
  return { ok: signature && files.length > 0 && files.every((f) => f.ok), signature, keyId: await signingKeyId(key), files, unlisted };
}
