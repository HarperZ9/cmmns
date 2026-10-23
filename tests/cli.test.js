// The radar command line tool (bin/radar.mjs): analyze prints a report or JSON from local files,
// writes a signed bundle with a key kept outside the repository, and verify checks a bundle and
// fails on a changed one. The offline analyser page loads only Daylight Commons' own scripts and tables.
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
  assert.match(text.stdout, /What it shows:/);
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
  assert.match(refused.stderr, /^radar: Daylight Commons found zero readable posts/);
  assert.match(execFileSync(process.execPath, [CLI], { encoding: "utf8" }), /^Usage:/);
  assert.deepEqual(parseArgs(["analyze", "f", "--json", "--bundle", "o.json", "--key-id=abc"]), { _: ["analyze", "f"], flags: { json: true, bundle: "o.json", "key-id": "abc" } });
});

test("the offline analyser page loads only Daylight Commons' own files and never writes markup from a file", () => {
  const html = readFileSync(join(ROOT, "src/ext/analyze.html"), "utf8");
  for (const m of html.matchAll(/<script src="([^"]+)"/g)) assert.ok(existsSync(join(ROOT, "src/ext", m[1])), m[1]);
  assert.doesNotMatch(html, /https?:\/\/(?!json-schema)/, "no remote resource");
  for (const f of ["analyze.js", "analyze-view.js", "signing.js", "evidence-bundle-ui.js"]) {
    const src = readFileSync(join(ROOT, "src/ext", f), "utf8");
    assert.doesNotMatch(src, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/, f);
    for (const m of src.matchAll(/fetch\(([^)]*)\)/g)) assert.match(m[1], /^url\(/, `${f}: fetch reads Daylight Commons' own package only`);
  }
  assert.match(readFileSync(join(ROOT, "src/ext/popup.js"), "utf8"), /analyze\.html/);
});

test("the extension's core bundle carries radar-core for its pages", async () => {
  await import("../src/ext/core.bundle.js");
  for (const name of ["analyzeThread", "analyzeText", "checkMedia", "siteInfo", "useData", "importFile", "makeBundle", "signBundle", "verifyBundle", "newBundleKey", "publicKeyOf", "dataLockOf", "BUNDLE_DOES_NOT_PROVE", "API_VERSION"]) assert.ok(name in globalThis.PB, name);
  const r = globalThis.PB.analyzeText("As an AI language model I cannot help.");
  assert.equal(r.evidence[0].kind, "leaked-ai");
});

// "Save evidence chain" in the extension writes radar-evidence-chain/1; verify must check it
// offline and reject every tamper the seal tests reject, with a line per property.
test("verify checks a saved evidence chain and fails an edited, reordered or truncated one", async () => {
  const { makeReceipt } = await import("../src/core/receipt.js");
  const { emptySeal, appendSeal, exportSeal } = await import("../src/core/evidence-seal.js");
  let seal = emptySeal();
  for (const [kind, subject] of [["repo-created", "example/demo"], ["domain-registered", "demo.example"], ["wayback-first", "demo.example"]]) {
    seal = await appendSeal(seal, await makeReceipt({ kind, subject, observed: { n: subject.length }, source: "fixture", dnp: "a fixture fact proves nothing" }));
  }
  const x = await exportSeal(seal, { title: "fixture", at: "2026-10-22T00:00:00.000Z" });
  const file = (name, v) => { const p = join(dir, name); writeFileSync(p, JSON.stringify(v, null, 2)); return p; };
  const ok = run("verify", file("chain.json", x));
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.match(ok.stdout, /^Checks pass/);
  assert.match(ok.stdout, /Evidence chain: 3 receipts/);
  for (const name of ["receipts", "chain", "head", "Merkle root", "inclusion proofs"]) assert.match(ok.stdout, new RegExp(`pass  ${name}:`));
  assert.match(ok.stdout, /domain-registered {2}demo\.example/);
  assert.match(ok.stdout, /What it shows:/);
  const json = JSON.parse(run("verify", join(dir, "chain.json"), "--json").stdout);
  assert.equal(json.ok, true); assert.equal(json.size, 3);
  const clone = () => JSON.parse(JSON.stringify(x));
  const edited = clone(); edited.seal.entries[1].receipt.subject = "other.example";
  const reordered = clone(); [reordered.seal.entries[0], reordered.seal.entries[2]] = [reordered.seal.entries[2], reordered.seal.entries[0]];
  const cut = clone(); cut.seal.entries.pop();
  const noSeal = clone(); delete noSeal.seal;
  for (const [name, v, failing] of [["edited", edited, "receipts"], ["reordered", reordered, "chain"], ["cut", cut, "head"], ["noseal", noSeal, "format"]]) {
    const r = run("verify", file(`chain-${name}.json`, v));
    assert.equal(r.status, 1, `${name}: ${r.stdout}`);
    assert.match(r.stdout, /^Checks fail/, name);
    assert.match(r.stdout, new RegExp(`FAIL  ${failing}:`), name);
  }
});

test("analyze reads quoted posts, keeps them out of the reply count, and bundles them", () => {
  const file = join(FX, "thread-quoted.json");
  const json = JSON.parse(run("analyze", file, "--json", "--no-claims").stdout);
  assert.equal(json.posts.n, 6, "a quoted post is not a reply");
  assert.deepEqual(json.posts.quoted, ["q1", "q2"]);
  const strong = json.evidence.filter((e) => e.kind === "strong-language");
  assert.ok(strong.some((e) => e.posts[0] === "q1" && e.data.family === "dehumanise"), "the top-level quoted list is read");
  assert.ok(strong.some((e) => e.posts[0] === "q2" && e.data.family === "slur"), "a reply's own quoted post is read");
  const plain = JSON.parse(run("analyze", join(FX, "thread.json"), "--json", "--no-claims").stdout);
  assert.equal("quoted" in plain.posts, false, "a thread with no quoted posts is reported as before");
  const text = run("analyze", file, "--no-claims");
  assert.match(text.stdout, /2 quoted posts read too\./);
  const out = join(dir, "quoted-bundle.json");
  assert.equal(run("analyze", file, "--no-claims", "--include-text", "--bundle", out, "--key", join(dir, "kq.jwk")).status, 0);
  const ok = run("verify", out);
  assert.equal(ok.status, 0, ok.stdout);
});
