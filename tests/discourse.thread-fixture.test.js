// An end-to-end thread fixture shaped like the author's worked example of 2026-10-26: a viral claim
// with no source, a long correction that names its sources and has a tiny fraction of the claim's
// reach, a further unsourced claim, a question with a factual slip, and a recommendation. Handles
// are invented and the wording is paraphrased; the reach numbers keep the real proportions.
import test from "node:test";
import assert from "node:assert/strict";
import { rankCorrections } from "../src/core/discourse/corrections.js";
import { extractQuotes } from "../src/core/discourse/quotes.js";
import { findCounts } from "../src/core/discourse/stats.js";

const ROOT = { author: "viral_poster", likes: 11000, views: 230300,
  text: "Jared Kushner hired a hitman to kill Jamal Khashoggi who was actively investigating his ties to MBS at the time of his murder" };
const REPLIES = [
  { id: "doc", author: "film_fan", likes: 44, views: 7800, text: "Everyone should watch this!", links: [] },
  { id: "fix", author: "careful_reader", likes: 3, views: 627, links: [],
    text: "The claim is false. There is no credible evidence that Jared Kushner hired a hitman to kill Jamal Khashoggi, nor that Khashoggi was investigating Kushner's ties to MBS. What is established: Khashoggi was killed on October 2, 2018, inside the Saudi consulate in Istanbul. The declassified February 2021 ODNI report concluded that MBS approved an operation to capture or kill Khashoggi. A UN special rapporteur also found credible evidence of high-level Saudi responsibility. Kushner had a documented close relationship with MBS." },
  { id: "idf", author: "spade_caller", likes: 13, views: 2300, links: [], text: "i agree but let's call a spade a spade here kushner didn't hire a hitman he sent the IDF" },
  { id: "q", author: "asking_aloud", likes: 3, views: 1100, links: [], text: "Is this confirmed? Khashoggi was dismembered at the Turkish embassy." },
];

test("the sourced correction is raised first although it has a fraction of a percent of the claim's reach", () => {
  const ranked = rankCorrections(ROOT, REPLIES);
  assert.equal(ranked[0].id, "fix");
  assert.ok(REPLIES[1].views / ROOT.views < 0.003, "the correction's reach is under 0.3% of the claim's");
  assert.ok(ranked[0].shared.length >= 4, `it answers the post's own terms: ${ranked[0].shared.join(", ")}`);
});

test("the further claim, the question and the recommendation are not raised as corrections", () => {
  const ids = rankCorrections(ROOT, REPLIES).map((x) => x.id);
  assert.ok(!ids.includes("idf"), "a counter-claim with no source is not a correction");
  assert.ok(!ids.includes("q"), "a question is not a correction");
  assert.ok(!ids.includes("doc"));
});

test("raising never reads likes or views: flipping them leaves the order", () => {
  const flipped = REPLIES.map((r) => ({ ...r, likes: 100000 - r.likes, views: 1 }));
  assert.deepEqual(rankCorrections(ROOT, flipped).map((x) => x.id), rankCorrections(ROOT, REPLIES).map((x) => x.id));
});

test("the viral claim has no quote to look up and no count to bound", () => {
  assert.deepEqual(extractQuotes(ROOT.text, []).quotes, []);
  assert.deepEqual(findCounts(ROOT.text), []);
});
