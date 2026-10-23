// The "Named in a published report" matcher, the profile reader, the trend counts, and the two
// new signs in the window.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

await import("../src/ext/core.bundle.js");
await import("../src/ext/signals.js");
const { PB, PBSignals } = globalThis;
const table = JSON.parse(readFileSync(join(import.meta.dirname, "..", "data/ops.json"), "utf8"));
PB.setOpsTable(table);

test("a domain a report named matches, with its subdomains; an unrelated one does not", () => {
  const h = PB.opsOfDomain("rrn.world");
  assert.ok(h.length && h.some((x) => x.op.id === "doppelganger-rrn"));
  assert.ok(PB.opsOfDomain("de.rrn.world").length);
  assert.equal(PB.opsOfDomain("reuters.com").length, 0);
  assert.equal(PB.opsOfDomain("world").length, 0);
});

test("a handle a report named matches without the @ and in any case", () => {
  assert.ok(PB.opsOfHandle("@Inside_Syria").some((x) => x.op.id === "gru-facebook-pages-2014-2019"));
  assert.equal(PB.opsOfHandle("someone_else").length, 0);
});

test("the worker's lookup returns only the matching operations and indicators", () => {
  const part = PB.opsLookup(table, { domains: ["www.rrn.world", "example.org"], handles: [] });
  assert.ok(part.indicators.length >= 1 && part.indicators.every((i) => i.d === "rrn.world"));
  assert.ok(part.ops.every((o) => part.indicators.some((i) => i.op === o.id)));
});

test("a profile's website, bio domains and bio handles are read; email addresses are not", () => {
  const p = PB.profileLinks({ website: "https://www.RRN.world/a", bio: "Read peacedata.net, follow @Inside_Syria. Mail me at a@b.com" });
  assert.deepEqual(p.domains.sort(), ["peacedata.net", "rrn.world"]);
  assert.deepEqual(p.handles, ["inside_syria"]);
  assert.deepEqual(PB.profileLinks(null), { domains: [], handles: [] });
});

test("the rows quote every source's attribution and end with what the match does not prove", () => {
  const h = PB.opsOfDomain("rrn.world").find((x) => x.op.id === "doppelganger-rrn");
  const rows = Object.fromEntries(PB.opRows(h));
  assert.match(rows["Attributed to"], /Russia/);
  assert.match(rows["Sources say"], /"/);
  assert.equal(rows["What it shows"], PB.OPS_DOES_NOT_PROVE);
  assert.match(PB.OPS_DOES_NOT_PROVE, /share these links unknowingly/);
});

test("trend counts add up to the table and carry the caveat", () => {
  const T = PB.opsTrend(table);
  assert.equal(T.total, table.ops.length);
  assert.equal(T.byYear.reduce((a, y) => a + y.n, 0), table.ops.length);
  assert.equal(T.byState.reduce((a, s) => a + s.n, 0), table.ops.length);
  assert.match(PB.OPS_TREND_CAVEAT, /counts follow where people looked/);
});

const X = { id: "x", name: "X", hasLocation: true };
const base = { site: X, handle: "someone", markers: [], machine: {}, flags: [] };

test("the window shows one report sign per operation, and drops the older state chip it covers", () => {
  PB.setStateRows([{ domain: "rrn.world", state: "Russia", basis: "named-in-report", actor: "government", name: "RRN", source: { title: "t", url: "https://example.org", date: "2024" } }]);
  const sig = PBSignals.all({ ...base, domains: ["rrn.world"] });
  const named = sig.filter((s) => s.fam === "named-in-report");
  assert.equal(new Set(named.map((s) => s.rows.find(([k]) => k === "Operation")[1])).size, named.length);
  assert.ok(named.length >= 1 && named.every((s) => s.level === "warn"));
  assert.ok(!sig.some((s) => s.fam === "state-link"), "the state chip for the same domain is replaced");
  PB.setStateRows([]);
});

test("a profile that names an operation's site gets the sign; the person is never named as the operator", () => {
  const sig = PBSignals.all({ ...base, reading: { website: "peacedata.net" } });
  const s = sig.find((x) => x.fam === "named-in-report");
  assert.ok(s);
  assert.match(s.rows[0][1], /profile names peacedata\.net/);
  assert.ok(!JSON.stringify(s.rows).includes("someone"));
});

test("a look-alike address is its own weaker sign; the real outlet gets none", () => {
  const fake = PBSignals.all({ ...base, domains: ["washingtonpost.pm"] }).find((s) => s.fam === "lookalike-domain");
  assert.equal(fake.level, "flag");
  assert.ok(fake.rows.some(([k]) => k === "What it shows"));
  assert.ok(!PBSignals.all({ ...base, domains: ["washingtonpost.com"] }).some((s) => s.fam === "lookalike-domain" || s.fam === "named-in-report"));
});
