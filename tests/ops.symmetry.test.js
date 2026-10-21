// The symmetry rule for documented operations: one evidence threshold for every country. The rule
// code names no country, relabelling an operation's country never changes whether it passes or
// what the window says beyond the country's name, and the same weak record fails for every country.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { opProblems } from "../src/core/ops-schema.js";
import { loadSources } from "../scripts/ops-build.mjs";
import { setOpsTable, opsOfDomain, opRows } from "../src/core/ops.js";

const ROOT = join(import.meta.dirname, "..");
const ops = loadSources();
const shipped = JSON.parse(readFileSync(join(ROOT, "data/ops.json"), "utf8"));
const COUNTRIES = [...new Set(ops.map((o) => o.state))];

test("the rule and matcher code names no country", () => {
  for (const f of ["src/core/ops-schema.js", "src/core/ops.js", "scripts/ops-build.mjs", "scripts/site/ops-trend.mjs"]) {
    const src = readFileSync(join(ROOT, f), "utf8");
    for (const c of COUNTRIES) assert.ok(!new RegExp(`\b${c}\b`).test(src), `${f} names ${c}`);
  }
});

test("relabelling an operation's country never changes whether it meets the bar", () => {
  for (const o of ops) {
    const base = opProblems(o).length;
    for (const c of COUNTRIES) assert.equal(opProblems({ ...o, state: c }).length, base, `${o.id} as ${c}`);
  }
});

test("a record without a read source, or with an operator type no source states, fails for every country", () => {
  const good = ops[0];
  const unread = { ...good, sources: good.sources.map((s) => ({ ...s, checked: "not fetched: test" })) };
  const upgraded = { ...good, operatorType: good.attributions.some((a) => a.operatorType === "government") ? "commercial firm" : "government" };
  const uncited = { ...good, cite: {} };
  for (const c of COUNTRIES) {
    assert.ok(opProblems({ ...unread, state: c }).some((p) => /source that was read/.test(p)), c);
    assert.ok(opProblems({ ...upgraded, state: c }).some((p) => /operatorType is not one/.test(p)), c);
    assert.ok(opProblems({ ...uncited, state: c }).some((p) => /no cited source/.test(p)), c);
  }
});

test("the window's rows differ only by the country's name when the country is relabelled", () => {
  const d = shipped.indicators.find((i) => i.d).d;
  setOpsTable(shipped);
  // The country appears once, at the start of "Attributed to"; every other row is the sources' text.
  const strip = (rows) => rows.map(([k, v]) => [k, k === "Attributed to" ? v.replace(/^[^:]+: /, "") : v]);
  const rows = strip(opRows(opsOfDomain(d)[0]));
  for (const c of COUNTRIES) {
    setOpsTable({ ...shipped, ops: shipped.ops.map((o) => ({ ...o, state: c })) });
    const other = opRows(opsOfDomain(d)[0]);
    assert.ok(other.find(([k]) => k === "Attributed to")[1].startsWith(c + ": "), c);
    assert.deepEqual(strip(other), rows, c);
  }
  setOpsTable(shipped);
});

test("every attributed country's operations carry the same fields at the same rate of citation", () => {
  // Every filled field is cited, for every country (the schema enforces it); this checks the built file too.
  for (const o of shipped.ops) for (const f of ["platforms", "languages", "targets", "techniques"]) {
    if (o[f].length) assert.ok(o.cite[f] && o.cite[f].length, `${o.id} ${f}`);
  }
});
