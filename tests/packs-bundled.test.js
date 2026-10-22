// Daylight Commons' own data ships as a pack signed by the project key (src/ext/radar-data.pack.json). This
// fails when a bundled table changes without being signed again: run `node scripts/pack.mjs bundled`
// with the project key, which lives outside the repository.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyPack, verifyFiles, keyIdOf } from "../src/core/packs.js";
import { PROJECT_KEY } from "../src/core/pack-keys.js";
import { BUNDLED_FILES } from "../scripts/pack.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ext = (f) => join(root, "src/ext", f);
const pack = JSON.parse(readFileSync(ext("radar-data.pack.json"), "utf8"));

test("the project key id is the hash of the project public key", async () => {
  assert.equal(await keyIdOf(PROJECT_KEY.jwk), PROJECT_KEY.keyId);
  assert.ok(!("d" in PROJECT_KEY.jwk));
});

test("Daylight Commons' bundled data is signed by the project key and matches every shipped table", async () => {
  const v = await verifyPack(pack, [PROJECT_KEY]);
  assert.deepEqual(v.problems, []);
  assert.equal(v.trusted, true);
  assert.deepEqual(Object.keys(pack.manifest.files).sort(), [...BUNDLED_FILES].sort());
  const problems = await verifyFiles(pack, async (n) => readFileSync(ext(n)));
  assert.deepEqual(problems, [], "a bundled table changed: re-sign with `node scripts/pack.mjs bundled`");
});

test("the background worker and the options page load the pack code", () => {
  const manifest = JSON.parse(readFileSync(ext("manifest.json"), "utf8"));
  const bg = manifest.background.scripts;
  assert.ok(bg.indexOf("packs-bg.js") > bg.indexOf("core.bundle.js") && bg.indexOf("packs-bg.js") < bg.indexOf("sources-bg.js"));
  assert.match(readFileSync(ext("background.js"), "utf8"), /importScripts\([^)]*"packs-bg\.js"[^)]*"sources-bg\.js"/);
  const options = readFileSync(ext("options.html"), "utf8");
  assert.ok(options.indexOf("options-packs.js") > options.indexOf("core.bundle.js"));
  assert.match(options, /id="packFile" type="file"/);
});

test("pack code never fetches anything from the network", () => {
  for (const f of ["src/core/packs.js", "src/core/packs-content.js", "src/ext/packs-bg.js", "src/ext/options-packs.js"]) {
    const src = readFileSync(join(root, f), "utf8");
    for (const m of src.matchAll(/fetch\(([^)]*)\)/g)) assert.match(m[1], /chrome\.runtime\.getURL|^n$/, `${f} fetches ${m[1]}`);
    assert.doesNotMatch(src, /https?:\/\/(?!www\.w3)/, `${f} names a remote address`);
  }
});
