// The personalities table (src/ext/personalities.json, scripts/personalities-build.mjs): it fits its
// schema, every row has a source with a checked quote, no private field appears anywhere, CMMNS' own
// words carry no loaded label and no association-as-backing, and a rebuild gives the same table.
// Each lint has a control that shows it fails what it should.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validate } from "../bin/lib/jsonschema.mjs";
import { loadInputs, inputProblems, buildTable, applyCorrection } from "../scripts/personalities-build.mjs";
import { personProblems, rowProblems, privateKeys, statusAllowed, confidenceOf, shippable, LOADED } from "../src/core/personalities-schema.js";

const ROOT = join(import.meta.dirname, "..");
const schema = JSON.parse(readFileSync(join(ROOT, "schema/personalities.v1.json"), "utf8"));
const table = JSON.parse(readFileSync(join(ROOT, "src/ext/personalities.json"), "utf8"));
const inputs = loadInputs();
const good = inputs.people.find((p) => p.backing.length);
const goodRow = good.backing[0];

test("the shipped table fits schema/personalities.v1.json", () => {
  assert.deepEqual(validate(schema, table), []);
  assert.ok(table.people.length >= 40, `${table.people.length} people`);
  for (const p of table.people) for (const [platform] of p.accounts) assert.ok(["x", "youtube", "tiktok", "instagram", "facebook", "bluesky", "threads"].includes(platform), p.id);
});

test("control: the schema rejects a row with no source, an unknown kind and a side field", () => {
  const p = table.people[0];
  const bad = { ...table, people: [{ ...p, lean: "right", rows: [{ ...p.rows[0], kind: "propaganda", sources: [] }] }] };
  const errs = validate(schema, bad).join("\n");
  assert.match(errs, /unexpected lean/);
  assert.match(errs, /fewer than 1 items/);
  assert.match(errs, /is not one of/);
});

test("every source record passes the rule, and the build would run", () => {
  assert.deepEqual(inputProblems(inputs), []);
});

