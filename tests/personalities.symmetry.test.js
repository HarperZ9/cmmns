// The symmetry rule for documented backing: one standard for every person, whatever their side,
// country or outlet. The rule, build and matcher code name no person, outlet or side; relabelling a
// person changes nothing but the name shown; everyone at the same outlet gets the same outlet rows;
// every record shows at the same level; and the balance labels are never an input.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadInputs, buildTable } from "../scripts/personalities-build.mjs";
import { personProblems } from "../src/core/personalities-schema.js";
import { setBackingTable, backingOf, backingRows, backingLabel } from "../src/core/backing.js";

const ROOT = join(import.meta.dirname, "..");
const read = (f) => readFileSync(join(ROOT, f), "utf8");
const inputs = loadInputs();
const table = JSON.parse(read("src/ext/personalities.json"));
const balance = JSON.parse(read("data/personalities-sources/balance.json"));
const CODE = ["src/core/personalities-schema.js", "src/core/backing.js", "scripts/personalities-build.mjs"];

test("the rule, build and matcher code name no person, outlet or side, and never read the balance labels", () => {
  const names = [...inputs.people.map((p) => p.name), ...inputs.outlets.map((o) => o.name)].filter((n) => n.length > 3);
  for (const f of CODE) {
    const src = read(f);
    for (const n of names) assert.ok(!src.includes(n), `${f} names ${n}`);
    for (const side of new Set(Object.values(balance.lean))) assert.ok(!src.includes(`"${side}"`), `${f} names the side "${side}"`);
    assert.doesNotMatch(src, /balance\.json|\.lean\b/, `${f} reads the balance labels`);
  }
});

test("every person was researched against the same rule; the balance file covers everyone and ships nowhere", () => {
  assert.deepEqual(Object.keys(balance.lean).sort(), inputs.people.map((p) => p.id).sort());
  for (const f of ["src/ext/manifest.json", "scripts/pack.mjs", "scripts/build.mjs"]) assert.doesNotMatch(read(f), /balance/);
});

test("relabelling a person's name, country or role never changes whether the record passes", () => {
  for (const p of inputs.people) {
    const base = personProblems(p).length;
    for (const v of [{ name: "Person A" }, { country: "Elsewhere" }, { role: "commentator" }, { name: "Person B", country: "Another country" }]) {
      assert.equal(personProblems({ ...p, ...v }).length, base, `${p.id} ${JSON.stringify(v)}`);
    }
  }
});

test("the window's rows differ only by the name and role when a person is relabelled", () => {
  setBackingTable(table);
  for (const p of table.people.slice(0, 30)) {
    const other = { ...p, name: "Person A", role: "a public commentator", country: "Elsewhere" };
    // Only the header row names the person; every record row is the same text.
    assert.deepEqual(backingRows(other).slice(1), backingRows(p).slice(1), p.id);
    assert.match(backingRows(other)[0][1], /^Person A, a public commentator./);
    assert.equal(backingLabel(other), backingLabel(p));
  }
});

test("everyone whose current employer is the same outlet gets the same outlet rows", () => {
  const by = new Map();
  for (const p of inputs.people) for (const r of p.backing.filter((x) => x.outlet && x.current)) {
    const shipped = table.people.find((t) => t.id === p.id);
    const rows = shipped ? shipped.rows.filter((x) => x.via).map((x) => JSON.stringify(x)).sort() : [];
    if (!by.has(r.outlet)) by.set(r.outlet, []);
    by.get(r.outlet).push([p.id, JSON.stringify(rows.filter((x) => x.includes(`"via":"${inputs.outlets.find((o) => o.id === r.outlet).name}"`)))]);
  }
  for (const [outlet, list] of by) for (const [id, rows] of list) assert.equal(rows, list[0][1], `${outlet}: ${id} differs from ${list[0][0]}`);
  assert.ok([...by.values()].some((l) => l.length >= 4), "at least one outlet has four or more current people");
});

test("a rebuild with every balance label swapped gives the same table", () => {
  const swapped = { ...inputs, people: inputs.people.map((p) => ({ ...p, lean: "swapped" })) };
  assert.deepEqual(buildTable(swapped, table.built).table, table);
});

test("every record shows at the same level, whatever its kind or person", () => {
  const src = read("src/ext/signals.js");
  const fn = src.slice(src.indexOf("function backing("), src.indexOf("function backing(") + 400);
  assert.match(fn, /level: "info"/);
  assert.doesNotMatch(fn, /warn|flag"/);
  setBackingTable(table);
  for (const p of table.people) for (const [site, h] of p.accounts) assert.equal(backingOf(site, h).id, p.id);
});
