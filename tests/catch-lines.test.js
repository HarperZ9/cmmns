// The window's catch rate and tendency (families.js catchLines, src/ext/signals.js): plain words, the
// sign's own label named where it has one, a qualifier where it is general hostility, and nothing
// at all for a sign without a measured catch.
import test from "node:test";
import assert from "node:assert/strict";
import { catchLines, measuredLine } from "../src/core/families.js";

await import("../src/ext/core.bundle.js");
await import("../src/ext/signals.js");
const { PBSignals, PB } = globalThis;
const X = { id: "x", name: "X", hasLocation: true };
const row = (catchRow, precision = 0.9) => ({ violence: { precision, n: 40, catch: catchRow } });

const D = "d' 0.44 (0.15 to 0.75); 0 is chance, 2 is good";
test("the committed figures read in plain words, on the test set the Measured line names", () => {
  assert.deepEqual(catchLines("dehumanise"), { catches: "finds about 1 in 420 dehumanising posts in testing", sensitivity: D, tendency: "rarely fires; when it does, it is right more often than not" });
  assert.deepEqual(catchLines("violence"), { catches: "finds about 1 in 47 posts calling for violence in testing", sensitivity: "d' 1.00 (0.82 to 1.20); 0 is chance, 2 is good", tendency: "rarely fires; when it does, it is right more often than not" });
  assert.deepEqual(catchLines("slur"), { catches: "finds about 1 in 11 hostile posts in testing", sensitivity: "d' 1.10 (1.01 to 1.21); 0 is chance, 2 is good", tendency: "fires sparingly; when it does, it is usually right" });
  assert.equal(measuredLine("dehumanise").text, "precision 60% (95% interval 39 to 78%), 20 badges checked; measured on Measuring Hate Speech, against its own dehumanising label, held-out test set");
  assert.match(measuredLine("slur").text, /; measured on Measuring Hate Speech, against general hostility, held-out test set$/);
});

const ok = { measured: true, dprime: 0.5, dCI: [0.1, 0.9] };
test("a large share reads per 100, and a negative d' keeps its sign", () => {
  assert.equal(catchLines("violence", row({ ...ok, against: "hostile", hits: 1, of: 50, c: 3 })).catches, "finds about 1 in 50 hostile posts in testing");
  assert.equal(catchLines("violence", row({ ...ok, against: "matched", hits: 47, of: 100, c: 0.7 })).catches, "finds about 47 in 100 posts calling for violence in testing");
  assert.equal(catchLines("violence", row({ ...ok, dprime: -0.22, dCI: [-0.77, -0.01], against: "hostile", hits: 3, of: 3979, c: 3 })).sensitivity, "d' −0.22 (−0.77 to −0.01); 0 is chance, 2 is good");
});

test("the tendency follows bias c and the precision shown above it", () => {
  const t = (c, p) => catchLines("violence", row({ ...ok, against: "matched", hits: 1, of: 50, c }, p)).tendency;
  assert.equal(t(3, 0.9), "rarely fires; when it does, it is usually right");
  assert.equal(t(1.5, 0.7), "fires sparingly; when it does, it is right more often than not");
  assert.equal(t(0.5, 0.5), "fires readily; when it does, it is often wrong");
  assert.equal(t(-0.2, 0.9), "fires freely; when it does, it is usually right");
});

test("under the 20-hit rule, sensitivity and tendency read not measured", () => {
  const x = catchLines("violence", row({ ...ok, measured: false, against: "matched", hits: 3, of: 50, c: 3 }));
  assert.deepEqual([x.sensitivity, x.tendency], ["not measured", "not measured"]);
  assert.equal(x.catches, "finds about 1 in 17 posts calling for violence in testing");
});

test("no catch, no hits or a broken row gives no line", () => {
  assert.equal(catchLines("vigilante"), null);
  assert.equal(catchLines("mismatch"), null);
  assert.equal(catchLines("violence", { violence: { precision: 0.9, n: 40 } }), null);
  assert.equal(catchLines("violence", row({ ...ok, against: "matched", hits: 0, of: 50, c: 3 })), null);
  assert.equal(catchLines("violence", row({ ...ok, against: "matched", hits: 60, of: 50, c: 3 })), null);
  assert.equal(catchLines("violence", { violence: { precision: 0.9, catch: { against: "matched", hits: 1, of: 50, c: 3 } } }), null, "a row without n is not a measurement");
});

test("the window puts Catch rate, Sensitivity and Tendency right under Measured", () => {
  const sig = PBSignals.all({ site: X, handle: "a", markers: PB.score("Migrants are vermin").markers, machine: {}, flags: [] });
  const s = sig.find((x) => x.label === "dehumanising language");
  const heads = s.rows.map(([h]) => h), at = heads.indexOf("Measured");
  assert.deepEqual(heads.slice(at, at + 4), ["Measured", "Catch rate", "Sensitivity", "Tendency"]);
  assert.match(s.rows[at][1], /against its own dehumanising label/);
  assert.equal(s.rows[at + 1][1], "finds about 1 in 420 dehumanising posts in testing");
  assert.equal(s.rows[at + 2][1], D);
  assert.equal(s.rows[at + 3][1], "rarely fires; when it does, it is right more often than not");
});

test("a sign without a measured catch keeps only its Measured row", () => {
  const sig = PBSignals.all({ site: X, handle: "a", markers: [], machine: {}, flags: [{ id: "new-account", evidence: "e", doesNotProve: "d" }] });
  for (const s of sig) assert.ok(!s.rows.some(([h]) => ["Catch rate", "Sensitivity", "Tendency"].includes(h)), s.label);
});

test("the wording carries no em dashes", () => {
  for (const f of ["violence", "dehumanise", "slur", "stereotype"]) assert.doesNotMatch(Object.values(catchLines(f)).join(" "), /—/);
});
