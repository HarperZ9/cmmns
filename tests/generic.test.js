// The generic reader (src/core/generic.js) on summaries of pages CMMNS has no site reader for: the
// article body is the block with the most paragraph text, and comments are the largest run of
// same-shaped boxes that carry an author or a time stamp. Navigation lists are not comments.
import test from "node:test";
import assert from "node:assert/strict";
import { pickArticle, pickComments, genericChecks, GENERIC_DOES_NOT_PROVE } from "../src/core/generic.js";

const para = (n, w = "The council met on Tuesday to discuss the new budget for the river district") => Array.from({ length: n }, (_, i) => `${w}, item ${i}.`);

test("the article is the block with the most paragraph text", () => {
  const a = pickArticle([{ paragraphs: ["Short.", "Menu"] }, { paragraphs: para(10) }, { paragraphs: para(2) }]);
  assert.ok(a && a.startsWith("The council met"));
  assert.equal(a.split("\n\n").length, 10);
  assert.equal(pickArticle([{ paragraphs: para(2) }]), null, "too little text is not an article");
  assert.equal(pickArticle([]), null);
});

test("comments: same-shaped boxes with authors or times; link lists and paragraph runs are not comments", () => {
  const comments = { items: Array.from({ length: 6 }, (_, i) => ({ text: `I think the budget vote was rushed, point ${i}`, author: `reader${i}`, hasTime: true })) };
  const nav = { items: Array.from({ length: 12 }, (_, i) => ({ text: `Section ${i}`, author: null, hasTime: false })) };
  const paras = { items: para(8).map((text) => ({ text, author: null, hasTime: false })) };
  const got = pickComments([nav, paras, comments]);
  assert.equal(got.length, 6);
  assert.equal(got[0].author, "reader0");
  assert.equal(pickComments([nav, paras]), null);
  assert.equal(pickComments([{ items: comments.items.slice(0, 2) }]), null, "two boxes are not a list");
});

test("the checks give counts only, with no post text in the result", () => {
  const comments = [
    { text: "Wake up, people! They are lying to you about the budget.", author: "a" },
    { text: "Wake up, people! They are lying to you about the budget.", author: "b" },
    { text: "The vote passed seven to two after a long debate.", author: "c" },
  ];
  const r = genericChecks({ article: para(10).join(" "), comments });
  assert.equal(r.comments.n, 3);
  assert.equal(r.comments.repeatedTexts, 1);
  assert.equal(r.comments.largestRepeat, 2);
  assert.ok(r.comments.marked >= 2);
  assert.ok(r.article.chars > 500);
  assert.doesNotMatch(JSON.stringify(r), /lying to you|council met/);
  assert.deepEqual(genericChecks({ article: null, comments: null }), { article: null, comments: null });
  assert.match(GENERIC_DOES_NOT_PROVE, /guessed/);
});
