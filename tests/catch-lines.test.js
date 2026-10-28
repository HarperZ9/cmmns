// The window's catch rate and tendency (families.js catchLines, src/ext/signals.js): plain words, the
// sign's own label named where it has one, a qualifier where it is general hostility, and nothing
// at all for a sign without a measured catch.
import test from "node:test";
import assert from "node:assert/strict";
import { catchLines } from "../src/core/families.js";

await import("../src/ext/core.bundle.js");
await import("../src/ext/signals.js");
const { PBSignals, PB } = globalThis;
const X = { id: "x", name: "X", hasLocation: true };
const row = (catchRow, precision = 0.9) => ({ violence: { precision, n: 40, catch: catchRow } });

test("the committed figures read in plain words", () => {
  assert.deepEqual(catchLines("violence"), { catches: "finds about 1 in 47 posts calling for violence in testing", tendency: "rarely fires; when it does, it is usually right" });
  assert.deepEqual(catchLines("dehumanise"), { catches: "finds about 1 in 420 dehumanising posts in testing", tendency: "rarely fires; when it does, it is usually right" });
  assert.deepEqual(catchLines("slur"), { catches: "finds about 1 in 6 hostile posts in testing (measured against general hostility)", tendency: "fires sparingly; when it does, it is usually right" });
  assert.equal(catchLines("stereotype").catches, "finds about 1 in 140 posts stereotyping a group in testing");
});

test("general hostility is named, and a large share reads per 100", () => {
  assert.equal(catchLines("violence", row({ against: "hostile", hits: 1, of: 50, c: 3 })).catches, "finds about 1 in 50 hostile posts in testing (measured against general hostility)");
  assert.equal(catchLines("violence", row({ against: "matched", hits: 47, of: 100, c: 0.7 })).catches, "finds about 47 in 100 posts calling for violence in testing");
});

test("the tendency follows bias c and the precision shown above it", () => {
  const t = (c, p) => catchLines("violence", row({ against: "matched", hits: 1, of: 50, c }, p)).tendency;
  assert.equal(t(3, 0.9), "rarely fires; when it does, it is usually right");
  assert.equal(t(1.5, 0.7), "fires sparingly; when it does, it is right more often than not");
  assert.equal(t(0.5, 0.5), "fires readily; when it does, it is often wrong");
  assert.equal(t(-0.2, 0.9), "fires freely; when it does, it is usually right");
});

test("no catch, no hits or a broken row gives no line", () => {
  assert.equal(catchLines("vigilante"), null);
  assert.equal(catchLines("mismatch"), null);
  assert.equal(catchLines("violence", { violence: { precision: 0.9, n: 40 } }), null);
  assert.equal(catchLines("violence", row({ against: "matched", hits: 0, of: 50, c: 3 })), null);
  assert.equal(catchLines("violence", row({ against: "matched", hits: 60, of: 50, c: 3 })), null);
  assert.equal(catchLines("violence", { violence: { precision: 0.9, catch: { against: "matched", hits: 1, of: 50, c: 3 } } }), null, "a row without n is not a measurement");
});

test("the window puts Catch rate and Tendency right under Measured", () => {
  const sig = PBSignals.all({ site: X, handle: "a", markers: PB.score("Migrants are vermin").markers, machine: {}, flags: [] });
  const s = sig.find((x) => x.label === "dehumanising language");
  const heads = s.rows.map(([h]) => h), at = heads.indexOf("Measured");
  assert.deepEqual(heads.slice(at, at + 3), ["Measured", "Catch rate", "Tendency"]);
  assert.equal(s.rows[at + 1][1], "finds about 1 in 420 dehumanising posts in testing");
  assert.equal(s.rows[at + 2][1], "rarely fires; when it does, it is usually right");
});

test("a sign without a measured catch keeps only its Measured row", () => {
  const sig = PBSignals.all({ site: X, handle: "a", markers: [], machine: {}, flags: [{ id: "new-account", evidence: "e", doesNotProve: "d" }] });
  for (const s of sig) assert.ok(!s.rows.some(([h]) => h === "Catch rate" || h === "Tendency"), s.label);
});

test("the wording carries no em dashes", () => {
  for (const f of ["violence", "dehumanise", "slur", "stereotype"]) assert.doesNotMatch(Object.values(catchLines(f)).join(" "), /—/);
});
