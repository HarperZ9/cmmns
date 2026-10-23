// Production hardening (project-docs/PRODUCTION-READINESS.md): case file names stay inside their
// folder, post text cannot become markup in any export or page, and the extension never builds
// markup from strings.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { within, isWithin } from "../src/investigate/paths.js";
import { importLegacy } from "../src/investigate/legacy.js";
import { checkExportFiles, BUNDLE_FILE } from "../src/investigate/export.js";
import { markdownHtml } from "../src/investigate/dossier.js";
import { networkHtml } from "../src/investigate/network.js";

const tmp = () => mkdtempSync(join(tmpdir(), "dc-hard-"));

test("a file name from a case table must stay inside its folder", () => {
  const base = tmp();
  assert.equal(within(base, "captures/S01.html"), join(base, "captures", "S01.html"));
  for (const bad of ["../secret.txt", "captures/../../x", "/etc/passwd", "C:\Windows\win.ini", "C:/x", "", "..", "a\0b"]) {
    assert.throws(() => within(base, bad), /inside|outside/, bad);
    assert.equal(isWithin(base, bad), false, bad);
  }
});

test("case import does not copy a capture from outside the old folder", () => {
  const root = tmp(), old = join(root, "old"), dir = join(root, "case");
  mkdirSync(old); mkdirSync(join(dir, "captures"), { recursive: true });
  writeFileSync(join(root, "outside.txt"), "private");
  writeFileSync(join(old, "inside.txt"), "public");
  writeFileSync(join(old, "sources.jsonl"), [
    { id: "S01", url: "https://example.org/a", capture: { raw_file: "../outside.txt", sha256: "x" } },
    { id: "S02", url: "https://example.org/b", capture: { raw_file: "inside.txt", sha256: "y" } },
  ].map((r) => JSON.stringify(r)).join("\n") + "\n");
  const r = importLegacy(dir, old, { withCaptures: true });
  assert.equal(r.copied, 1);
  const copied = readdirSync(join(dir, "captures")).map((f) => readFileSync(join(dir, "captures", f), "utf8"));
  assert.deepEqual(copied, ["public"]);
});

test("verify-export never reads a file named outside the export folder", () => {
  const d = tmp();
  writeFileSync(join(d, BUNDLE_FILE), JSON.stringify({ evidence: [{ data: { path: "../../outside.txt", sha256: "0" } }, { data: { path: "ok.txt", sha256: "0" } }] }));
  const files = checkExportFiles(d);
  assert.equal(files[0].ok, false);
  assert.match(files[0].text, /outside/);
  assert.equal(files[1].text, "missing");
});

test("post text cannot become markup in a dossier or a network page", () => {
  const evil = `<script>alert(1)</script><img src=x onerror=alert(2)> "quoted" 'single'`;
  const d = markdownHtml(`# ${evil}\n- ${evil}\n${evil}`, evil);
  assert.ok(!/<script>alert|<img /.test(d), "dossier escapes");
  assert.match(d, /Content-Security-Policy/);
  const n = networkHtml({ nodes: [{ id: evil, in: 1, out: 0 }, { id: "@b", in: 0, out: 1 }], edges: [{ from: "@b", to: evil, type: "quote", n: 1, sources: [evil] }], doesNotProve: evil }, evil);
  assert.ok(!/<script>alert|<img /.test(n), "network escapes");
  assert.match(n, /Content-Security-Policy/);
});

test("the extension never builds markup from strings", () => {
  const dir = new URL("../src/ext/", import.meta.url);
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".js"))) {
    const s = readFileSync(new URL(f, dir), "utf8").replace(/\/\/[^\n]*/g, "");
    assert.ok(!/\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML|document\.write\(/.test(s), f);
  }
});
