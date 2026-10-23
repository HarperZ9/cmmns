// The mirror check (scripts/mirror-check.mjs) against mirrors served on this machine: three honest
// mirrors pass; a mirror with an older head, one with a changed file, one serving a different head
// under the same version and one that is unreachable are each named, and the run exits non-zero.
// BACKLOG increment 2, acceptance test 8.
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { generateSigningKey } from "../src/core/signing.js";
import { signDir } from "../scripts/release-lib.mjs";
import { writeHead } from "../scripts/head-lib.mjs";
import { checkMirrors, report } from "../scripts/mirror-check.mjs";

const K = await generateSigningKey();
const ROOT = mkdtempSync(join(tmpdir(), "radar-mirrors-"));
const servers = [];
test.after(() => { for (const s of servers) s.close(); rmSync(ROOT, { recursive: true, force: true }); });
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");

async function release(name, version, content, expiresDays = 90) {
  const dir = join(ROOT, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "radar-chrome-9.9.9.zip"), content);
  writeFileSync(join(dir, "radar-9.9.9.bundle"), "bundle bytes");
  await signDir(dir, K.privateJwk);
  await writeHead(dir, K.privateJwk, { version, time: iso(Date.now()), expires: iso(Date.now() + expiresDays * 86400000), release: "9.9.9", catalogue: { version: "2026.10.22", sha256: "b".repeat(64) } });
  return dir;
}
// A static server for one folder on 127.0.0.1; resolves to its base url.
function serve(dir) {
  const s = createServer((req, res) => {
    const f = join(dir, decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, ""));
    if (!f.startsWith(dir) || !existsSync(f)) { res.writeHead(404).end(); return; }
    res.writeHead(200).end(readFileSync(f));
  });
  servers.push(s);
  return new Promise((ok) => s.listen(0, "127.0.0.1", () => ok(`http://127.0.0.1:${s.address().port}/`)));
}
async function closedPort() {
  const s = createServer();
  await new Promise((ok) => s.listen(0, "127.0.0.1", ok));
  const url = `http://127.0.0.1:${s.address().port}/`;
  await new Promise((ok) => s.close(ok));
  return url;
}
const copy = (from, name) => { const d = join(ROOT, name); cpSync(from, d, { recursive: true }); return d; };

test("8. three honest mirrors pass; an older head, a changed file, a forked head and an unreachable mirror are each named", async () => {
  const current = await release("current", 2, "zip v2");
  const honest = await Promise.all(["a", "b", "c"].map((n) => serve(copy(current, n))));
  const good = await checkMirrors(honest, { key: K.publicJwk, timeoutMs: 5000 });
  assert.equal(good.ok, true, report(good));
  assert.equal(good.newest, 2);

  const old = await serve(await release("old", 1, "zip v1"));
  const changedDir = copy(current, "changed");
  writeFileSync(join(changedDir, "radar-chrome-9.9.9.zip"), "zip v2, altered");
  const changed = await serve(changedDir);
  const fork = await serve(await release("fork", 2, "zip v2", 200));
  const gone = await closedPort();
  const r = await checkMirrors([honest[0], old, changed, fork, gone], { key: K.publicJwk, timeoutMs: 5000 });
  assert.equal(r.ok, false);
  const by = Object.fromEntries(r.mirrors.map((m) => [m.url, m]));
  assert.equal(by[honest[0]].ok, true);
  assert.match(by[old].problems.join("\n"), /^older head: version 1, newest seen 2$/m);
  assert.match(by[changed].problems.join("\n"), /^changed file: radar-chrome-9\.9\.9\.zip differs from the signed list$/m);
  assert.match(by[fork].problems.join("\n"), new RegExp(`^disagrees with ${honest[0].replace(/[.]/g, "\\.")}: a different head under version 2$`, "m"));
  assert.match(by[gone].problems.join("\n"), /^unreachable: /m);
  const text = report(r);
  for (const u of [old, changed, fork, gone]) assert.match(text, new RegExp(`^FAIL  ${u.replace(/[.]/g, "\\.")}  `, "m"), `the report names ${u}`);
  assert.match(text, /4 of 5 mirrors failed/);
});

test("8 (exit code). the command exits zero for honest mirrors and non-zero when one fails", async () => {
  const current = await release("cli", 3, "zip v3");
  const honest = await Promise.all(["x", "y", "z"].map((n) => serve(copy(current, "cli-" + n))));
  const keyFile = join(ROOT, "key.json");
  writeFileSync(keyFile, JSON.stringify(K.publicJwk));
  const run = promisify(execFile);
  const ok = await run(process.execPath, ["scripts/mirror-check.mjs", ...honest, "--key", keyFile], { cwd: new URL("..", import.meta.url) });
  assert.match(ok.stdout, /all 3 mirrors agree on head version 3/);
  await assert.rejects(run(process.execPath, ["scripts/mirror-check.mjs", ...honest, await closedPort(), "--key", keyFile], { cwd: new URL("..", import.meta.url) }), (e) => e.code === 1 && /FAIL .* unreachable/.test(e.stdout));
});
