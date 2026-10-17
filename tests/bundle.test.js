// The extension loads src/ext/core.bundle.js, not src/core. This test fails when the bundle is
// stale, so a core change cannot ship without `npm run build`.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, copyFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bundle = join(root, "src/ext/core.bundle.js");

test("core.bundle.js matches a fresh build of src/core", () => {
  const before = readFileSync(bundle, "utf8");
  const backup = bundle + ".bak";
  copyFileSync(bundle, backup);
  try {
    execFileSync(process.execPath, [join(root, "scripts/build.mjs")], { stdio: "ignore" });
    assert.equal(readFileSync(bundle, "utf8"), before, "run `npm run build` and commit the bundle");
  } finally {
    copyFileSync(backup, bundle);
    rmSync(backup);
  }
});

test("the bundle exposes the functions the content scripts call", async () => {
  await import("../src/ext/core.bundle.js");
  for (const name of ["parseAbout", "compare", "flagsFor", "duplicateClusters", "threadReport", "score", "DOES_NOT_PROVE", "REPORT_DOES_NOT_PROVE"]) {
    assert.ok(name in globalThis.PB, name);
  }
});
