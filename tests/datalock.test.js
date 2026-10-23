// The dataset lockfile (data/LOCK.json, scripts/data-lock.mjs) and the offline build
// (scripts/build-offline.mjs, scripts/offline-guard.mjs). A table that changes without its lock
// entry being refreshed fails here, so no data update can ship unreviewed.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, mkdirSync, copyFileSync, cpSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadLock, checkSnapshots, checkOutputs, stepReady, sha256File } from "../scripts/data-lock.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const lf = (s) => s.split("\r\n").join("\n");
const lock = loadLock();
const HEX = /^[0-9a-f]{64}$/;

test("every dataset names its source, retrieval date, licence and row count, and is pinned or says why not", () => {
  for (const [id, d] of Object.entries(lock.datasets)) {
    assert.ok(d.source && /^\d{4}-\d{2}-\d{2}$/.test(d.retrieved) && d.licence, id);
    assert.ok(Number.isInteger(d.rows.count) && d.rows.count > 0 && d.rows.unit, id);
    if (d.snapshot === null) { assert.equal(d.rawRetained, false, id); assert.ok(d.note, id); continue; }
    for (const [p, f] of Object.entries(d.snapshot.files)) {
      assert.match(f.sha256, HEX, `${id} ${p}`);
      assert.ok(f.bytes > 0, `${id} ${p}`);
      assert.equal(p.startsWith("$RADAR_DATA/"), !d.snapshot.committed, `${id}: committed snapshots live in the repository, others outside it`);
    }
    if (!d.snapshot.committed) assert.ok(d.snapshot.why && d.snapshot.refetch, `${id} says why it is not committed and how to fetch it`);
  }
});

test("every committed snapshot and every built table matches its locked hash", () => {
  const snaps = checkSnapshots(lock).filter((r) => !r.path.startsWith("$RADAR_DATA/"));
  assert.ok(snaps.length >= 10);
  assert.deepEqual(snaps.filter((r) => r.status !== "ok"), []);
  const outs = checkOutputs(lock);
  assert.deepEqual(outs.filter((r) => r.status !== "ok").map((r) => r.path), [], "a table changed: review it with scripts/upstream-guard.mjs, then `node scripts/data-lock.mjs refresh`");
});

test("every build step's inputs and outputs are in the lock, and every data builder has a step", () => {
  for (const b of lock.builds) {
    for (const id of b.inputs) assert.ok(lock.datasets[id], `${b.id} input ${id}`);
    for (const o of b.outputs) assert.ok(o in lock.outputs, `${b.id} output ${o}`);
  }
  const named = new Set(lock.builds.map((b) => b.script).filter(Boolean));
  for (const f of readdirSync(join(root, "scripts")).filter((x) => x.endsWith("-build.mjs"))) {
    const covered = named.has(`scripts/${f}`) || Object.values(lock.datasets).some((d) => d.source.includes(f) || (d.note || "").includes(f));
    assert.ok(covered, `scripts/${f} reads a dataset that data/LOCK.json does not list`);
  }
  assert.ok(Object.keys(lock.datasets["ops-sources"].snapshot.files).length === readdirSync(join(root, "data/ops-sources")).length, "every file in data/ops-sources is pinned");
});

test("snapshot checks: a changed committed file is a mismatch, a missing external one is only absent", () => {
  const dir = mkdtempSync(join(tmpdir(), "radar-lock-"));
  try {
    writeFileSync(join(dir, "raw.json"), "[1,2,3]");
    const want = sha256File(join(dir, "raw.json"));
    process.env.RADAR_DATA = dir;
    const fake = { datasets: {
      a: { snapshot: { committed: false, files: { "$RADAR_DATA/raw.json": { sha256: want } } } },
      b: { snapshot: { committed: false, files: { "$RADAR_DATA/raw.json": { sha256: "0".repeat(64) } } } },
      c: { snapshot: { committed: false, files: { "$RADAR_DATA/missing.json": { sha256: want } } } },
      d: { snapshot: { committed: true, files: { "data/does-not-exist.json": { sha256: want } } } },
    }, outputs: {} };
    const got = Object.fromEntries(checkSnapshots(fake).map((r) => [r.id, r.status]));
    assert.deepEqual(got, { a: "ok", b: "mismatch", c: "absent", d: "mismatch" });
    const r = checkSnapshots(fake);
    assert.equal(stepReady(fake, { inputs: ["a"] }, r), true);
    assert.equal(stepReady(fake, { inputs: ["a", "c"] }, r), false);
  } finally { delete process.env.RADAR_DATA; rmSync(dir, { recursive: true, force: true }); }
});

