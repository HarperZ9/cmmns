// R&D only: compares Daylight Commons' Content Credentials reader with c2patool on a folder of sample files,
// such as the test fixtures in the c2pa-rs repository (sdk/tests/fixtures). Nothing here ships.
//   node scripts/c2pa-crosscheck.mjs <folder> <path to c2patool> [--write]
// --write saves c2patool's verdicts to tests/fixtures/c2pa-reference.json, which the property test
// tests/c2pa.reference.test.js holds Daylight Commons to. A verdict is "pass" when c2patool logs no failure
// other than signingCredential.untrusted (Daylight Commons does not check trust and says so), "fail" for any
// other failure or a c2patool error, and "none" when the file has no manifest.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { readCredentials, credentialState } from "../src/core/c2pa.js";

const [dir, tool, flag] = process.argv.slice(2);
export const MEDIA = /\.(jpe?g|png|webp|mp4|mov|m4a|avif|heic)$/i;

function reference(file) {
  try {
    const j = JSON.parse(execFileSync(tool, [file], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
    const fails = (((j.validation_results || {}).activeManifest || {}).failure || j.validation_status || []).map((x) => x.code).filter((c) => c !== "signingCredential.untrusted");
    return { verdict: fails.length ? "fail" : "pass", codes: fails };
  } catch (e) {
    const msg = String(e.stderr || e.message);
    return /No claim found|JumbfNotFound/i.test(msg) ? { verdict: "none", codes: [] } : { verdict: "fail", codes: ["error: " + msg.split("\n")[0].slice(0, 80)] };
  }
}

const files = readdirSync(dir).filter((f) => MEDIA.test(f)).sort();
const out = {};
for (const f of files) {
  const ref = reference(join(dir, f));
  let mine;
  try { mine = credentialState(await readCredentials(new Uint8Array(readFileSync(join(dir, f))))); } catch { mine = "threw"; }
  out[f] = ref;
  console.log(`${f.padEnd(34)} c2patool ${ref.verdict.padEnd(5)} radar ${mine}${ref.codes.length ? "  " + ref.codes.join(",") : ""}`);
}
if (flag === "--write") {
  const version = execFileSync(tool, ["--version"], { encoding: "utf8" }).trim();
  const doc = { tool: version, source: "github.com/contentauth/c2pa-rs sdk/tests/fixtures at 60f7cbdc69ab7a2554fcc87eb4df77050814b2cf", files: out };
  writeFileSync(new URL("../tests/fixtures/c2pa-reference.json", import.meta.url), JSON.stringify(doc, null, 1) + "\n");
}
