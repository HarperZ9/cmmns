// Property: Daylight Commons' verdict is never more favourable than the reference checker's (c2patool) on any
// c2pa-rs test fixture. The fixtures are not committed; CI fetches them at a pinned commit (the
// c2pa-reference job) and sets C2PA_FIXTURES. Without it this test is skipped, not passed.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { readCredentials, credentialState } from "../src/core/c2pa.js";
import { outcomeOf } from "../src/core/survival.js";

const ref = JSON.parse(readFileSync(new URL("./fixtures/c2pa-reference.json", import.meta.url), "utf8"));
const dir = process.env.C2PA_FIXTURES;

test("the reference table covers the files and both verdict kinds", () => {
  const v = Object.values(ref.files).map((x) => x.verdict);
  assert.ok(v.length >= 40);
  for (const k of ["pass", "fail", "none"]) assert.ok(v.includes(k), k);
  assert.equal(ref.files["legacy.mp4"].verdict, "fail");
});

test("never more favourable than c2patool on any c2pa-rs fixture", { skip: dir ? false : "set C2PA_FIXTURES to the c2pa-rs sdk/tests/fixtures folder" }, async () => {
  const worse = [];
  for (const [name, r] of Object.entries(ref.files)) {
    const p = join(dir, name);
    assert.ok(existsSync(p), `missing fixture ${name}`);
    const state = credentialState(await readCredentials(new Uint8Array(readFileSync(p))));
    // Only "unchanged" is a favourable verdict. It needs a reference pass.
    if (state === "unchanged" && r.verdict !== "pass") worse.push(`${name}: radar unchanged, c2patool ${r.verdict}`);
    // A file the reference finds no manifest in must not gain one in Daylight Commons.
    if (r.verdict === "none" && state !== "none") worse.push(`${name}: radar ${state}, c2patool none`);
  }
  assert.deepEqual(worse, []);
});

// The feed page's survival count (src/core/survival.js) sorts each checked file by whether its
// credentials survived. On the fixtures, "present" (intact, partly checked, changed or stored
// online) must agree with c2patool finding a manifest, "intact" needs a reference pass, and the one
// known miss stays the only one: a manifest c2patool finds in a deeply nested MP4 box that Daylight Commons
// does not reach, which the count would show as "none found".
test("the survival count agrees with c2patool on which fixtures still carry credentials", { skip: dir ? false : "set C2PA_FIXTURES to the c2pa-rs sdk/tests/fixtures folder" }, async () => {
  const misses = [], table = {};
  for (const [name, r] of Object.entries(ref.files)) {
    const o = outcomeOf(await readCredentials(new Uint8Array(readFileSync(join(dir, name)))));
    table[o] = (table[o] || 0) + 1;
    if (o === "intact") assert.equal(r.verdict, "pass", `${name}: counted intact, c2patool ${r.verdict}`);
    if ((o !== "none") !== (r.verdict !== "none")) misses.push(name);
  }
  assert.deepEqual(misses, ["nested_moov_1000.mp4"]);
  // Measured on the pinned fixtures, 2026-10-21: 13 intact, 3 partly checked, 5 changed, 3 online, 19 none.
  assert.deepEqual(table, { none: 19, intact: 13, changed: 5, remote: 3, partial: 3 });
});
