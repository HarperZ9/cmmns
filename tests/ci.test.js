// CI parity: GitHub Actions runs only scripts/ci.mjs stages, and `npm run ci` runs the same "test"
// stage, so the project can check itself on any machine without GitHub. If the workflow gains a
// step that is not a ci.mjs stage, this fails.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STAGES, C2PA_COMMIT } from "../scripts/ci.mjs";

const wf = readFileSync(new URL("../.github/workflows/test.yml", import.meta.url), "utf8");
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("every command the workflow runs is a ci.mjs stage", () => {
  const runs = [...wf.matchAll(/^\s*- run: (.+)$/gm)].map((m) => m[1].trim());
  assert.ok(runs.length >= 2);
  for (const r of runs) assert.match(r, /^node scripts\/ci\.mjs (\w+)$/, r);
  for (const r of runs) assert.ok(STAGES[r.split(" ").pop()], r);
  assert.doesNotMatch(wf, /^\s+run: \|/m, "no inline shell scripts outside ci.mjs");
});

test("npm run ci is the workflow's test stage, and npm test runs the same test glob", () => {
  assert.equal(pkg.scripts.ci, "node scripts/ci.mjs test");
  assert.match(wf, /- run: node scripts\/ci\.mjs test/);
  assert.equal(STAGES.test[0][2].join(" "), "--test tests/*.test.js");
  assert.equal(pkg.scripts.test, 'node --test "tests/*.test.js"');
});

test("the bundle check and the pinned c2pa commit are in the stages", () => {
  assert.ok(STAGES.test.some(([, cmd, args]) => cmd === "git" && args.includes("--exit-code") && args.includes("src/ext/core.bundle.js")));
  assert.match(C2PA_COMMIT, /^[0-9a-f]{40}$/);
});
