// What a data pack may add (src/core/packs-content.js) and how it joins Daylight Commons' tables: pack rows
// carry their pack's name, pack operations never merge into Daylight Commons' own or into the trend counts.
import test from "node:test";
import assert from "node:assert/strict";
import { validatePackContent, packSummary, mergePackClaims, mergePackOps, setPackNotes, siteNotesOf, PACK_INDICATOR_KINDS, PACK_OPERATOR_TYPES } from "../src/core/packs-content.js";
import { INDICATOR_KINDS, OPERATOR_TYPES } from "../src/core/ops-schema.js";
import { opsTrend, setOpsTable, opsOfDomain } from "../src/core/ops.js";
import { siteInfoRows, PACK_NOTE_CAVEAT } from "../src/core/sites.js";

const claim = { claim: "The bridge closed for good in March 2026.", rating: "False", checker: "Example Checks", url: "https://checks.example.org/bridge", date: "2026-03-04" };
const op = { domain: "fake-news.example", kind: "cloned news domain", operation: { id: "op-a", name: "Operation A", state: "Country A", operator: "Agency A", operatorType: "government" }, source: { publisher: "Lab", title: "Report on Operation A", url: "https://lab.example.org/a.pdf", date: "2025-05-01" } };
const note = { domain: "example.com", note: "Founded in 2024 — per the registry.", url: "https://registry.example.org/example.com" };

test("the pack's lists of kinds and operator types match the evidence rules", () => {
  assert.deepEqual(PACK_INDICATOR_KINDS, INDICATOR_KINDS);
  assert.deepEqual(PACK_OPERATOR_TYPES, OPERATOR_TYPES);
});

test("valid content passes; every rule names the row and the problem", () => {
  assert.deepEqual(validatePackContent({ claims: [claim], ops: [op], siteNotes: [note] }), []);
  const bad = validatePackContent({
    claims: [{ ...claim, url: "http://insecure.example.org" }, { ...claim, claim: "short" }],
    ops: [{ ...op, kind: "bot farm" }, { ...op, domain: "Not A Domain" }],
    siteNotes: [{ ...note, url: "" }],
    extra: [],
  });
  assert.ok(bad.includes("claims[0]: url must be an https address"));
  assert.ok(bad.includes("claims[1]: claim must be 12 to 600 characters"));
  assert.ok(bad.some((p) => p.startsWith("ops[0]: kind must be one of")));
  assert.ok(bad.includes("ops[1]: needs a lower-case domain or an account handle"));
  assert.ok(bad.includes("siteNotes[0]: url must be an https address for the note's source"));
  assert.ok(bad.includes('unknown content part "extra"'));
  assert.deepEqual(validatePackContent(null), ["content is missing"]);
  assert.match(validatePackContent({ claims: "x" })[0], /must be a list/);
});

test("the summary says what a pack adds", () => {
  assert.equal(packSummary({ claims: [claim, claim], siteNotes: [note] }), "2 fact-checked claims, 1 site note");
  assert.equal(packSummary({}), "nothing");
});

test("pack claims join the claims table under their pack's name", () => {
  const table = { checkers: ["Checker One"], rows: [["An older claim about something", "False", 0, "https://one.example.org/x", "2025-01-01", "en", null]] };
  const out = mergePackClaims(table, [{ name: "Pack P", content: { claims: [claim, { ...claim, url: "https://checks.example.org/two" }] } }]);
  assert.equal(out.rows.length, 3);
  assert.deepEqual(out.checkers, ["Checker One", "Example Checks (pack: Pack P)"]);
  assert.equal(out.rows[1][2], 1);
  assert.equal(out.rows[2][2], 1);
  assert.equal(table.rows.length, 1, "the bundled table is not changed in place");
});

test("pack operations are matched but never counted in the trend", () => {
  const own = { docs: [{ title: "Own report", url: "https://r.example.org", date: "2020-01-01" }], ops: [{ id: "own", name: "Own op", state: "Country B", operator: "B", operatorType: "government", attributions: [], docs: [0], first: "2020-01-01" }], indicators: [{ d: "own.example", op: "own", kind: "operation site", doc: 0 }] };
  const merged = mergePackOps(own, [{ name: "Pack P", keyId: "abcdef0123456789", content: { ops: [op, { ...op, domain: "second.example" }] } }]);
  assert.equal(merged.ops.length, 2);
  const packOp = merged.ops[1];
  assert.equal(packOp.id, "pack:abcdef01:op-a");
  assert.equal(packOp.pack, "Pack P");
  assert.equal(packOp.attributions.length, 2);
  assert.equal(opsTrend(merged).total, 1);
  setOpsTable(merged);
  assert.equal(opsOfDomain("www.fake-news.example")[0].op.pack, "Pack P");
  assert.equal(opsOfDomain("own.example")[0].op.id, "own");
  setOpsTable({ docs: [], ops: [], indicators: [] });
});

test("site notes are found for the domain and its subdomains, cleaned of em dashes, and shown apart", () => {
  setPackNotes([{ name: "Pack P", content: { siteNotes: [note] } }]);
  const got = siteNotesOf("www.news.example.com");
  assert.equal(got.length, 1);
  assert.equal(got[0].note, "Founded in 2024 - per the registry.");
  assert.deepEqual(siteNotesOf("other.org"), []);
  const rows = siteInfoRows({ domain: "example.com", state: [], notes: got });
  assert.ok(rows.some(([h, v]) => h === "Pack note" && v === "Founded in 2024 - per the registry. (pack: Pack P)"));
  assert.ok(rows.some(([, v]) => v && v.note === PACK_NOTE_CAVEAT));
  assert.ok(!siteInfoRows({ domain: "x.org", state: [] }).some(([h]) => h === "Pack note"));
  setPackNotes([]);
});
