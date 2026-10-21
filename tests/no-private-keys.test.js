// No private key material anywhere in the tree: tracked files and untracked files git would add.
// Signing keys live outside the repository (scripts/pack.mjs refuses to write one inside it), and
// .gitignore guards the usual key file names. The patterns are assembled at run time so this file
// does not match itself.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PEM = new RegExp("-----BEGIN (?:EC |RSA |DSA |OPENSSH |ENCRYPTED )?" + "PRIVATE KEY-----");
// A JWK with a private scalar: "d" next to "kty" in the same object.
const JWK_D = new RegExp('"d"\\s*:\\s*"[A-Za-z0-9_-]{32,}"');
const KEY_NAMES = /\.(private\.jwk|pem|key|p12|pfx)$/i;

const files = () => execFileSync("git", ["ls-files", "-co", "--exclude-standard"], { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 }).split("\n").filter(Boolean);

export function privateKeyProblems(name, text) {
  const out = [];
  if (KEY_NAMES.test(name)) out.push(`${name}: a key file name`);
  if (PEM.test(text)) out.push(`${name}: a PEM private key`);
  if (JWK_D.test(text) && /"kty"\s*:/.test(text)) out.push(`${name}: a JWK with a private part`);
  return out;
}

test("the detector finds a PEM key, a private JWK and a key file name, and passes a public JWK", () => {
  assert.equal(privateKeyProblems("a.txt", "-----BEGIN EC " + "PRIVATE KEY-----\nabc").length, 1);
  assert.equal(privateKeyProblems("a.json", JSON.stringify({ kty: "EC", crv: "P-256", x: "x".repeat(43), y: "y".repeat(43), d: "d".repeat(43) })).length, 1);
  assert.equal(privateKeyProblems("signing.private.jwk", "").length, 1);
  assert.deepEqual(privateKeyProblems("pub.json", JSON.stringify({ kty: "EC", crv: "P-256", x: "x".repeat(43), y: "y".repeat(43) })), []);
});

test("no file in the tree holds private key material", () => {
  const problems = [];
  for (const f of files()) {
    let text = "";
    try { if (statSync(join(root, f)).size < 8 * 1024 * 1024) text = readFileSync(join(root, f), "latin1"); } catch { continue; }   // deleted in the working tree
    problems.push(...privateKeyProblems(f, text));
  }
  assert.deepEqual(problems, []);
});

test(".gitignore keeps key files out", () => {
  const ignore = readFileSync(join(root, ".gitignore"), "utf8");
  for (const p of ["*.private.jwk", "*.pem", "*.key", "radar-keys/"]) assert.ok(ignore.split(/\r?\n/).includes(p), p);
});
