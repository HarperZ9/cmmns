// The extension loads src/ext/core.bundle.js, not src/core. This test fails when the bundle is
// stale, so a core change cannot ship without `npm run build`. Line endings are ignored: a Windows
// checkout can hold CRLF while the build writes LF, and that is not staleness.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, copyFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bundle = join(root, "src/ext/core.bundle.js");

test("core.bundle.js and ocr.bundle.js match a fresh build of src/core and src/ocr", () => {
  const lf = (s) => s.split("\r\n").join("\n");
  const files = [bundle, join(root, "src/ext/ocr.bundle.js")];
  const before = files.map((f) => readFileSync(f, "utf8"));
  for (const f of files) copyFileSync(f, f + ".bak");
  try {
    execFileSync(process.execPath, [join(root, "scripts/build.mjs")], { stdio: "ignore" });
    files.forEach((f, i) => assert.equal(lf(readFileSync(f, "utf8")), lf(before[i]), `run \`npm run build\` and commit ${f}`));
  } finally {
    for (const f of files) { copyFileSync(f + ".bak", f); rmSync(f + ".bak"); }
  }
});

test("the bundle exposes the functions the content scripts call", async () => {
  await import("../src/ext/core.bundle.js");
  for (const name of ["parseAbout", "compare", "flagsFor", "duplicateClusters", "threadReport", "score", "DOES_NOT_PROVE", "REPORT_DOES_NOT_PROVE", "buildClaimIndex", "matchClaims", "claimCard", "igAbout", "pageTransparency", "fbKey", "fbProfile", "bskyAuthors", "bskyPosts", "readCredentials", "credentialState", "credentialRows", "credentialSignals", "firstSeen", "keyframeTimes", "aiMetadata", "feedDashboard", "addFeedPosts", "threadContext", "coGraph", "forceLayout", "threadUrl", "evidenceCard", "sealCard", "cardLines", "FEED_DOES_NOT_SHOW", "GRAPH_DOES_NOT_PROVE"]) {
    assert.ok(name in globalThis.PB, name);
  }
});
