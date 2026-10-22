// Create, sign and check Daylight Commons data packs (src/core/packs.js, project-docs/DATA-SOVEREIGNTY.md).
// No network access, no dependencies.
//   node scripts/pack.mjs keygen <dir> <name>          writes <name>.private.jwk and <name>.public.jwk
//   node scripts/pack.mjs sign --key <private.jwk> --content <content.json> --name N --version V
//        [--description D] [--author-name A] [--created YYYY-MM-DD] --out <pack.json>
//   node scripts/pack.mjs verify <pack.json> [--trust <public.jwk>]
//   node scripts/pack.mjs bundled [--key <private.jwk>]  re-signs Daylight Commons' own data (src/ext/radar-data.pack.json)
// A private key is never written inside the repository, and keygen refuses a path there.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { generateKeyPair, signPack, verifyPack, verifyFiles, keyFingerprint, keyIdOf } from "../src/core/packs.js";
import { sha256Hex, lfBytes, publicJwk } from "../src/core/sig.js";
import { validatePackContent, packSummary } from "../src/core/packs-content.js";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const BUNDLED_FILES = ["claims.json", "claims-2.json", "ops.json", "owners.json", "personalities.json", "sites.json", "state.json"];
export const BUNDLED_PACK = join(ROOT, "src/ext/radar-data.pack.json");
const DEFAULT_KEY = process.env.RADAR_PACK_KEY || "D:/radar-keys/radar-project.private.jwk";
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const json = (p) => JSON.parse(readFileSync(p, "utf8"));

export function insideRepo(path) {
  const rel = relative(ROOT, resolve(path));
  return !rel.startsWith("..") && !isAbsolute(rel);
}

export async function keygen(dir, name) {
  if (insideRepo(dir)) throw new Error(`refusing to write a private key inside the repository (${dir}); pick a directory outside it`);
  mkdirSync(dir, { recursive: true });
  const priv = join(dir, `${name}.private.jwk`);
  if (existsSync(priv)) throw new Error(`${priv} exists; refusing to overwrite a key`);
  const k = await generateKeyPair();
  writeFileSync(priv, JSON.stringify(k.privateJwk) + "\n", { mode: 0o600 });
  writeFileSync(join(dir, `${name}.public.jwk`), JSON.stringify(k.publicJwk) + "\n");
  return k;
}

// Daylight Commons' own data as a file pack: the SHA-256 of each bundled table, signed by the project key.
export async function bundledManifestFiles() {
  const files = {};
  for (const f of BUNDLED_FILES) files[f] = await sha256Hex(lfBytes(readFileSync(join(ROOT, "src/ext", f))));
  return files;
}

async function signBundled(keyPath) {
  const priv = json(keyPath), created = process.env.RADAR_BUILT || new Date().toISOString().slice(0, 10);
  const meta = { name: "Daylight Commons bundled data", version: created.replace(/-/g, "."), description: "The tables that ship inside Daylight Commons: fact-checked claims, documented operations, outlet owners, documented backing of public media personalities, site facts and state links.", authorName: "Daylight Commons project key", created };
  const pack = await signPack(meta, priv, { files: await bundledManifestFiles() });
  writeFileSync(BUNDLED_PACK, JSON.stringify(pack, null, 1) + "\n");
  console.log(`src/ext/radar-data.pack.json signed by ${keyFingerprint(pack.manifest.author.keyId)} over ${BUNDLED_FILES.length} files`);
}

async function sign() {
  const content = json(arg("--content")), problems = validatePackContent(content);
  if (problems.length) throw new Error("the content does not meet the pack rules:\n  " + problems.slice(0, 40).join("\n  "));
  const meta = { name: arg("--name"), version: arg("--version"), description: arg("--description"), authorName: arg("--author-name"), created: arg("--created") || undefined };
  if (!meta.name || !meta.version || !arg("--out")) throw new Error("sign needs --name, --version and --out");
  const pack = await signPack(meta, json(arg("--key")), { content });
  writeFileSync(arg("--out"), JSON.stringify(pack) + "\n");
  console.log(`${arg("--out")}: ${packSummary(content)}, signed by ${keyFingerprint(pack.manifest.author.keyId)}`);
}

async function verify(file) {
  const pack = json(file), trust = arg("--trust");
  const trusted = trust ? [{ keyId: await keyIdOf(publicJwk(json(trust))), label: trust }] : [];
  const r = await verifyPack(pack, trusted);
  if (pack.content) r.problems.push(...validatePackContent(pack.content));
  if (pack.manifest && pack.manifest.files) r.problems.push(...(await verifyFiles(pack, async (n) => readFileSync(join(dirname(resolve(file)), n)))));
  console.log(`${pack.manifest?.name} ${pack.manifest?.version}: signed by ${keyFingerprint(r.keyId)}${r.trusted ? " (trusted)" : trust ? " (NOT the trusted key)" : ""}`);
  console.log(pack.content ? `adds ${packSummary(pack.content)}` : `covers ${Object.keys(pack.manifest?.files || {}).length} files`);
  for (const p of r.problems) console.log("problem: " + p);
  if (r.problems.length || (trust && !r.trusted)) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd, a, b] = process.argv.slice(2);
  const run = { keygen: () => keygen(a, b || "pack-key").then((k) => console.log(`key id ${keyFingerprint(k.keyId)}; public key ${JSON.stringify(k.publicJwk)}`)), sign, verify: () => verify(a), bundled: () => signBundled(arg("--key", DEFAULT_KEY)) }[cmd];
  if (!run) { console.error("usage: node scripts/pack.mjs keygen|sign|verify|bundled (see the header of this file)"); process.exit(2); }
  run().catch((e) => { console.error(`[pack] ${cmd} failed: ${e.message}`); process.exit(1); });
}
