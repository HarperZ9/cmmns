// The extension loads src/ext/core.bundle.js, not src/core. This test fails when the bundle is
// stale, so a core change cannot ship without `npm run build`. Line endings are ignored: a Windows
// checkout can hold CRLF while the build writes LF, and that is not staleness.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bundle = join(root, "src/ext/core.bundle.js");

test("core.bundle.js and ocr.bundle.js match a fresh build of src/core and src/ocr", () => {
  const lf = (s) => s.split("\r\n").join("\n");
  // Built in a copy: other test files import the bundles in parallel, so the tree is never rewritten.
  const copy = mkdtempSync(join(tmpdir(), "radar-build-"));
  try {
    for (const d of ["scripts", "src"]) cpSync(join(root, d), join(copy, d), { recursive: true });
    execFileSync(process.execPath, [join(copy, "scripts/build.mjs")], { stdio: "ignore" });
    for (const f of ["src/ext/core.bundle.js", "src/ext/ocr.bundle.js"]) assert.equal(lf(readFileSync(join(copy, f), "utf8")), lf(readFileSync(join(root, f), "utf8")), `run \`npm run build\` and commit ${f}`);
  } finally { rmSync(copy, { recursive: true, force: true }); }
});

test("the bundle exposes the functions the content scripts call", async () => {
  await import("../src/ext/core.bundle.js");
  for (const name of ["parseAbout", "compare", "flagsFor", "duplicateClusters", "threadReport", "score", "DOES_NOT_PROVE", "REPORT_DOES_NOT_PROVE", "buildClaimIndex", "matchClaims", "claimCard", "igAbout", "pageTransparency", "fbKey", "fbProfile", "bskyAuthors", "bskyPosts", "readCredentials", "credentialState", "credentialRows", "credentialSignals", "firstSeen", "keyframeTimes", "aiMetadata", "feedDashboard", "addFeedPosts", "threadContext", "coGraph", "forceLayout", "threadUrl", "evidenceCard", "sealCard", "cardLines", "FEED_DOES_NOT_SHOW", "GRAPH_DOES_NOT_PROVE"]) {
    assert.ok(name in globalThis.PB, name);
  }
});
