// The radar command line tool (bin/radar.mjs): analyze prints a report or JSON from local files,
// writes a signed bundle with a key kept outside the repository, and verify checks a bundle and
// fails on a changed one. The offline analyser page loads only Radar's own scripts and tables.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "../bin/radar.mjs";

const ROOT = join(import.meta.dirname, "..");
const CLI = join(ROOT, "bin", "radar.mjs");
const FX = join(ROOT, "tests", "fixtures", "integration");
const run = (...args) => spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
const dir = mkdtempSync(join(tmpdir(), "radar-cli-"));
test.after(() => rmSync(dir, { recursive: true, force: true }));

test("analyze prints a readable report and JSON that fits the schema", () => {
  const text = run("analyze", join(FX, "thread.json"), "--no-claims");
  assert.equal(text.status, 0, text.stderr);
  assert.match(text.stdout, /^Thread on X: 15 posts from 14 accounts\./);
  assert.match(text.stdout, /Does not prove:/);
  const json = JSON.parse(run("analyze", join(FX, "x-saved.html"), "--json", "--no-claims").stdout);
  assert.equal(json.kind, "thread");
  assert.ok(json.evidence.some((e) => e.kind === "strong-language"));
});

test("analyze writes a signed bundle that verify accepts, and verify fails a changed copy", () => {
  const key = join(dir, "key.jwk"), out = join(dir, "bundle.json");
  const a = run("analyze", join(FX, "thread.json"), "--no-claims", "--bundle", out, "--key", key);
  assert.equal(a.status, 0, a.stderr);
  assert.ok(existsSync(key), "the key is made on first use, where the user said");
  assert.match(a.stderr, /Signed bundle written/);
  const ok = run("verify", out);
  assert.equal(ok.status, 0, ok.stdout);
  assert.match(ok.stdout, /^Checks pass/);
  const b = JSON.parse(readFileSync(out, "utf8"));
  assert.equal(b.textIncluded, false);
  assert.match(b.dataLock.value, /^[0-9a-f]{64}$/);
  assert.match(run("verify", out, "--key-id", b.signer.keyId).stdout, /signed by the key you expected/);
  b.evidence[0].shows = "changed";
  writeFileSync(join(dir, "bad.json"), JSON.stringify(b));
  const bad = run("verify", join(dir, "bad.json"));
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /FAIL {2}signature/);
  const again = run("analyze", join(FX, "thread.json"), "--no-claims", "--bundle", join(dir, "b2.json"), "--key", key);
  assert.equal(JSON.parse(readFileSync(join(dir, "b2.json"), "utf8")).signer.keyId, JSON.parse(readFileSync(out, "utf8")).signer.keyId, "the same key signs again");
});

test("site, media, a refused file and the usage text", () => {
  assert.match(run("site", "washingtonpost.pm").stdout, /look-alike of washingtonpost\.com/);
  assert.match(run("media", join(ROOT, "tests", "fixtures", "c2pa", "ai.jpg")).stdout, /marked as made with AI/);
  const refused = run("analyze", join(ROOT, "package.json"));
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /^radar: Radar found no posts/);
  assert.match(execFileSync(process.execPath, [CLI], { encoding: "utf8" }), /^Usage:/);
  assert.deepEqual(parseArgs(["analyze", "f", "--json", "--bundle", "o.json", "--key-id=abc"]), { _: ["analyze", "f"], flags: { json: true, bundle: "o.json", "key-id": "abc" } });
});

test("the offline analyser page loads only Radar's own files and never writes markup from a file", () => {
  const html = readFileSync(join(ROOT, "src/ext/analyze.html"), "utf8");
  for (const m of html.matchAll(/<script src="([^"]+)"/g)) assert.ok(existsSync(join(ROOT, "src/ext", m[1])), m[1]);
  assert.doesNotMatch(html, /https?:\/\/(?!json-schema)/, "no remote resource");
  for (const f of ["analyze.js", "analyze-view.js", "signing.js", "evidence-bundle-ui.js"]) {
    const src = readFileSync(join(ROOT, "src/ext", f), "utf8");
    assert.doesNotMatch(src, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/, f);
    for (const m of src.matchAll(/fetch\(([^)]*)\)/g)) assert.match(m[1], /^url\(/, `${f}: fetch reads Radar's own package only`);
  }
  assert.match(readFileSync(join(ROOT, "src/ext/popup.js"), "utf8"), /analyze\.html/);
});

test("the extension's core bundle carries radar-core for its pages", async () => {
  await import("../src/ext/core.bundle.js");
  for (const name of ["analyzeThread", "analyzeText", "checkMedia", "siteInfo", "useData", "importFile", "makeBundle", "signBundle", "verifyBundle", "newBundleKey", "publicKeyOf", "dataLockOf", "BUNDLE_DOES_NOT_PROVE", "API_VERSION"]) assert.ok(name in globalThis.PB, name);
  const r = globalThis.PB.analyzeText("As an AI language model I cannot help.");
  assert.equal(r.evidence[0].kind, "leaked-ai");
});
