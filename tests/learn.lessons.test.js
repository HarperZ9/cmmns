// The lessons: one for every sign family and technique, each a minute or two, each built for
// discernment (a sign example and a fair or ordinary one), each saying what the sign does not
// prove and that a post with the sign can still be true.
import test from "node:test";
import assert from "node:assert/strict";
import { FAMILIES } from "../src/core/families.js";
import { DOES_NOT_PROVE } from "../src/core/flags.js";
import { TECHNIQUES } from "../src/core/persuasion.js";
import { LESSONS, GROUPS, lesson, doesNotProve, lessonText, readSeconds, TRUE_TOO, MAX_SECONDS, KINDS, SIDES } from "../src/ext/learn/index.js";
import { RESEARCH } from "../src/ext/learn/research.js";
import { ITEMS } from "../src/ext/learn/quiz.js";

test("every badge family and every persuasion technique has a lesson", () => {
  for (const f of FAMILIES) assert.ok(lesson(f.id), `no lesson for ${f.id}`);
  for (const t of Object.keys(TECHNIQUES)) assert.ok(lesson(t), `no lesson for ${t}`);
  assert.ok(lesson("thread-report"));
});

test("lesson ids are unique and every lesson is in exactly one index group", () => {
  const ids = LESSONS.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length);
  const grouped = GROUPS.flatMap(([, g]) => g);
  assert.deepEqual([...grouped].sort(), [...ids].sort());
});

test("every lesson has each part, and takes between 60 seconds and 2 minutes aloud", () => {
  for (const l of LESSONS) {
    for (const k of ["title", "what", "why", "spot", "counter"]) assert.ok(typeof l[k] === "string" && l[k].length > (k === "title" ? 2 : 10), `${l.id} ${k}`);
    assert.ok(doesNotProve(l, DOES_NOT_PROVE).length > 10, `${l.id} has no does-not-prove line`);
    const s = readSeconds(l, DOES_NOT_PROVE);
    assert.ok(s >= 60 && s <= MAX_SECONDS, `${l.id} reads in ${s} s`);
  }
});

test("every lesson shows the sign and a fair or ordinary case beside it", () => {
  for (const l of LESSONS) {
    const kinds = new Set(l.examples.map((e) => e.kind));
    assert.ok(l.examples.every((e) => KINDS.includes(e.kind) && SIDES.includes(e.side) && e.topic), l.id);
    assert.ok(kinds.has("sign"), `${l.id} has no sign example`);
    assert.ok(kinds.has("fair") || kinds.has("ordinary"), `${l.id} has no fair or ordinary example`);
  }
});

test("every lesson says a post with the sign can still be true", () => {
  assert.match(TRUE_TOO, /can still be true/);
  for (const l of LESSONS) assert.ok(lessonText(l, DOES_NOT_PROVE).includes(TRUE_TOO), l.id);
});

test("a lesson for an account flag uses the badge's own does-not-prove line", () => {
  for (const l of LESSONS) {
    const id = l.flag || l.id;
    if (DOES_NOT_PROVE[id] && !l.dnp) assert.equal(doesNotProve(l, DOES_NOT_PROVE), DOES_NOT_PROVE[id]);
  }
  assert.ok(LESSONS.filter((l) => !l.dnp).every((l) => DOES_NOT_PROVE[l.flag || l.id]), "an empty dnp needs a badge line");
});

test("cited research exists, with a date, a DOI link and a stated limit", () => {
  for (const l of LESSONS) for (const k of l.research) assert.ok(RESEARCH[k], `${l.id} cites ${k}`);
  for (const [k, r] of Object.entries(RESEARCH)) {
    assert.match(r.cite, /\b(19|20)\d\d\b/, k);
    assert.match(r.url, /^https:\/\/doi\.org\/10\./, k);
    assert.ok(r.found && r.limit, k);
  }
});

test("no em dashes, no links and no handles in the examples and the self-check", () => {
  const all = [...LESSONS.map((l) => lessonText(l, DOES_NOT_PROVE)), ...ITEMS.map((i) => i.text + i.explain), ...Object.values(RESEARCH).map((r) => r.found + r.limit)];
  for (const t of all) assert.doesNotMatch(t, /\u2014/, t.slice(0, 60));
  for (const e of [...LESSONS.flatMap((l) => l.examples.map((x) => x.text)), ...ITEMS.map((i) => i.text)]) {
    assert.doesNotMatch(e, /https?:|www\.|@\w/, e);
  }
});

test("every self-check item points at a real lesson", () => {
  for (const i of ITEMS) assert.ok(lesson(i.lesson), i.id);
  assert.equal(new Set(ITEMS.map((i) => i.id)).size, ITEMS.length);
});
