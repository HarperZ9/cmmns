// Build a signed, self-hostable release in dist/release-<version>/: the store packages and the
// self-distribution xpi (scripts/package.mjs), the per-file hash list, the command line tool
// (scripts/cli-zip.mjs), a git bundle of the repository at HEAD, the public key, the offline
// kit's checker, key card and guide (scripts/kit.mjs), SHA256SUMS over all of them, its detached
// ECDSA P-256 signature, and the signed head (HEAD.json, HEAD.sig: scripts/head-lib.mjs), which
// names SHA256SUMS and the catalogue by hash with a rising version and an expiry 90 days after
// the release commit. The private key is read from outside the repository and never copied.
//   RADAR_SIGNING_KEY=<path> node scripts/release.mjs      (or --key <path>)
//   node scripts/release.mjs --unsigned                    (a dry run: everything but the signature)
import { mkdirSync, rmSync, copyFileSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { writePackages, DIST } from "./package.mjs";
import { readPrivateKey, signDir, writeSums, ROOT, PUBLIC_KEY, SUMS } from "./release-lib.mjs";
import { signingKeyId } from "../src/core/signing.js";
import { createHash } from "node:crypto";
import { cliZip } from "./cli-zip.mjs";
import { writeHead, headVersionOf, headTimes, verifyRelease } from "./head-lib.mjs";
import { writeKitExtras } from "./kit.mjs";
import { dataLock } from "../bin/lib/data.mjs";

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
// The offline kit's own files (scripts/kit.mjs), written before the sums so the signature covers them.
writeKitExtras(dir, { version, keys: [publicJwk] });

// The head names the catalogue this release ships: the bundled data pack's version and the tables' hash.
const pack = JSON.parse(readFileSync(join(ROOT, "src", "ext", "radar-data.pack.json"), "utf8"));
const headOpts = { version: headVersionOf(version), ...headTimes(git("log", "-1", "--format=%cI")), release: version, catalogue: { version: pack.manifest.version, sha256: (await dataLock()).value } };

if (unsigned) {
  writeSums(dir);
  await writeHead(dir, { ...publicJwk, d: undefined }, headOpts);
  console.log(`unsigned dry run: ${readdirSync(dir).length} files in ${dir}, no SHA256SUMS.sig or HEAD.sig`);
  process.exit(0);
}
const { names, keyId } = await signDir(dir, privateJwk);
const head = await writeHead(dir, privateJwk, headOpts);
const check = await verifyRelease(dir, { key: publicJwk });
if (!check.ok) { console.error(["the release does not verify against docs/release-key.json", ...check.lines].join("\n")); process.exit(1); }
console.log(`signed ${names.length} files in ${dir}`);
console.log(`key id ${keyId}`);
console.log(`head version ${head.version}, valid until ${head.expires.slice(0, 10)}`);
console.log(`SHA256SUMS sha256 ${createHash("sha256").update(readFileSync(join(dir, SUMS))).digest("hex")}`);
console.log(`next: node scripts/kit.mjs ${dir} --out <kit folder> for the offline kit; attach every file to the release; send radar-firefox-self to Mozilla's unlisted signing; then node scripts/firefox-updates.mjs <signed.xpi>`);
