// The reading lens (src/core/reading.js): spans and names, the inflection factors, thread and feed
// pattern counts, and the ship gate. Post texts are paraphrases, except the two short fragments the
// 2026-10-23 brief quotes from the Haiti case.
import test from "node:test";
import assert from "node:assert/strict";
import { readPost, readThread, readingReport, feedPatterns, readingOn, lensOn, cueHits } from "../src/core/reading.js";
import { READING_TECHNIQUES } from "../src/core/reading-cues.js";
import { inflect, matchFactors, postFactors, FACTOR_IDS } from "../src/core/reading-inflection.js";
import { READING_MEASURED } from "../src/core/reading-measured.js";

const ALL = new Set(READING_TECHNIQUES.map((t) => t.id));
const HAITI = [
  { id: "root", author: "@a", role: "root", text: "take Haiti and convert it into a penal colony" },
  { id: "r1", author: "@b", role: "reply", text: "Haiti isn't a country, not really, it's a no man's land" },
];

test("the Haiti case: each post gets spans with technique names", () => {
  const r = readThread(HAITI, { on: ALL });
  const names = r.map((p) => p.findings.map((f) => [f.name, f.match]));
  assert.deepEqual(names[0], [["Punitive annexation or elimination", "take Haiti and convert it into"], ["Punitive annexation or elimination", "penal colony"]]);
  assert.deepEqual(names[1], [["Nation denial", "Haiti isn't a country"], ["Nation denial", "no man's land"]]);
  for (const f of r.flatMap((p) => p.findings)) {
    assert.equal(HAITI.find((h) => h.id === (r[0].findings.includes(f) ? "root" : "r1")).text.slice(f.start, f.end), f.match);
    assert.ok(f.top.length >= 1 && f.top.length <= 2, "one or two factors");
    assert.ok(f.top.every((x) => x.effect === "raises" || x.effect === "lowers"));
  }
});

test("spans index into the text as written, curly apostrophes included", () => {
  const t = "Haiti isn’t a country";
  const [h] = cueHits(t);
  assert.equal(t.slice(h.start, h.end), "Haiti isn’t a country");
});

test("a coded term named to criticise it is weighed down by the use/mention factor", () => {
  const [f] = readPost("Despite being bent into a pretzel by the JQ obsessives, he still has a good show", { on: ALL });
  assert.equal(f.technique, "coded-term");
  assert.equal(f.shown, false);
  assert.equal(f.top[0].id, "mention");
});

test("inflection is deterministic and the top factors are the largest contributions", () => {
  const W = { bias: 0, threshold: 0.5, w: Object.fromEntries(FACTOR_IDS.map((id) => [id, 0])) };
  W.w.rebuts = -2; W.w["target-group"] = 1; W.w.intensity = 0.1;
  const x = { rebuts: 1, "target-group": 1, intensity: 1 };
  const a = inflect(x, W), b = inflect(x, W);
  assert.deepEqual(a, b);
  assert.deepEqual(a.top.map((t) => [t.id, t.effect]), [["rebuts", "lowers"], ["target-group", "raises"]]);
  assert.equal(a.shown, a.weight >= 0.5);
});

test("stance factors: quotes, questions and rebuttals are read from the sentence", () => {
  const s = "He said “they rigged the election”. That claim is false.";
  const hit = cueHits(s).find((h) => h.technique === "election-theft");
  const f = matchFactors(s, hit, postFactors(s));
  assert.equal(f.quotes, 1);
  assert.equal(f.rebuts, 1);
  const q = "Was the vote rigged? Who paid for it?";
  const qh = cueHits(q).find((h) => h.technique === "question-insinuation");
  assert.equal(matchFactors(q, qh).question, 0, "a question is the technique itself, so it is not a factor");
});

test("thread context: echo, root and the author's repeat are counted", () => {
  const posts = [
    { id: "1", author: "a", role: "root", text: "they rigged the election" },
    { id: "2", author: "b", role: "reply", text: "the election was stolen, rigged election" },
    { id: "3", author: "a", role: "reply", text: "a fake president again" },
  ];
  const r = readThread(posts, { on: ALL, withFactors: true });
  const f2 = r[1].findings.find((f) => f.technique === "election-theft");
  assert.equal(f2.factors.root, 1);
  assert.ok(f2.factors.echo > 0);
  const f3 = r[2].findings.find((f) => f.technique === "election-theft");
  assert.equal(f3.factors.repeat, 1);
});

test("pattern counts: a technique in two posts by two authors is a pattern", () => {
  const posts = [
    { id: "1", author: "a", role: "root", text: "Haiti isn't a country" },
    { id: "2", author: "b", role: "reply", text: "Somalia is not a real country" },
    { id: "3", author: "c", role: "reply", text: "nice weather today" },
  ];
  const rep = readingReport(posts, { on: ALL, inflection: false });
  const nd = rep.patterns.find((p) => p.technique === "nation-denial");
  assert.deepEqual([nd.posts, nd.authors, nd.of, nd.pattern], [2, 2, 3, true]);
  const feed = feedPatterns(posts, { on: ALL, inflection: false });
  assert.equal(feed.find((p) => p.technique === "nation-denial").posts, 2);
});

test("the ship gate: only techniques the held-out run turned on show by default", () => {
  const on = readingOn();
  for (const id of on) assert.equal(READING_MEASURED[id].on, true);
  for (const [id, r] of Object.entries(READING_MEASURED)) if (r.on) assert.ok(r.n >= 3 && r.precision >= 0.8, id);
  assert.equal(lensOn({ lensAll: true }).size, READING_TECHNIQUES.length);
  assert.deepEqual([...lensOn({ lensAll: false })], [...on]);
  const hidden = readPost(HAITI[1].text).filter((f) => f.shown && !on.has(f.technique));
  assert.deepEqual(hidden, []);
});

// The 3.4.0 case run (2026-10-23) tagged a plain ownership statement as secret coercion.
test("a statement of who owns a system or firm is not secret coercion", () => {
  for (const t of [
    "Starshield systems are owned and controlled by the US government. Any limits on speed are decided by the military.",
    "The network is wholly owned by the US government.",
    "The satellites are controlled by the United States.",
    "The company was owned by China until last year.",
  ]) assert.deepEqual(cueHits(t).filter((h) => h.technique === "secret-coercion"), [], t);
  for (const t of ["He is controlled by the Kremlin.", "Congress is owned by AIPAC.", "She was bought and paid for by Big Pharma."])
    assert.ok(cueHits(t).some((h) => h.technique === "secret-coercion"), t);
});
