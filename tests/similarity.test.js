import test from "node:test";
import assert from "node:assert/strict";
import { normalize, shingles, jaccard, duplicateClusters } from "../src/core/similarity.js";

test("normalize drops links, handles, punctuation and case", () => {
  assert.equal(normalize("@bob WAKE UP!! https://t.co/x  France is lost."), "wake up france is lost");
});

test("identical shingle sets have Jaccard 1, disjoint 0", () => {
  const a = shingles("one two three four five six"), b = shingles("seven eight nine ten eleven twelve");
  assert.equal(jaccard(a, a), 1);
  assert.equal(jaccard(a, b), 0);
});

test("a copied reply posted by three accounts forms one cluster", () => {
  const msg = "The protests are paid for by foreign money and the media will never tell you that";
  const replies = [
    { id: "1", author: "a", text: msg },
    { id: "2", author: "b", text: msg + "!!" },
    { id: "3", author: "c", text: "@someone " + msg },
    { id: "4", author: "d", text: "I was at the march today and it was peaceful the whole time we walked" },
  ];
  const c = duplicateClusters(replies);
  assert.equal(c.length, 1);
  assert.deepEqual(c[0].ids.sort(), ["1", "2", "3"]);
  assert.equal(c[0].authors.length, 3);
});

test("short stock replies never cluster", () => {
  const replies = ["this", "100% this", "lol", "so true", "exactly this"].map((t, i) => ({ id: String(i), author: "u" + i, text: t }));
  assert.deepEqual(duplicateClusters(replies), []);
});

test("one author repeating themselves is not cross-account coordination", () => {
  const msg = "Everyone should read the full report before sharing anything about this today";
  assert.deepEqual(duplicateClusters([{ id: "1", author: "a", text: msg }, { id: "2", author: "a", text: msg }]), []);
});

test("replies on the same topic with different wording do not cluster", () => {
  const replies = [
    { id: "1", author: "a", text: "The pension reform pushed people into the streets again this week in Paris" },
    { id: "2", author: "b", text: "Paris saw big crowds again because of the pension changes the government forced through" },
  ];
  assert.deepEqual(duplicateClusters(replies), []);
});
