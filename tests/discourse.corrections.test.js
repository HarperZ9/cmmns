// Correction replies (src/core/discourse/corrections.js), on a synthetic thread shaped like the
// study's Newton post, and the symmetry rule: swapping the sides of a thread never changes the order.
import test from "node:test";
import assert from "node:assert/strict";
import { rankCorrections, sourceKind } from "../src/core/discourse/corrections.js";

const ROOT = { author: "poster", text: "Newton spent two years locked inside his house and invented calculus. He also changed light theory and formulated gravity. The most important two years in human history." };
const REPLIES = [
  { id: "1", author: "a", likes: 9000, text: "This is the greatest thread ever, so inspiring!", links: [] },
  { id: "2", author: "b", likes: 120, text: "A few corrections: he developed calculus building on other mathematicians, and gravity was formulated decades later in the Principia.", links: [] },
  { id: "3", author: "c", likes: 3, text: "His law of gravity was published in the Principia in 1687, two decades after those years.", links: ["https://en.wikipedia.org/wiki/Philosophi%C3%A6_Naturalis_Principia_Mathematica"] },
  { id: "4", author: "d", likes: 50000, text: "You are an idiot.", links: [] },
  { id: "5", author: "e", likes: 1, text: "Source on the optics work:", links: ["https://x.com/someone/status/1"] },
  { id: "6", author: "poster", likes: 10, text: "Actually, in fact calculus and gravity both came from those two years.", links: [] },
];

test("replies that bring a reference or name a specific error are raised; praise, insults and bare social links are not", () => {
  const ranked = rankCorrections(ROOT, REPLIES);
  assert.deepEqual(ranked.map((x) => x.id), ["3", "2"]);
  assert.equal(ranked[0].source, "reference");
  assert.ok(ranked[1].shared.includes("calculu") || ranked[1].shared.includes("calculus"));
});

test("likes never move the order, and the poster's own replies are left out", () => {
  const flipped = REPLIES.map((r) => ({ ...r, likes: 100000 - r.likes }));
  assert.deepEqual(rankCorrections(ROOT, flipped).map((x) => x.id), rankCorrections(ROOT, REPLIES).map((x) => x.id));
  assert.ok(!rankCorrections(ROOT, REPLIES).some((x) => x.author === "poster"));
});

test("hosts are read by kind: primary records, reference works, other pages, social posts", () => {
  assert.equal(sourceKind("https://www.gutenberg.org/ebooks/6920"), "primary");
  assert.equal(sourceKind("https://plato.stanford.edu/entries/newton/"), "reference");
  assert.equal(sourceKind("https://history.state.gov/x"), "reference");
  assert.equal(sourceKind("https://example-news.com/story"), "web");
  assert.equal(sourceKind("https://t.co/abc"), "social");
});
