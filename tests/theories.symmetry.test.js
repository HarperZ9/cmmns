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

// Added 2026-10-23 from the feed test: secret control by a people or a foreign power. Each pair swaps
// the people or the power and keeps the shape.
const CONTROL_PAIRS = [
  ["South Korea is now 99% under the control of the CCP", "Ukraine is now 90% under the control of the CIA"],
  ["Our parliament is fully controlled by Mossad", "Our parliament is fully controlled by the Kremlin"],
  ["The ministries have been infiltrated and controlled by Beijing", "The ministries have been infiltrated and controlled by Washington"],
  ["a jewish cabal is calling the shots", "a christian cabal is calling the shots"],
  ["muslim money controls the courts", "white money controls the courts"],
  ["so many deep state controlled countries now", "so many deep state controlled countries now"],
  ["she won through a rigged election", "he came to power through a stolen election"],
];
for (const [a, b] of CONTROL_PAIRS) {
  test(`secret control and rigged-election pair matches both: "${a}" / "${b}"`, () => {
    assert.notEqual(theories(a), "", a);
    assert.equal(theories(a), theories(b), b);
  });
}

test("secret control near misses: ownership, measurement, debunking", () => {
  for (const t of ["The firm is 100% owned by one family", "you are only 5% controlled by your DNA",
    "Crimea is now run by Moscow appointees", "the board is now controlled by the founders",
    "the idea that Korea is 99% under the control of the CCP is a baseless conspiracy theory",
    "fact check: no, the election was not won through a rigged election"]) assert.equal(theories(t), "", t);
});
