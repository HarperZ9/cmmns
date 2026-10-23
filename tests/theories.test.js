// Named conspiracy theories (src/core/theories.js): an extension of the conspiracy family. Each
// theory is sourced with a date, carries its own does-not-prove line, and stays out of the thread
// report's "extreme" count until it is measured on a corpus with conspiracy labels.
import test from "node:test";
import assert from "node:assert/strict";
import { THEORIES, theoryMatches, theoryById, THEORY_DOES_NOT_PROVE } from "../src/core/theories.js";
import { score, WEIGHTS, STRONG } from "../src/core/rhetoric.js";
import { measuredLine, FAMILIES } from "../src/core/families.js";
import { MEASURED } from "../src/core/measured.js";

const ids = (t) => score(t).markers.filter((m) => m.family === "conspiracy-theory").map((m) => m.theory).sort();

test("every theory has a name, a claim, a sourced record with dates, and its own does-not-prove line", () => {
  assert.ok(THEORIES.length >= 10);
  assert.equal(new Set(THEORIES.map((t) => t.id)).size, THEORIES.length);
  for (const t of THEORIES) {
    assert.match(t.id, /^[a-z][a-z0-9-]+$/, t.id);
    assert.ok(t.name.length > 3 && t.claim.length > 20 && t.record.length > 20, t.id);
    assert.ok(t.dnp.length > 20, `${t.id} has no does-not-prove line`);
    assert.ok(t.sources.length >= 1, t.id);
    for (const s of t.sources) {
      assert.match(s.url, /^https:\/\//, `${t.id} source url`);
      assert.match(s.date, /^(19|20)\d\d(-\d\d(-\d\d)?)?$/, `${t.id} source date`);
      assert.ok(s.title.length > 5, t.id);
    }
    assert.ok((t.terms || []).length + (t.patterns || []).length > 0, t.id);
    assert.doesNotMatch(t.claim + t.record + t.dnp, /—/, `${t.id} has an em dash`);
  }
  assert.ok(THEORY_DOES_NOT_PROVE.length > 20);
});

test("sign examples name the theory they use", () => {
  const cases = [
    ["Hollywood elites are harvesting adrenochrome from kids", "adrenochrome"],
    ["Look up, those are chemtrails, they are spraying us", "chemtrails"],
    ["WWG1WGA patriots, the plan is working", "qanon"],
    ["It is all a satanic ritual abuse network run by elites", "satanic-abuse"],
    ["The great reset agenda is how they take your house", "great-reset"],
    ["You will own nothing and be happy, that's the plan", "great-reset"],
    ["The 2020 election was stolen and everyone knows it", "stolen-election"],
    ["Starlink flipped the votes in the swing states", "vote-flipping"],
    ["Dominion switched votes overnight", "vote-flipping"],
    ["Russia hacked the vote tallies in Wisconsin", "vote-flipping"],
    ["The Butler shooting was staged for sympathy", "staged-shooting"],
    ["9/11 was an inside job", "inside-job"],
    ["5G causes covid, look at the tower maps", "covid-5g"],
    ["Vaccines cause autism and they know it", "vaccine-harm"],
    ["Big pharma is hiding the cure for cancer", "hidden-cure"],
    ["One explanation: the president is being blackmailed by Russia", "secret-coercion"],
  ];
  for (const [text, id] of cases) assert.ok(ids(text).includes(id), `${id}: "${text}"`);
});

test("debunking, reporting and quoting a theory is not using it", () => {
  for (const text of [
    "The chemtrails conspiracy theory has been debunked many times.",
    "There is no evidence the 2020 election was stolen, every audit agreed.",
    "Fact check: Starlink flipped the votes is false, the machines are offline.",
    "He called it \"adrenochrome harvesting\" and the crowd laughed.",
    "The satanic ritual abuse panic of the 1980s ruined innocent lives.",
    "The claim that 5G causes covid is baseless.",
    "It is a myth that vaccines cause autism.",
    "The 2020 election was not stolen.",
    "He keeps saying the election was rigged, and now he is quiet about it.",
    "If you believe that, you also believe 9/11 was an inside job.",
    "The Pizzagate nonsense led to a man with a rifle in a restaurant.",
    "Let me guess, chemtrails too?",
  ]) assert.deepEqual(ids(text), [], text);
});

test("ordinary uses of nearby words do not match", () => {
  for (const text of [
    "The WEF launched the Great Reset initiative in June 2020.",
    "The storm is coming tonight, stay indoors.",
    "Contrails form when hot exhaust meets cold air.",
    "The election was close and the count took a week.",
    "My vaccine appointment is on Tuesday.",
    "They found a cure for this disease in mice.",
    "The shooting at the mall was reported at 3 pm.",
  ]) assert.deepEqual(ids(text), [], text);
});

test("named theories stay out of 'extreme' and never label the post as strong", () => {
  assert.equal(WEIGHTS["conspiracy-theory"], 0);
  assert.ok(!STRONG.has("conspiracy-theory"));
  const r = score("Adrenochrome, 5G causes covid and 9/11 was an inside job");
  assert.ok(r.markers.filter((m) => m.family === "conspiracy-theory").length >= 3);
  assert.equal(r.score, 0);
  assert.equal(r.extreme, false);
  // The existing conspiracy framing family keeps its weight, so the report is unchanged by this release.
  assert.equal(score("wake up sheeple, do your own research").score, 1);
  assert.equal(score("wake up sheeple, chemtrails are real").score, 1);
});

test("the family is listed and reads 'not measured yet'", () => {
  assert.ok(FAMILIES.some((f) => f.id === "conspiracy-theory" && f.area === "language"));
  assert.equal(MEASURED["conspiracy-theory"], undefined);
  assert.deepEqual(measuredLine("conspiracy-theory"), { measured: false, text: "not measured yet" });
});

test("theoryMatches gives each theory once, with the matched words, and theoryById finds it", () => {
  const m = theoryMatches("chemtrails chemtrails chem trails everywhere");
  assert.equal(m.length, 1);
  assert.equal(m[0].theory, "chemtrails");
  assert.match(m[0].match, /chem ?trails/i);
  assert.equal(theoryById("chemtrails").name.length > 3, true);
  assert.equal(theoryById("nope"), null);
});
