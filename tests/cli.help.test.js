// Every command has its own --help with what it does, its usage and an example, and errors say
// what to do next (project-docs/PRODUCTION-READINESS.md, "The workbench").
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runCaseCommand, CASE_USAGE } from "../bin/lib/case.mjs";
import { CASE_HELP, TOP_HELP } from "../bin/lib/help.mjs";

const BIN = new URL("../bin/radar.mjs", import.meta.url).pathname.replace(/^\/([a-z]:)/i, "$1");
const commandsInUsage = [...CASE_USAGE.matchAll(/^ {2}([a-z-]+)/gm)].map((m) => m[1]);

test("every case command in the usage has its own help", async () => {
  for (const c of [...new Set([...commandsInUsage, "verify-export", "timeline"])]) {
    assert.ok(CASE_HELP[c], `no help for ${c}`);
    const r = await runCaseCommand([c, "--help"], { cwd: tmpdir() });
    assert.equal(r.code, 0, c);
    assert.match(r.out, /Usage:\n {2}cmmns case /, c);
    assert.match(r.out, /Example:\n {2}cmmns case /, c);
  }
  const viaHelp = await runCaseCommand(["help", "trace"], { cwd: tmpdir() });
  assert.match(viaHelp.out, /^cmmns case trace: /);
});

test("every top-level command has its own help", () => {
  for (const c of Object.keys(TOP_HELP)) {
    const out = execFileSync(process.execPath, [BIN, c, "--help"], { encoding: "utf8" });
    assert.match(out, new RegExp(`^cmmns ${c}: `), c);
  }
});

test("errors say what happened and what to do", () => {
  const missing = spawnSync(process.execPath, [BIN, "verify", join(tmpdir(), "no-such-file-dc.json")], { encoding: "utf8" });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /^cmmns: No such file or folder: .*Check the path/);
  assert.match(missing.stderr, /cmmns verify --help/);
  const notCase = spawnSync(process.execPath, [BIN, "case", "claims", "--case", mkdtempSync(join(tmpdir(), "dc-nc-"))], { encoding: "utf8" });
  assert.equal(notCase.status, 1);
  assert.match(notCase.stderr, /is not a case folder.*cmmns case init/);
  const unknown = spawnSync(process.execPath, [BIN, "case", "nosuch"], { encoding: "utf8" });
  assert.match(unknown.stdout, /Unknown case command "nosuch"/);
});
