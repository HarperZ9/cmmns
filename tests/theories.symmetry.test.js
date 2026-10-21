// Symmetry for named conspiracy theories. Political side is never an input: the side codes below
// live only in this test, from the literature on who tends to repeat each claim (Enders et al.
// 2023, Political Behavior, doi:10.1007/s11109-022-09812-3: motivated conspiracy endorsement
// is symmetric when the content is held constant). Each pair holds the claim's shape constant and
// swaps the side that usually tells it. Both halves must get the same theory.
import test from "node:test";
import assert from "node:assert/strict";
import { score, GROUPS } from "../src/core/rhetoric.js";

const theories = (t) => score(t).markers.filter((m) => m.family === "conspiracy-theory").map((m) => m.theory).sort().join(",");

// [right-coded, left-coded, expected theory]
const PAIRS = [
  ["Dominion flipped the votes in Georgia", "Starlink flipped the votes in Pennsylvania", "vote-flipping"],
  ["Smartmatic changed the results overnight", "Russia hacked the vote tallies overnight", "vote-flipping"],
  ["The 2020 election was stolen", "The 2016 election was stolen", "stolen-election"],
  ["Democrats rigged the election", "Republicans rigged the election", "stolen-election"],
  ["Sandy Hook was staged with crisis actors", "The Butler assassination attempt was staged", "staged-shooting"],
  ["Soros is behind the great reset agenda", "The billionaires' great reset agenda is a plot against workers", "great-reset"],
  ["Big pharma is hiding the cure for cancer", "The FDA is hiding the cure for cancer", "hidden-cure"],
];

for (const [right, left, id] of PAIRS) {
  test(`matched pair finds "${id}" on both sides`, () => {
    assert.ok(theories(right).split(",").includes(id), `right-coded: "${right}" gave "${theories(right)}"`);
    assert.ok(theories(left).split(",").includes(id), `left-coded: "${left}" gave "${theories(left)}"`);
  });
}

test("'<group> rigged the election' scores the same for every group", () => {
  const got = new Map(GROUPS.slice(0, 200).map((g) => [g, theories(`${g} rigged the election`)]));
  const differing = [...got].filter(([, t]) => t !== "stolen-election");
  assert.deepEqual(differing, []);
});

test("both sides' debunking is skipped the same way", () => {
  for (const t of ["There is no evidence Dominion flipped the votes", "There is no evidence Starlink flipped the votes",
    "The 2020 election was not stolen", "The 2016 election was not stolen"]) assert.equal(theories(t), "", t);
});
