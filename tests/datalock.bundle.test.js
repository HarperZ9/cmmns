// One identity for CMMNS' data tables: the hash an evidence bundle carries (dataLock), the
// per-table hashes in data/LOCK.json and the hashes the project key signs in
// src/ext/radar-data.pack.json all agree, so a bundle names exactly the locked, signed tables.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { dataLockOf, dataLockFromHashes } from "../src/core/evidence-bundle.js";
import { dataFiles, dataLock } from "../bin/lib/data.mjs";
import { loadLock } from "../scripts/data-lock.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pack = JSON.parse(readFileSync(join(root, "src/ext/radar-data.pack.json"), "utf8"));

test("the bundle's data hash is the hash of the lockfile's table hashes and of the signed pack's", async () => {
  const lock = loadLock(), names = dataFiles();
  const fromLock = Object.fromEntries(names.map((n) => [n, lock.outputs[`src/ext/${n}`]]));
  for (const n of names) assert.match(fromLock[n] || "", /^[0-9a-f]{64}$/, `data/LOCK.json pins src/ext/${n}`);
  assert.deepEqual(Object.keys(pack.manifest.files).sort(), names);
  const disk = await dataLock(), locked = await dataLockFromHashes(fromLock), signed = await dataLockFromHashes(pack.manifest.files);
  assert.equal(disk.value, locked.value);
  assert.equal(disk.value, signed.value);
});

test("CRLF and LF copies of a table give the same data hash", async () => {
  const lf = new TextEncoder().encode('{"rows":[1,\n2]}\n'), crlf = new TextEncoder().encode('{"rows":[1,\r\n2]}\r\n');
  assert.equal((await dataLockOf([["t.json", lf]])).value, (await dataLockOf([["t.json", crlf]])).value);
});