test("source-required lint: every shipped row has a source with a quote the quote check found", () => {
  for (const p of table.people) for (const r of p.rows) {
    assert.ok(r.sources.length >= 1, `${p.id}: ${r.kind}`);
    for (const s of r.sources) {
      assert.ok(s.quote && s.quote.trim().length >= 2, `${p.id}: ${s.url}`);
      assert.match(s.check, /^(exact|loose)$/);
      assert.match(s.read, /^\d{4}-\d{2}-\d{2}$/);
      assert.match(s.url, /^https:\/\//);
    }
  }
});

test("control: the source lint fails a row without a quote and a row without sources", () => {
  const noQuote = { ...goodRow, sources: [{ ...goodRow.sources[0], quote: "" }] };
  assert.ok(rowProblems(noQuote, "t").some((x) => /no quote/.test(x)));
  assert.ok(rowProblems({ ...goodRow, sources: [] }, "t").some((x) => /no source/.test(x)));
  assert.equal(shippable(goodRow, goodRow.sources.map(() => "not-found")), false, "a row whose quotes were not found does not ship");
  const onFiling = { sources: [{ kind: "filing", url: "https://f.example" }, { kind: "press", url: "https://p.example" }] };
  assert.equal(shippable(onFiling, ["unreadable", "exact"]), false, "a row whose filing was not confirmed is held back");
  assert.equal(shippable(onFiling, ["exact", "unreadable"]), true);
});

test("no-private-fields lint: no person, row or source carries a private field", () => {
  for (const p of [...inputs.people, ...table.people]) assert.deepEqual(privateKeys(p), [], p.id);
  const blob = JSON.stringify(table);
  assert.doesNotMatch(blob, /"(address|phone|email|salary|netWorth|spouse|children|birthdate|dob)"\s*:/i);
});

test("control: the private-field lint catches nested private fields", () => {
  const bad = { ...good, accounts: [{ platform: "x", handle: "a", phone: "1" }], backing: [{ ...goodRow, home: "x" }] };
  assert.deepEqual(privateKeys(bad).sort(), ["accounts.0.phone", "backing.0.home"]);
  assert.ok(personProblems(bad).some((x) => /private field/.test(x)));
});

test("CMMNS' own words carry no loaded label and no association-as-backing; amounts only where a filing is the backing", () => {
  for (const p of table.people) {
    assert.doesNotMatch(p.role, LOADED, p.id);
    for (const r of p.rows) for (const k of ["who", "summary", "doesNotProve"]) assert.doesNotMatch(r[k], LOADED, `${p.id} ${k}`);
    for (const r of p.rows) for (const s of r.sources) assert.doesNotMatch(s.quote, LOADED, `${p.id} quote`);
  }
  assert.ok(rowProblems({ ...goodRow, summary: "The host appeared on a show and met with a donor." }, "t").some((x) => /association/.test(x)));
  assert.ok(rowProblems({ ...goodRow, kind: "employer", summary: "Reports say the host was paid $5 million a year by the network." }, "t").some((x) => /amount/.test(x)));
  assert.ok(rowProblems({ ...goodRow, summary: "The outlet is a propaganda arm of a party, sources say." }, "t").some((x) => /never uses/.test(x)));
});

test("status: a court record is only ever an allegation, and documented needs a primary source", () => {
  assert.deepEqual(statusAllowed({ kind: "court record", sources: [{ kind: "court" }] }), ["alleged"]);
  assert.ok(!statusAllowed({ kind: "employer", sources: [{ kind: "press" }] }).includes("documented"));
  for (const p of table.people) for (const r of p.rows) {
    if (r.kind === "court record") assert.equal(r.status, "alleged", p.id);
    if (r.status === "documented") assert.ok(r.sources.some((s) => ["self", "company", "court", "government", "filing", "platform"].includes(s.kind)), p.id);
  }
});

test("confidence comes from the sources alone", () => {
  const press = (h) => ({ kind: "press", url: `https://${h}/a` });
  assert.equal(confidenceOf({ sources: [press("a.example"), press("b.example")] }, ["exact", "loose"]), "moderate");
  assert.equal(confidenceOf({ sources: [press("a.example"), press("a.example")] }, ["exact", "exact"]), "low");
  assert.equal(confidenceOf({ sources: [{ kind: "filing", url: "https://c.example" }] }, ["exact"]), "high");
});

test("a rebuild gives the shipped table byte for byte", () => {
  assert.deepEqual(buildTable(inputs, table.built).table, table);
});

test("the corrections path: a retraction removes a row and an amendment is credited", () => {
  const c = { person: good.id, row: goodRow.id, source: "https://example.org/filing", checked: "2026-10-21", reason: "test" };
  assert.equal(applyCorrection(goodRow, { ...c, action: "retract" }), null);
  const amended = applyCorrection(goodRow, { ...c, action: "amend", set: { period: "until 2026" } });
  assert.equal(amended.period, "until 2026");
  assert.equal(amended.correction.source, c.source);
  const before = buildTable(inputs, table.built).table.people.find((p) => p.id === good.id);
  const after = buildTable({ ...inputs, corrections: [{ ...c, action: "retract" }] }, table.built).table.people.find((p) => p.id === good.id);
  assert.equal((after ? after.rows.length : 0), before.rows.length - 1);
  const corr = JSON.parse(readFileSync(join(ROOT, "data/owner-corrections.json"), "utf8"));
  assert.ok(Array.isArray(corr.personalities) && /retract/.test(corr.personalitiesAbout));
});

test("leads, research notes and balance labels never ship", () => {
  const blob = JSON.stringify(table);
  assert.doesNotMatch(blob, /"leads"|"lean"|"balance"|"batch"|"selection"|"audience"/);
  for (const p of inputs.people) for (const l of p.leads) assert.ok(!blob.includes(JSON.stringify(l.claim)), `${p.id}: a lead reached the table`);
});
