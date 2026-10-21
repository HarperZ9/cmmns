// The fact-check table ships in parts, because the Firefox add-on linter will not read a file over
// 5 MB. Splitting and joining must give back the same table, row for row.
import test from "node:test";
import assert from "node:assert/strict";
import { splitClaims, joinClaims, CLAIMS_PART_MAX } from "../src/core/claims-parts.js";

const table = { built: "2026-10-21", source: { name: "s" }, fields: ["claim"], checkers: ["a"], rows: Array.from({ length: 500 }, (_, i) => ["claim number " + i, "False", 0, "https://x/" + i, null, "en"]) };

test("a small table stays one file with no parts", () => {
  const [main, ...rest] = splitClaims(table);
  assert.equal(rest.length, 0);
  assert.equal(main.parts, undefined);
  assert.deepEqual(main, table);
});

test("a large table splits under the byte cap and joins back unchanged", () => {
  const files = splitClaims(table, 4000);
  assert.ok(files.length > 2);
  for (const f of files) assert.ok(Buffer.byteLength(JSON.stringify(f)) <= 4000 + 200);
  const [main, ...parts] = files;
  assert.deepEqual(main.parts, parts.map((_, i) => `claims-${i + 2}.json`));
  assert.deepEqual(joinClaims(main, parts), table);
});

test("the default cap sits under the linter's 5 MB limit", () => {
  assert.ok(CLAIMS_PART_MAX < 5 * 1024 * 1024 && CLAIMS_PART_MAX < 5000000);
});
