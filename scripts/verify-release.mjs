// Check a downloaded Daylight Commons release with no network and no code host: the signature over SHA256SUMS
// against a public key, then every listed file's hash, then the git bundle.
//   node scripts/verify-release.mjs <release directory> [--key <release-key.json>]
// Without --key it uses docs/release-key.json from this checkout. A key that came in the same
// download as the files proves nothing on its own: compare its key id with one you got another
// way (the install page, the repository, a mirror, a person).
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { verifyDir, PUBLIC_KEY } from "./release-lib.mjs";

const args = process.argv.slice(2);
const dir = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--key");
const keyFile = (args.includes("--key") && args[args.indexOf("--key") + 1]) || PUBLIC_KEY;
if (!dir || !existsSync(dir)) { console.error("usage: node scripts/verify-release.mjs <release directory> [--key <release-key.json>]"); process.exit(2); }

const r = await verifyDir(dir, JSON.parse(readFileSync(keyFile, "utf8")));
console.log(`key ${keyFile}, key id ${r.keyId}`);
console.log(`signature over SHA256SUMS: ${r.signature ? "valid" : "NOT VALID"}`);
for (const f of r.files) console.log(`${f.ok ? "ok      " : "MISMATCH"}  ${f.name}`);
for (const n of r.unlisted || []) console.log(`unlisted  ${n} (not covered by the signature)`);
for (const b of readdirSync(dir).filter((n) => n.endsWith(".bundle"))) {
  try { execFileSync("git", ["bundle", "list-heads", join(dir, b)], { stdio: "ignore" }); console.log(`bundle    ${b} reads as a git bundle`); }
  catch { console.log(`bundle    ${b} could not be read by git`); r.ok = false; }
}
console.log(r.ok ? "RELEASE VERIFIED" : "RELEASE NOT VERIFIED");
process.exit(r.ok ? 0 : 1);
