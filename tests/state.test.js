import test from "node:test";
import assert from "node:assert/strict";
import { setStateRows, stateLinksOfDomain, stateLinksOfHandle, stateSummary, STATE_DOES_NOT_PROVE } from "../src/core/state.js";

const src = { title: "Example report", url: "https://example.org/report", date: "2026-01-01" };
setStateRows([
  { domain: "statenews.example", state: "Examplia", basis: "state-owned", name: "State News", source: src },
  { domain: "clone-site.example", x: "fakeoutlet", state: "Otherland", basis: "named-in-report", name: "Clone site", source: src },
]);

test("domains match with subdomains; handles match case-insensitively", () => {
  assert.equal(stateLinksOfDomain("de.statenews.example")[0].state, "Examplia");
  assert.equal(stateLinksOfDomain("www.statenews.example").length, 1);
  assert.equal(stateLinksOfDomain("notstatenews.example").length, 0);
  assert.equal(stateLinksOfHandle("FakeOutlet")[0].basis, "named-in-report");
});

test("thread summary counts replies per state and basis", () => {
  const s = stateSummary([
    { id: "1", author: "a", domains: ["statenews.example"] },
    { id: "2", author: "fakeoutlet", domains: [] },
    { id: "3", author: "b", domains: ["statenews.example", "clone-site.example"] },
  ]);
  assert.deepEqual(s.map((x) => [x.state, x.basis, x.replies]), [["Examplia", "state-owned", 2], ["Otherland", "named-in-report", 2]]);
  assert.ok(STATE_DOES_NOT_PROVE["state-owned"] && STATE_DOES_NOT_PROVE["named-in-report"]);
});

test("labels say who the report blames, not just the country", async () => {
  const { stateLabel } = await import("../src/core/state.js");
  const firm = stateLabel({ basis: "named-in-report", state: "Israel", actor: "commercial firm", operation: "STOIC" });
  assert.equal(firm.chip, "op report: firm in Israel");
  assert.match(firm.says, /a firm in Israel \(STOIC\)/);
  assert.equal(stateLabel({ basis: "named-in-report", state: "Russia", actor: "government" }).chip, "op report: Russia govt");
  assert.equal(stateLabel({ basis: "state-owned", state: "France" }).chip, "state-owned: France");
});

test("shipped state.json: every row is sourced and well formed", async () => {
  const { readFileSync } = await import("node:fs");
  const t = JSON.parse(readFileSync(new URL("../src/ext/state.json", import.meta.url), "utf8"));
  assert.ok(t.rows.length > 0);
  for (const r of t.rows) {
    assert.ok(r.domain || r.x, JSON.stringify(r));
    assert.ok(r.state && r.name && r.source && /^https:\/\//.test(r.source.url) && r.source.title && r.source.date, JSON.stringify(r));
    assert.ok(["state-owned", "public-broadcaster", "named-in-report"].includes(r.basis), r.basis);
    if (r.basis === "named-in-report") assert.ok(["government", "commercial firm", "individuals or group"].includes(r.actor), JSON.stringify(r));
  }
  // one spelling per country
  const states = new Set(t.rows.map((r) => r.state));
  for (const bad of ["People's Republic of China", "Turkiye", "Turkey", "Russian Federation"]) assert.ok(!states.has(bad), bad);
});
