// Combining marks are part of words in Indic and other scripts: stripping them split
// "नमस्ते" into pieces, so copied Hindi replies matched worse than copied English ones.
import test from "node:test";
import assert from "node:assert/strict";
import { normalize, shingles } from "../src/core/similarity.js";

test("combining marks stay inside the word", () => {
  assert.equal(normalize("नमस्ते दोस्तों!"), "नमस्ते दोस्तों");
  assert.equal(normalize("crème brûlée"), "crème brûlée");
});

test("a Hindi sentence shingles by whole words", () => {
  const s = shingles("यह सरकार झूठ बोल रही है");
  assert.ok(s.has("यह सरकार झूठ"));
  assert.equal(s.size, 4);
});