test("the offline guard blocks fetch, http, https and dns", () => {
  const script = "import https from 'node:https'; import dns from 'node:dns'; let n = 0;" +
    "for (const f of [() => fetch('https://example.org'), () => https.get('https://example.org'), () => dns.lookup('example.org', () => {})]) { try { await f(); } catch (e) { if (/blocked in the offline build/.test(e.message)) n++; } }" +
    "console.log(n);";
  const r = spawnSync(process.execPath, ["--import", pathToFileURL(join(root, "scripts/offline-guard.mjs")).href, "--input-type=module", "-e", script], { encoding: "utf8" });
  assert.equal(r.stdout.trim(), "3", r.stderr);
});

test("the offline build runs with the network blocked and reproduces every table it can rebuild", () => {
  // In a copy of the tree: the build rewrites tables and bundles, and other test files import them
  // in parallel, so rebuilding them in place could hand another test a half-written file.
  const copy = mkdtempSync(join(tmpdir(), "radar-offline-"));
  const data = mkdtempSync(join(tmpdir(), "radar-nodata-"));
  try {
    for (const d of ["data", "scripts", "src", "schema", "catalogue", "project-docs/evidence", "tests/fixtures", "package.json"]) cpSync(join(root, d), join(copy, d), { recursive: true });
    const script = join(copy, "scripts/build-offline.mjs");
    const r = spawnSync(process.execPath, [script], { cwd: copy, encoding: "utf8", env: { ...process.env, RADAR_DATA: data } });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /rebuilt {2}confusables/);
    assert.match(r.stdout, /rebuilt {2}ops/);
    assert.match(r.stdout, /skipped {2}claims/);
    for (const f of ["src/core/confusables-data.js", "data/ops.json", "src/ext/ops.json"]) assert.equal(lf(readFileSync(join(copy, f), "utf8")), lf(readFileSync(join(root, f), "utf8")), `${f} rebuilt differently`);
    const strict = spawnSync(process.execPath, [script, "--strict"], { cwd: copy, encoding: "utf8", env: { ...process.env, RADAR_DATA: data } });
    assert.equal(strict.status, 1, "--strict fails when a snapshot is missing");
  } finally {
    rmSync(copy, { recursive: true, force: true });
    rmSync(data, { recursive: true, force: true });
  }
});

test("a tampered committed snapshot stops the offline build before anything is rebuilt", () => {
  const dir = mkdtempSync(join(tmpdir(), "radar-tamper-"));
  try {
    const fake = JSON.parse(JSON.stringify(lock));
    fake.datasets["unicode-confusables"].snapshot.files["data/snapshots/unicode-confusables.txt"].sha256 = "f".repeat(64);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "LOCK.json"), JSON.stringify(fake));
    const r = spawnSync(process.execPath, [join(root, "scripts/build-offline.mjs")], { cwd: root, encoding: "utf8", env: { ...process.env, RADAR_LOCK: join(dir, "LOCK.json"), RADAR_DATA: dir } });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /a snapshot differs from data\/LOCK.json/);
    assert.doesNotMatch(r.stdout, /rebuilt/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("committed snapshots keep their exact bytes in git", () => {
  assert.match(readFileSync(join(root, ".gitattributes"), "utf8"), /^data\/snapshots\/\*\* -text$/m);
});
