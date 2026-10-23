// Check a downloaded Daylight Commons release with no network and no code host: the signed head
// first (version, expiry, the hash of SHA256SUMS), then the signature over SHA256SUMS against a
// public key, then every listed file's hash, then the git bundle.
//   node scripts/verify-release.mjs <release directory> [--key <release-key.json>] [--state <file> | --no-state]
// Without --key it uses docs/release-key.json from this checkout. A key that came in the same
// download as the files proves nothing on its own: compare its key id with one you got another
// way (the install page, the repository, a mirror, a person). The state file (default
// ~/.radar/head-state.json) keeps the highest head version accepted on this machine, so an older
// release is refused after a newer one; --no-state checks without it, for looking at old releases.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { PUBLIC_KEY } from "./release-lib.mjs";
import { verifyRelease, DEFAULT_STATE } from "./head-lib.mjs";

const args = process.argv.slice(2);
const valued = new Set(["--key", "--state"]);
const dir = args.find((a, i) => !a.startsWith("--") && !valued.has(args[i - 1]));
const opt = (name) => (args.includes(name) && args[args.indexOf(name) + 1]) || null;
const keyFile = opt("--key") || PUBLIC_KEY;
if (!dir || !existsSync(dir)) { console.error("usage: node scripts/verify-release.mjs <release directory> [--key <release-key.json>] [--state <file> | --no-state]"); process.exit(2); }

const statePath = args.includes("--no-state") ? null : opt("--state") || DEFAULT_STATE;
const r = await verifyRelease(dir, { key: JSON.parse(readFileSync(keyFile, "utf8")), statePath });
console.log(`key ${keyFile}`);
for (const l of r.lines) console.log(l);
for (const b of readdirSync(dir).filter((n) => n.endsWith(".bundle"))) {
  try { execFileSync("git", ["bundle", "list-heads", join(dir, b)], { stdio: "ignore" }); console.log(`bundle    ${b} reads as a git bundle`); }
  catch { console.log(`bundle    ${b} could not be read by git`); r.ok = false; }
}
console.log(r.ok ? "RELEASE VERIFIED" : "RELEASE NOT VERIFIED");
process.exit(r.ok ? 0 : 1);
