// The extension loads src/ext/{core,ocr,discourse}.bundle.js, not src/core or src/ocr directly.
// This test verifies that every committed bundle matches a fresh build from modular sources, that
// fresh builds are byte-for-byte deterministic across runs, and that `scripts/build.mjs --check`
// catches a 1-byte drift in any bundle. Line endings are normalised to LF for Windows checkouts.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BUNDLE_FILES = ["src/ext/core.bundle.js", "src/ext/ocr.bundle.js", "src/ext/discourse.bundle.js"];
const lf = (s) => s.split("\r\n").join("\n");
const sha256 = (s) => createHash("sha256").update(s, "utf8").digest("hex");

function copyTree() {
  const copy = mkdtempSync(join(tmpdir(), "radar-build-"));
  for (const d of ["scripts", "src"]) cpSync(join(root, d), join(copy, d), { recursive: true });
  return copy;
}

test("core.bundle.js, ocr.bundle.js and discourse.bundle.js match a deterministic fresh build", () => {
  // Built in two isolated copies: other test files import the bundles in parallel, so the repo tree is never rewritten.
  const copyA = copyTree(), copyB = copyTree();
  try {
    execFileSync(process.execPath, [join(copyA, "scripts/build.mjs")], { stdio: "ignore" });
    execFileSync(process.execPath, [join(copyB, "scripts/build.mjs")], { stdio: "ignore" });
    for (const f of BUNDLE_FILES) {
      const builtA = lf(readFileSync(join(copyA, f), "utf8"));
      const builtB = lf(readFileSync(join(copyB, f), "utf8"));
      const committed = lf(readFileSync(join(root, f), "utf8"));
      assert.equal(sha256(builtA), sha256(builtB), `non-deterministic fresh build for ${f}`);
      assert.equal(builtA, committed, `run \`npm run build\` and commit ${f}`);
    }
  } finally {
    rmSync(copyA, { recursive: true, force: true });
    rmSync(copyB, { recursive: true, force: true });
  }
});

test("scripts/build.mjs --check passes on clean bundles and fails on 1-byte drift in any bundle", () => {
  const ok = spawnSync(process.execPath, [join(root, "scripts/build.mjs"), "--check"], { encoding: "utf8" });
  assert.equal(ok.status, 0, ok.stderr || ok.stdout);
  for (const f of BUNDLE_FILES) assert.match(ok.stdout, new RegExp(`ok\\s+${f.replace(/\./g, "\\.")}`));

  const copy = copyTree();
  try {
    for (const f of BUNDLE_FILES) {
      const target = join(copy, f);
      const orig = readFileSync(target, "utf8");
      writeFileSync(target, orig + " ");
      const drifted = spawnSync(process.execPath, [join(copy, "scripts/build.mjs"), "--check"], { encoding: "utf8" });
      assert.notEqual(drifted.status, 0, `expected --check to fail on drifted ${f}`);
      assert.match(drifted.stdout, new RegExp(`DRIFT\\s+${f.replace(/\./g, "\\.")}`));
      writeFileSync(target, orig);
    }
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
});

test("the bundles expose the functions the content scripts call", async () => {
  await import("../src/ext/core.bundle.js");
  for (const name of [
    "parseAbout", "compare", "flagsFor", "duplicateClusters", "threadReport", "score", "DOES_NOT_PROVE", "REPORT_DOES_NOT_PROVE",
    "buildClaimIndex", "matchClaims", "claimCard", "igAbout", "pageTransparency", "fbKey", "fbProfile", "bskyAuthors", "bskyPosts",
    "readCredentials", "credentialState", "credentialRows", "credentialSignals", "firstSeen", "keyframeTimes", "aiMetadata",
    "feedDashboard", "addFeedPosts", "threadContext", "coGraph", "forceLayout", "threadUrl", "evidenceCard", "sealCard", "cardLines",
    "FEED_DOES_NOT_SHOW", "GRAPH_DOES_NOT_PROVE",
    "sidecarDigest", "verifySidecarDigest", "sidecarEngineReceipt", "verifySidecarEngineReceipt", "sidecarReceiptSidecars",
    "classifySite", "classifyMediaKind", "sidecarRoutingMeta", "planStreamlinedDownload",
    "extractLikesCursor", "createDedupIndex", "admitWithPolicy", "paginateLikes",
  ]) {
    assert.ok(name in globalThis.PB, name);
  }
  await import("../src/ext/discourse.bundle.js");
  assert.ok(globalThis.PBD && typeof globalThis.PBD === "object");
});
