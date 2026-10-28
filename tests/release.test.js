// Self-hosted releases (scripts/package.mjs, scripts/release-lib.mjs, scripts/firefox-updates.mjs):
// packages rebuild to the same bytes, the self-distributed Firefox build alone carries an update
// address, a signed release directory verifies, and any change to a file or the sums is caught.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPackages, sumsOf } from "../scripts/package.mjs";
import { browserManifest, FIREFOX_UPDATE_URL } from "../scripts/zip.mjs";
import { signDir, verifyDir, insideRepo, ROOT } from "../scripts/release-lib.mjs";
import { addUpdate } from "../scripts/firefox-updates.mjs";
import { generateSigningKey } from "../src/core/signing.js";

const manifest = JSON.parse(readFileSync(new URL("../src/ext/manifest.json", import.meta.url), "utf8"));

test("two builds of the same tree give byte-identical packages and per-file hashes", () => {
  const files = [["manifest.json", Buffer.from(JSON.stringify(manifest))], ["a.js", Buffer.from("x".repeat(500))], ["icons/i.png", Buffer.from([1, 2, 3])]];
  const one = buildPackages(files), two = buildPackages([...files].reverse());
  assert.deepEqual(one.files.map(([n]) => n), [`cmmns-chrome-${manifest.version}.zip`, `cmmns-firefox-${manifest.version}.xpi`, `cmmns-firefox-self-${manifest.version}.xpi`, `FILES-${manifest.version}.sha256`]);
  one.files.forEach(([n, d], i) => assert.ok(d.equals(two.files[i][1]), n));
  assert.equal(sumsOf(one.files), sumsOf(two.files));
  const list = one.files.at(-1)[1].toString("utf8");
  assert.match(list, /^[0-9a-f]{64} {2}cmmns-chrome-[\d.]+\.zip\/a\.js$/m, "the per-file list names every file inside each package");
});

test("only the self-distributed Firefox build carries an update address, and it is https on CMMNS' site", () => {
  assert.equal(browserManifest(manifest, "firefox").browser_specific_settings.gecko.update_url, undefined, "AMO-listed builds must not carry one");
  assert.equal(browserManifest(manifest, "chrome").browser_specific_settings, undefined);
  assert.equal(browserManifest(manifest, "firefox-self").browser_specific_settings.gecko.update_url, FIREFOX_UPDATE_URL);
  assert.equal(FIREFOX_UPDATE_URL, "https://harperz9.github.io/ext/firefox/updates.json", "one permanent address with no product name in it");
});

