// The sign-off check (scripts/dco-check.mjs) run on every pull request by .github/workflows/dco.yml.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseLog, signOffs, checkCommit } from "../scripts/dco-check.mjs";
import { STAGES } from "../scripts/ci.mjs";

const author = { name: "Ada Example", email: "ada@example.org" };

test("a commit signed off by its own author passes", () => {
  assert.equal(checkCommit({ ...author, body: "fix: a thing\n\nSigned-off-by: Ada Example <ada@example.org>\n" }), null);
  assert.equal(checkCommit({ ...author, body: "x\n\nsigned-off-by:  ada example  <ADA@example.org>" }), null, "case and spacing");
  assert.equal(checkCommit({ ...author, body: "x\n\nSigned-off-by: Bo <bo@example.org>\nSigned-off-by: Ada Example <ada@example.org>" }), null, "one of several");
});

test("missing, mismatched or malformed sign-offs fail with a reason", () => {
  assert.equal(checkCommit({ ...author, body: "fix: a thing" }), "no Signed-off-by line");
  assert.match(checkCommit({ ...author, body: "x\n\nSigned-off-by: Bo <bo@example.org>" }), /author is Ada Example/);
  assert.match(checkCommit({ ...author, body: "x\n\nSigned-off-by: Ada Example <other@example.org>" }), /signed off as/);
  assert.equal(checkCommit({ ...author, body: "x\n\nSigned-off-by: Ada Example" }), "no Signed-off-by line", "no email");
  assert.equal(checkCommit({ ...author, body: "x mentions Signed-off-by: Ada Example <ada@example.org> mid-line" }), "no Signed-off-by line");
});

test("the git log format parses into commits", () => {
  const log = "abc\x1fAda Example\x1fada@example.org\x1ffix\n\nSigned-off-by: Ada Example <ada@example.org>\n\x1e\ndef\x1fBo\x1fbo@example.org\x1fdocs\n\x1e\n";
  const c = parseLog(log);
  assert.equal(c.length, 2);
  assert.deepEqual([c[0].sha, c[1].name, c[1].email], ["abc", "Bo", "bo@example.org"]);
  assert.equal(signOffs(c[0].body).length, 1);
  assert.equal(checkCommit(c[1]), "no Signed-off-by line");
});

test("the workflow runs only the ci.mjs dco stage, pins its action and reads nothing it can write", () => {
  const wf = readFileSync(new URL("../.github/workflows/dco.yml", import.meta.url), "utf8");
  const runs = [...wf.matchAll(/^\s*- run: (.+)$/gm)].map((m) => m[1].trim());
  assert.deepEqual(runs, ["node scripts/ci.mjs dco"]);
  assert.ok(STAGES.dco);
  for (const [, ref] of wf.matchAll(/uses: [\w./-]+@(\S+)/g)) assert.match(ref, /^[0-9a-f]{40}$/, "actions pinned to a full SHA");
  assert.match(wf, /^permissions:\n {2}contents: read$/m);
  assert.match(wf, /fetch-depth: 0/);
  assert.match(wf, /^on:\n {2}pull_request:/m);
});
