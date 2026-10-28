// Make CMMNS' release signing key: an ECDSA P-256 key pair. The private key goes to the path given,
// which must be outside this repository and must not exist yet; the public key goes to
// docs/release-key.json, which is committed and published on the install page.
//   node scripts/keygen.mjs <path-outside-the-repo>/radar-release.private.jwk
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { generateSigningKey, jwkThumbprint, signingKeyId } from "../src/core/signing.js";
import { insideRepo, PUBLIC_KEY } from "./release-lib.mjs";

const out = process.argv[2];
if (!out) { console.error("usage: node scripts/keygen.mjs <path outside the repository>"); process.exit(2); }
if (insideRepo(out)) { console.error(`refusing: ${out} is inside the repository`); process.exit(2); }
if (existsSync(out)) { console.error(`refusing: ${out} exists; CMMNS never overwrites a key`); process.exit(2); }

const { privateJwk, publicJwk } = await generateSigningKey();
const [thumbprint, keyId] = await Promise.all([jwkThumbprint(publicJwk), signingKeyId(publicJwk)]);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(privateJwk) + "\n", { mode: 0o600 });
writeFileSync(PUBLIC_KEY, JSON.stringify({ ...publicJwk, use: "sig", alg: "ES256", keyId, thumbprint, label: "CMMNS project key" }, null, 2) + "\n");
console.log(`private key: ${out} (keep it offline and backed up; never commit it)`);
console.log(`public key: docs/release-key.json`);
console.log(`key id: ${keyId}`);
