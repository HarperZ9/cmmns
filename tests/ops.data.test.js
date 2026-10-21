// The influence-operations table (data/ops.json, built by scripts/ops-build.mjs from
// data/ops-sources): every record meets the evidence rules, the shipped files match a fresh build,
// the file stays under its size cap, and real outlets are never shipped as operation indicators.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { build, loadSources, MAX_BYTES } from "../scripts/ops-build.mjs";
import { opProblems } from "../src/core/ops-schema.js";
import { OUTLETS } from "../src/core/lookalike-outlets.js";

const ROOT = join(import.meta.dirname, "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const shipped = JSON.parse(read("data/ops.json"));
const links = JSON.parse(read("data/ops-sources/joins.json"));

test("every operation record meets the evidence rules", () => {
  assert.deepEqual(loadSources().flatMap(opProblems), []);
});

test("data/ops.json and the extension's copy match a fresh build and stay under the cap", () => {
  const fresh = build({ built: shipped.built });
  assert.deepEqual(shipped, JSON.parse(JSON.stringify(fresh)), "run node scripts/ops-build.mjs");
  assert.equal(read("src/ext/ops.json"), read("data/ops.json"));
  assert.ok(Buffer.byteLength(read("data/ops.json")) <= MAX_BYTES, `over ${MAX_BYTES} bytes`);
});

test("every indicator points at an operation and a document, and every operation cites documents", () => {
  const ids = new Set(shipped.ops.map((o) => o.id));
  for (const i of shipped.indicators) {
    assert.ok(ids.has(i.op), i.op);
    assert.ok(shipped.docs[i.doc] && /^https:/.test(shipped.docs[i.doc].url), `${i.d || i.x}: document`);
  }
  for (const o of shipped.ops) {
    assert.ok(o.docs.length && o.docs.every((d) => shipped.docs[d]), o.id);
    assert.ok(o.attributions.every((a) => shipped.docs[a.doc]), o.id);
  }
});

test("no listed outlet's own domain is shipped as an operation indicator", () => {
  const own = OUTLETS.flatMap((o) => o.domains);
  const hits = shipped.indicators.filter((i) => i.d && own.some((d) => i.d === d || i.d.endsWith("." + d)));
  assert.deepEqual(hits, []);
});

test("no domain in the outlet-owner table is an indicator, except fronts a source names as such", () => {
  const owners = new Set(JSON.parse(read("src/ext/owners.json")).rows.map((r) => r.domain));
  const fronts = new Set(links.realOutletFronts.map((f) => f.domain));
  const hits = [...new Set(shipped.indicators.filter((i) => i.d && owners.has(i.d) && !fronts.has(i.d)).map((i) => i.d))];
  assert.deepEqual(hits, [], "a real outlet would be labelled as an operation's asset");
  for (const e of links.exclude) assert.ok(!shipped.indicators.some((i) => i.d === e.domain), e.domain);
});

test("accounts shipped are operation accounts, never targets or fake people's names", () => {
  for (const i of shipped.indicators.filter((x) => x.x)) assert.equal(i.kind, "operation account", i.x);
  // The persona-heavy operations ship no handles at all (data/ops.README.md).
  for (const op of ["spamouflage-dragonbridge", "operation-overload", "meta-h1-2026-iran-us-personas", "meta-h2-2026-iran-africa"]) {
    assert.ok(!shipped.indicators.some((i) => i.x && i.op === op), op);
  }
});

test("attribution quotes stay short, and no shipped text has an em dash", () => {
  for (const o of shipped.ops) for (const a of o.attributions) assert.ok(a.says.split(/\s+/).length <= 25, o.id);
  assert.ok(!read("data/ops.json").includes("\u2014"));
});
