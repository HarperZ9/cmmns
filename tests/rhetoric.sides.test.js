// The side-recall fix (project-docs/EVALUATION.md, "Side comparison"): terms added for the groups
// the left is often hostile to, and the identity-plus-gendered-slur grammar, which is the same for
// every identity word. Each test pairs a term aimed at one side with its counterpart where one exists.

import { test } from "node:test";
import assert from "node:assert/strict";
import { score } from "../src/core/rhetoric.js";
import { IDENTITY_ADJ } from "../src/core/lexicon.js";

const fams = (t) => [...new Set(score(t).markers.map((m) => m.family))].sort().join(",");

test("an identity word fused with a gendered slur is a slur for every identity", () => {
  const got = new Map(IDENTITY_ADJ.map((a) => [a, fams(`look at that ${a} bitch`)]));
  assert.deepEqual([...got].filter(([, f]) => f !== "slur"), []);
  assert.equal(fams("look at those white hoes"), "slur");
  assert.equal(fams("look at those black hoes"), "slur");
});

test("slurs aimed at each side's usual targets score alike", () => {
  const right = ["you nigger", "you faggot", "you spic"];
  const left = ["you white trash", "you wigger", "you cuck", "you bible thumper", "you christard", "you trailer trash"];
  for (const t of [...right, ...left]) assert.equal(fams(t), "slur", t);
});

test("political coinages from both directions are group names, not slurs", () => {
  for (const g of ["libtards", "trumptards", "magats", "demonrats", "rethuglicans", "conservatards", "leftards", "incels"]) {
    assert.equal(fams(`${g}`), g === "leftards" || g === "conservatards" ? "slurSoft" : "", g);
    assert.equal(fams(`${g} are vermin`).split(",").includes("dehumanise"), true, g);
  }
});

test("innocent neighbours of the new terms do not count", () => {
  for (const t of ["white bread and black coffee", "a white board in the black room", "the trash was white", "a mud shark is a dogfish",
    "the fundamentals are strong", "white bitcoin wallet", "a black hoodie", "she cuckoo-clocked the meeting"]) {
    assert.ok(!fams(t).split(",").includes("slur"), t);
  }
});
