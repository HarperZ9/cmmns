// The CMMNS rename (3.9.0, 2026-10-28) changed names a person reads and nothing a saved file, an
// installed extension or a signature depends on. tests/fixtures/v3.8.0/ holds what the v3.8.0
// release itself wrote (made by running that release's code, not this tree's): a media save and its
// sidecar in Downloads/Daylight/x/, an evidence capture with its custody line, a signed evidence
// bundle and a signed case export. Every reader in this build must accept them unchanged.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, mkdtempSync, cpSync, utimesSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkSidecars } from "../bin/lib/sidecar-check.mjs";
import { checkFiles } from "../bin/lib/sidecar-files.mjs";
import { collect } from "../bin/lib/board.mjs";
import { verifyCaptures } from "../bin/lib/capture-verify.mjs";
import { verifyBundle } from "../src/core/evidence-bundle.js";
import { CAPTURE_FORMAT, CUSTODY_FORMAT, captureRecord } from "../src/core/capture.js";
import { envValue, envSource } from "../src/core/env-names.js";

const ROOT = join(import.meta.dirname, "..");
const FX = join(ROOT, "tests", "fixtures", "v3.8.0");
const SAVES = join(FX, "Daylight");
const CLI = join(ROOT, "bin", "radar.mjs");
const cli = (args, env = {}) => spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", env: { ...process.env, ...env } });

test("the fixtures are what 3.8.0 wrote: old format ids and the old product name", () => {
  const md = readFileSync(join(SAVES, "x", "demo_alice_2026-10-25_harbour-sale.md"), "utf8");
  assert.match(md, /^---\nformat: "daylight\.sidecar\/1"/);
  assert.match(md, /Saved by Daylight Commons/, "the control: this note came from before the rename");
  const cap = JSON.parse(readFileSync(join(SAVES, "x", "demo_alice_2026-10-25_harbour-sale.capture.json"), "utf8"));
  assert.equal(cap.tool.name, "Daylight Commons");
  assert.equal(JSON.parse(readFileSync(join(FX, "bundle.signed.json"), "utf8")).tool, "Daylight Commons 3.8.0 (CLI)");
});

test("a 3.8.0 sidecar in Downloads/Daylight reads in sidecar check, the files check and board make", () => {
  const s = checkSidecars(SAVES);
  assert.equal(s.checked, 1);
  assert.deepEqual(s.flagged, []);
  // The files check also reads each file's modified time against the note's save time, and git does
  // not keep modified times: check a copy whose times are set back to the save.
  const copy = mkdtempSync(join(tmpdir(), "cmmns-v380-"));
  cpSync(SAVES, copy, { recursive: true });
  const saved = new Date("2026-10-26T12:00:00.000Z");
  for (const n of readdirSync(join(copy, "x"))) utimesSync(join(copy, "x", n), saved, saved);
  const f = checkFiles(copy);
  rmSync(copy, { recursive: true, force: true });
  assert.equal(f.notes, 1);
  assert.equal(f.ok, 1, JSON.stringify(f.flagged));
  const items = collect(SAVES);
  assert.equal(items.length, 1);
  assert.equal(items[0].sidecar.front.handle, "demo_alice");
  assert.equal(items[0].files.length, 1, "the board finds the saved file beside the note");
});

test("a 3.8.0 capture and its custody line verify with this build", async () => {
  const r = await verifyCaptures(SAVES);
  assert.equal(r.checked, 1);
  assert.deepEqual(r.problems, []);
  assert.equal(r.chain.ok, true);
  const out = cli(["capture", "verify", SAVES]);
  assert.equal(out.status, 0, out.stdout + out.stderr);
});

test("a 3.8.0 signed evidence bundle verifies, in code and from the cmmns command line", async () => {
  const bundle = JSON.parse(readFileSync(join(FX, "bundle.signed.json"), "utf8"));
  const r = await verifyBundle(bundle);
  assert.equal(r.ok, true, JSON.stringify(r.checks.filter((c) => !c.ok)));
  const out = cli(["verify", join(FX, "bundle.signed.json")]);
  assert.equal(out.status, 0, out.stdout + out.stderr);
  const edited = { ...bundle, tool: "CMMNS 3.8.0 (CLI)" };
  assert.equal((await verifyBundle(edited)).ok, false, "the old tool name is inside the signature; renaming it in a saved bundle must fail");
});

test("a 3.8.0 case export verifies with this build", () => {
  const dir = join(FX, "case-export-newsroom-v001");
  assert.equal(JSON.parse(readFileSync(join(dir, "export.json"), "utf8")).format, "daylight-case-export/1");
  const out = cli(["case", "verify-export", dir, "--case", FX]);
  assert.match(out.stdout, /Export verified: signed by key [0-9a-f]{16}, every file matches\./, out.stderr);
});

test("new records keep every format id; only the tool name a person reads changed", () => {
  assert.equal(CAPTURE_FORMAT, "daylight.capture/1");
  assert.equal(CUSTODY_FORMAT, "daylight.custody/1");
  assert.equal(captureRecord({ now: new Date(0) }).tool.name, "CMMNS");
  const files = readdirSync(join(ROOT, "schema"));
  for (const f of files) assert.doesNotMatch(JSON.parse(readFileSync(join(ROOT, "schema", f), "utf8")).$id || "", /cmmns/i, `${f} keeps its $id`);
});

test("CMMNS_ variables win over DAYLIGHT_ ones, and the old names still work alone", () => {
  assert.equal(envValue({ CMMNS_PROTECT: "0", DAYLIGHT_PROTECT: "1" }, "PROTECT"), "0");
  assert.equal(envValue({ DAYLIGHT_PROTECT: "1" }, "PROTECT"), "1");
  assert.equal(envValue({}, "PROTECT"), undefined);
  assert.equal(envSource({ DAYLIGHT_HOME: "/h" }, "HOME"), "DAYLIGHT_HOME");
  assert.equal(envSource({ CMMNS_HOME: "/h", DAYLIGHT_HOME: "/g" }, "HOME"), "CMMNS_HOME");
});

test("the cmmns command and the three older names run the same tool", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.name, "cmmns");
  for (const b of ["cmmns", "daylight", "daylight-commons", "radar"]) assert.equal(pkg.bin[b], "bin/radar.mjs", b);
  const help = cli(["--help"]);
  assert.match(help.stdout, /^ {2}cmmns analyze/m);
  assert.match(help.stdout, /formerly Daylight\s+Commons, and Radar before that/);
});
