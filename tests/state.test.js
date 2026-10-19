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
