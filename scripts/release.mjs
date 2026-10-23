// Build a signed, self-hostable release in dist/release-<version>/: the store packages and the
// self-distribution xpi (scripts/package.mjs), the per-file hash list, the command line tool
// (scripts/cli-zip.mjs), a git bundle of the
// repository at HEAD, SHA256SUMS over all of them, its detached ECDSA P-256 signature, and the
// public key. The private key is read from outside the repository and never copied.
//   RADAR_SIGNING_KEY=<path> node scripts/release.mjs      (or --key <path>)
//   node scripts/release.mjs --unsigned                    (a dry run: everything but the signature)
import { mkdirSync, rmSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { writePackages, DIST } from "./package.mjs";
import { readPrivateKey, signDir, writeSums, verifyDir, ROOT, PUBLIC_KEY, SUMS } from "./release-lib.mjs";
import { signingKeyId } from "../src/core/signing.js";
import { createHash } from "node:crypto";
import { cliZip } from "./cli-zip.mjs";

const args = process.argv.slice(2);
const unsigned = args.includes("--unsigned");
const keyPath = (args.includes("--key") && args[args.indexOf("--key") + 1]) || process.env.RADAR_SIGNING_KEY;
const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8" }).trim();

// A release is rebuilt from a commit, so the tree must be clean (dist/ is ignored).
if (git("status", "--porcelain") && !args.includes("--allow-dirty")) { console.error("refusing: the working tree has changes; commit them first"); process.exit(2); }
const privateJwk = unsigned ? null : readPrivateKey(keyPath);
const publicJwk = JSON.parse(readFileSync(PUBLIC_KEY, "utf8"));
if (privateJwk && (await signingKeyId(privateJwk)) !== (await signingKeyId(publicJwk))) { console.error("refusing: the signing key does not match docs/release-key.json"); process.exit(2); }

const version = JSON.parse(readFileSync(join(ROOT, "src", "ext", "manifest.json"), "utf8")).version;
const dir = join(DIST, `release-${version}`);
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
writePackages(dir);
rmSync(join(dir, SUMS));   // remade over every file below

// The command line tool, so anyone can check a bundle or an evidence chain without the repository.
writeFileSync(join(dir, `radar-cli-${version}.zip`), cliZip());

// The whole history at HEAD, so the source survives without any code host.
const commit = git("rev-parse", "HEAD");
git("bundle", "create", join(dir, `radar-${version}.bundle`), "HEAD");
git("bundle", "verify", join(dir, `radar-${version}.bundle`));
writeFileSync(join(dir, "SOURCE"), `commit ${commit}\nversion ${version}\nbuilt with node ${process.version}\n`);
copyFileSync(PUBLIC_KEY, join(dir, "release-key.json"));

if (unsigned) {
  console.log(`unsigned dry run: ${writeSums(dir).names.length} files in ${dir}, no SHA256SUMS.sig`);
  process.exit(0);
}
const { names, keyId } = await signDir(dir, privateJwk);
const check = await verifyDir(dir, publicJwk);
if (!check.ok) { console.error("the release does not verify against docs/release-key.json", check); process.exit(1); }
console.log(`signed ${names.length} files in ${dir}`);
console.log(`key id ${keyId}`);
console.log(`SHA256SUMS sha256 ${createHash("sha256").update(readFileSync(join(dir, SUMS))).digest("hex")}`);
console.log("next: attach every file to the release; send radar-firefox-self to Mozilla's unlisted signing; then node scripts/firefox-updates.mjs <signed.xpi>");