test("a signed release directory verifies; a changed file, changed sums or another key do not", async () => {
  const dir = mkdtempSync(join(tmpdir(), "radar-release-"));
  try {
    const { privateJwk, publicJwk } = await generateSigningKey();
    writeFileSync(join(dir, "radar-chrome-9.9.9.zip"), "zip bytes");
    writeFileSync(join(dir, "radar-9.9.9.bundle"), "bundle bytes");
    await signDir(dir, privateJwk);
    assert.equal((await verifyDir(dir, publicJwk)).ok, true);
    assert.equal((await verifyDir(dir, (await generateSigningKey()).publicJwk)).signature, false, "another key");
    writeFileSync(join(dir, "extra.txt"), "x");
    assert.deepEqual((await verifyDir(dir, publicJwk)).unlisted, ["extra.txt"]);
    writeFileSync(join(dir, "radar-chrome-9.9.9.zip"), "zip bytes, changed");
    const r = await verifyDir(dir, publicJwk);
    assert.equal(r.ok, false);
    assert.equal(r.files.find((f) => f.name === "radar-chrome-9.9.9.zip").ok, false);
    await signDir(dir, privateJwk);
    writeFileSync(join(dir, "SHA256SUMS"), readFileSync(join(dir, "SHA256SUMS"), "utf8").replace(/^./, "0"));
    assert.equal((await verifyDir(dir, publicJwk)).signature, false, "edited sums");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// Releases before the CMMNS rename (3.8.0 and earlier) name their files radar-*; later ones cmmns-*.
// The checker reads names from the signed list, so both verify, side by side or apart.
test("a release with the old radar-* file names and one with cmmns-* names both verify", async () => {
  const { privateJwk, publicJwk } = await generateSigningKey();
  for (const names of [["radar-chrome-3.8.0.zip", "radar-cli-3.8.0.zip", "radar-3.8.0.bundle"], ["cmmns-chrome-3.9.0.zip", "cmmns-cli-3.9.0.zip", "cmmns-3.9.0.bundle"]]) {
    const dir = mkdtempSync(join(tmpdir(), "cmmns-release-"));
    try {
      for (const n of names) writeFileSync(join(dir, n), `${n} bytes`);
      await signDir(dir, privateJwk);
      const r = await verifyDir(dir, publicJwk);
      assert.equal(r.ok, true, names[0]);
      assert.deepEqual(r.files.map((f) => f.name).sort(), [...names].sort());
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});

test("a signing key is refused inside the repository and accepted outside it", () => {
  assert.equal(insideRepo(join(ROOT, "key.private.jwk")), true);
  assert.equal(insideRepo(join(ROOT, "docs", "deep", "k.jwk")), true);
  assert.equal(insideRepo(join(tmpdir(), "k.jwk")), false);
  assert.equal(insideRepo(join(ROOT, "..", "radar-keys", "k.jwk")), false);
});

test("the Firefox update manifest keeps one entry per version, newest last, with the signed file's hash", () => {
  let doc = addUpdate(null, { version: "3.0.0", link: "https://example.org/r3.xpi", sha256: "a".repeat(64) });
  doc = addUpdate(doc, { version: "2.10.0", link: "https://example.org/r2.xpi", sha256: "b".repeat(64) });
  doc = addUpdate(doc, { version: "3.0.0", link: "https://example.org/r3b.xpi", sha256: "c".repeat(64) });
  const [entry] = Object.values(doc.addons);
  assert.deepEqual(entry.updates.map((u) => u.version), ["2.10.0", "3.0.0"]);
  assert.equal(entry.updates[1].update_hash, "sha256:" + "c".repeat(64));
  assert.equal(Object.keys(doc.addons)[0], manifest.browser_specific_settings.gecko.id);
});

// The release carries the command line tool so a receipt can be checked without the repository:
// unzipped into an empty folder, `radar verify` checks a saved evidence chain and fails an edited one.
test("the command line zip runs verify from an empty folder", async () => {
  const { cliZip, cliFiles } = await import("../scripts/cli-zip.mjs");
  const names = cliFiles().map(([n]) => n);
  for (const n of ["bin/radar.mjs", "src/core/evidence-seal.js", "schema/evidence.v1.json", "package.json", "LICENSE", "src/ext/claims.json"]) assert.ok(names.includes(n), n);
  assert.ok(!names.some((n) => /\.(html|css|woff2)$/.test(n) || n.startsWith("src/ext/fonts")), "only what the command line needs");
  assert.ok(cliZip().equals(cliZip()), "the same tree gives the same bytes");
  const { mkdtempSync, writeFileSync: wf, mkdirSync: md, rmSync: rm } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join: j, dirname: dn } = await import("node:path");
  const { spawnSync } = await import("node:child_process");
  const dir = mkdtempSync(j(tmpdir(), "radar-cli-"));
  try {
    for (const [n, d] of cliFiles()) { md(dn(j(dir, n)), { recursive: true }); wf(j(dir, n), d); }
    const chain = new URL("../docs/demo/demo-evidence-chain.json", import.meta.url), edited = new URL("../docs/demo/demo-evidence-chain-edited.json", import.meta.url);
    const ok = spawnSync(process.execPath, [j(dir, "bin/radar.mjs"), "verify", chain.pathname.replace(/^\/([A-Za-z]:)/, "$1")], { encoding: "utf8", cwd: dir });
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    const bad = spawnSync(process.execPath, [j(dir, "bin/radar.mjs"), "verify", edited.pathname.replace(/^\/([A-Za-z]:)/, "$1")], { encoding: "utf8", cwd: dir });
    assert.equal(bad.status, 1, bad.stdout);
  } finally { rm(dir, { recursive: true, force: true }); }
});
