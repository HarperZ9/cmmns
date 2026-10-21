// R&D only: compares Radar's Content Credentials reader with c2patool on a folder of sample files,
// such as the test fixtures in the c2pa-rs repository (sdk/tests/fixtures). Nothing here ships.
//   node scripts/c2pa-crosscheck.mjs <folder> <path to c2patool>
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { readCredentials, credentialState } from "../src/core/c2pa.js";

const [dir, tool] = process.argv.slice(2);
const files = readdirSync(dir).filter((f) => /\.(jpe?g|png|webp|mp4|mov|m4a|avif|heic)$/i.test(f)).sort();
const tally = {};
for (const f of files) {
  let ref;
  try {
    const j = JSON.parse(execFileSync(tool, [join(dir, f)], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
    ref = j.validation_state || "unknown";
  } catch (e) {
    ref = /No claim found|JumbfNotFound/i.test(String(e.stderr || e.message)) ? "none" : "error";
  }
  let mine;
  try { mine = credentialState(await readCredentials(new Uint8Array(readFileSync(join(dir, f))))); } catch (e) { mine = "threw"; }
  const k = `${ref} -> ${mine}`;
  (tally[k] = tally[k] || []).push(f);
}
for (const [k, list] of Object.entries(tally).sort()) console.log(`${k}: ${list.length} (${list.join(", ")})`);
