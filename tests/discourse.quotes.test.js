// The quote finder (src/core/discourse/quotes.js) on the bundled index, the study posts of
// 2026-10-25 and the labelled sets. A wrong "found" is the main harm, so precision is held hard.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildIndex, lookupQuote, extractQuotes } from "../src/core/discourse/quotes.js";
import { quoteSigns } from "../src/core/discourse/cards.js";
import { evaluate } from "../scripts/eval-discourse.mjs";

const data = JSON.parse(readFileSync(new URL("../src/ext/discourse/quotes.json", import.meta.url), "utf8"));
const index = buildIndex(data);

test("the Meditations line from the study post is found as a close paraphrase of Long's Book VIII, 36", () => {
  const post = "Marcus Aurelius wrote this over 1800 years ago:\n\n“Do not disturb yourself by imagining your whole life at once.”";
  const { quotes } = extractQuotes(post, ["Marcus Aurelius"]);
  assert.deepEqual(quotes, [{ text: "Do not disturb yourself by imagining your whole life at once.", by: "Marcus Aurelius" }]);
  const r = lookupQuote(index, quotes[0].text, quotes[0].by);
  assert.equal(r.status, "close");
  assert.equal(r.work.translator, "George Long");
  assert.equal(r.locator, "Book VIII, section 36");
  assert.match(r.passage, /Do not disturb thyself by thinking of the whole of thy life/);
  assert.equal(r.otherAuthor, false);
});

test("a list of one-line sayings credited to names is counted, with its sources and its short lines", () => {
  const post = "What is life?\n - Dostoevsky: It's hell.\n - Nietzsche: It's power.\n - Schopenhauer: It's suffering.\n - Kafka: It's just the beginning.";
  const { quotes, list } = extractQuotes(post, ["Dostoevsky", "Nietzsche", "Schopenhauer"]);
  assert.deepEqual(quotes, []);
  assert.deepEqual(list, { lines: 4, named: 3, sourced: 0, short: 4 });
  const [sign] = quoteSigns([], list);
  assert.equal(sign.label, "4 lines credited to names, 0 sourced");
  assert.equal(sign.level, "info");
});

test("the 1849 letter is attested from a cited source, and the abridged edition is named", () => {
  const r = lookupQuote(index, "every minute can be an eternity of happiness", "Dostoevsky");
  assert.equal(r.status, "attested");
  assert.match(r.entry.finding, /22 December 1849/);
  assert.match(r.entry.source, /^https:\/\//);
});

test("a listed misattribution is named with its source, before any search", () => {
  const r = lookupQuote(index, "Everything we hear is an opinion, not a fact. Everything we see is a perspective, not the truth.", "Marcus Aurelius");
  assert.equal(r.status, "misattributed");
  assert.equal(r.entry.creditedTo, "Marcus Aurelius");
});

test("a quote outside the index is 'not found', says where it looked, and says that proves nothing", () => {
  const r = lookupQuote(index, "He who has a why to live can bear almost any how.", "Nietzsche");
  assert.equal(r.status, "not-found");
  assert.ok(r.searched.byPerson.some((w) => /Zarathustra/.test(w)));
  const [sign] = quoteSigns([r], null);
  assert.match(sign.rows.find(([h]) => h === "Not found")[1], /This proves nothing/);
});

test("the labelled sets: no wrong 'found' on the development or the held-out set, and none on quotes the index lacks", () => {
  for (const set of ["quotes-eval.json", "quotes-heldout.json"]) {
    const r = evaluate(set);
    assert.equal(r.precision.right, r.precision.of, `${set}: every claimed source is the right one`);
    assert.equal(r.falseFoundOnAbsent.wrong, 0, `${set}: nothing found for quotes the index lacks`);
    assert.ok(r.recall.right / r.recall.of >= 0.7, `${set}: recall ${r.recall.right}/${r.recall.of}`);
  }
});

test("the committed evaluation figures match a fresh run", () => {
  for (const [set, file] of [["quotes-eval.json", "discourse-eval.json"], ["quotes-heldout.json", "discourse-eval-heldout.json"]]) {
    const have = JSON.parse(readFileSync(new URL(`../project-docs/evidence/${file}`, import.meta.url), "utf8"));
    const want = evaluate(set);
    assert.deepEqual({ p: have.precision, r: have.recall, a: have.falseFoundOnAbsent }, { p: want.precision, r: want.recall, a: want.falseFoundOnAbsent }, `rerun node scripts/eval-discourse.mjs${set.includes("held") ? " --heldout" : ""} --write`);
  }
});

test("the study's thirteen-line list reads as 13 lines, none sourced, all too short to look up", () => {
  const names = ["Dostoevsky", "Socrates", "Aristotle", "Nietzsche", "Freud", "Marx", "Picasso", "Gandhi", "Schopenhauer", "Steve Jobs", "Einstein", "Stephen Hawking", "Kafka"];
  const post = "What is life?\n" + names.map((n, i) => ` - ${n}: It\u2019s ${["hell", "a test", "the mind", "power", "death", "the idea", "art", "love", "suffering", "faith", "knowledge", "hope", "just the beginning"][i]}.`).join("\n");
  const { list } = extractQuotes(post, ["Dostoevsky", "Nietzsche", "Schopenhauer", "Aristotle"]);
  assert.deepEqual(list, { lines: 13, named: 4, sourced: 0, short: 13 });
});
