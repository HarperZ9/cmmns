// The document-image claim check (src/core/discourse/docclaim.js) on a synthetic letter shaped like
// the one in the study: a post says a letter makes a claim the pages shown do not contain. The text
// stands in for what the recogniser reads; tests/ocr.read.test.js covers the reading itself.
import test from "node:test";
import assert from "node:assert/strict";
import { keyTerms, checkDocument, docRows } from "../src/core/discourse/docclaim.js";
import { docSign } from "../src/core/discourse/cards.js";

const PAGES = [
  { text: "October 23, 2026. Re: Harbor Weekly's excerpt from Tides and Ledgers. We represent Alma Ruiz. The excerpt accuses Ms. Ruiz of secretly gaining access to at least $2 billion while she served on the port commission." },
  { text: "Ms. Ruiz was never a signatory to, never had access to, and never knew of any such account. The excerpt rests on unnamed sources. She received regular counterintelligence briefings and was never informed of any compromise of her phone." },
  { text: "Journalist Lee Park, who would not be classified as a defender of the commission, criticised the excerpt. We demand that Harbor Weekly take down the excerpt and preserve all documents." },
];
const POST = "Alma Ruiz does not have any security clearances. So her claim about divulging classified information would mean she is admitting to illegal access of classified information.";

test("the post's key terms keep names and two-word phrases together", () => {
  const terms = keyTerms(POST).map((t) => t.term.toLowerCase());
  assert.ok(terms.includes("alma ruiz"));
  assert.ok(terms.includes("security clearances"));
  assert.ok(terms.includes("classified information"));
});

test("terms on the pages are placed by image, and the claim's phrases are reported absent", () => {
  const r = checkDocument(POST, PAGES);
  const absent = r.absent.map((x) => x.term.toLowerCase()), found = Object.fromEntries(r.found.map((x) => [x.term.toLowerCase(), x.images]));
  assert.ok(absent.includes("classified information"));
  assert.ok(absent.includes("security clearances"));
  assert.deepEqual(found["alma ruiz"], [1]);
  assert.equal(r.images, 3);
});

test("a single word found in another sense comes with its line, so the reader can judge", () => {
  const r = checkDocument("The letter admits the files were classified.", PAGES);
  const hit = r.found.find((x) => x.term === "classified");
  assert.deepEqual(hit.images, [3]);
  assert.match(hit.snippet, /would not be classified as a defender/);
});

test("the window says how many images were read and what a missing word does not prove", () => {
  const rows = docRows(checkDocument(POST, [...PAGES, { text: "" }]));
  assert.match(rows[0][1], /3 images read of the 4 the post shows/);
  assert.match(rows.at(-1)[1], /does not mean the document never says it/);
  assert.match(docSign(checkDocument(POST, PAGES))[0].label, /of the post's terms not on the pages shown/);
});

test("the recogniser's one-letter slips still match long words", () => {
  const r = checkDocument("The letter cites counterintelligence briefings.", [{ text: "regular counterinteliigence briefings" }]);
  assert.ok(r.found.some((x) => /counterintelligence/.test(x.term)));
});
