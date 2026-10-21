// Framing symmetry: one template reads the same frame whoever it is about and whatever the issue.
// A frame says how a post explains an issue, so neither the person's group nor the topic can change it.
import test from "node:test";
import assert from "node:assert/strict";
import { framingOf } from "../src/core/framing.js";

const GROUPS = ["immigrant", "Muslim", "Jewish", "Christian", "Black", "white", "trans", "conservative", "liberal", "socialist",
  "Republican", "Democrat", "police", "union", "farmer", "landlord", "veteran", "refugee", "evangelical", "atheist"];
const ISSUES = ["immigration", "gun control", "abortion", "taxes", "policing", "climate", "housing", "trade", "schools", "health care"];

const TEMPLATES = [
  ["A 34-year-old {G} mother lost her job last week, and she says the {I} debate never mentions people like her.", "person-story"],
  ["My {G} neighbour was evicted on Monday and she told me {I} is all anyone talks about now in our street.", "person-story"],
  ["Support for {I} among {G} voters rose 12% since 2019, and the survey found the shift was national, not local.", "structural"],
  ["{G} groups are divided on {I}, and I expect a long argument about it at the town meeting next month.", null],
];

for (const [tpl, want] of TEMPLATES) {
  test(`same frame for every group and issue: "${tpl.slice(0, 40)}..."`, () => {
    const off = [];
    for (const G of GROUPS) for (const I of ISSUES) { const got = framingOf(tpl.replace("{G}", G).replace("{I}", I)).frame; if (got !== want) off.push([G, I, got]); }
    assert.deepEqual(off, []);
  });
}

test("a group or issue name alone reads no frame cue", () => {
  for (const x of [...GROUPS, ...ISSUES]) { const f = framingOf(x); assert.deepEqual([f.episodic, f.thematic], [[], []], x); }
});
