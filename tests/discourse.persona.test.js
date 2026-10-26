// The persona marker (src/core/discourse/persona.js) and its name list. The hard rule: it never marks
// a living person, and never on a display name alone.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPersons, personaOf, yearText } from "../src/core/discourse/persona.js";

const data = JSON.parse(readFileSync(new URL("../src/ext/discourse/persons.json", import.meta.url), "utf8"));
const index = buildPersons(data);

test("the study's persona accounts are marked: a dead philosopher's name with the name in the handle", () => {
  const p = personaOf(index, { display: "Arthur Schopenhauer", handle: "SchopenhauerNow", verified: true });
  assert.equal(p.person.qid, "Q38193");
  assert.equal(p.label, "uses the name of Arthur Schopenhauer (died 1860)");
  assert.equal(p.cue, "handle");
  assert.ok(p.rows.some(([h, v]) => h === "The checkmark" && /paid subscription/.test(v)));
  assert.match(p.rows[0][1], /It is not that person writing/);
});

test("a handle one letter off still carries the name, and a display name that says what it is counts too", () => {
  assert.equal(personaOf(index, { display: "Leo Tolstoy Literature", handle: "LeoTollstoy" }).person.qid, "Q7243");
  assert.equal(personaOf(index, { display: "Fyodor Dostoevsky Quotes", handle: "fd_reads_1990" }).cue, "display");
});

test("a display name alone is not enough: a person named after someone famous is never marked", () => {
  assert.equal(personaOf(index, { display: "Leo Tolstoy", handle: "leo_t_1990" }), null);
  assert.equal(personaOf(index, { display: "Arthur Schopenhauer", handle: "art_s" }), null);
});

// Living people from the study and elsewhere, people whose names are shared with living people, and
// ordinary names. None may be marked, whatever the handle.
const LIVING = ["Elon Musk", "Yann LeCun", "Stephen King", "Nassim Nicholas Taleb", "Alexander Dugin", "Thomas Weber", "John Devlin", "Jared Kushner",
  "Michael Jackson", "John Smith", "James Brown", "Maria Garcia", "David Kim", "Isaac Newton", "Mehdi", "Adam Cochran", "Nic Munoz", "Ravi"];

test("no living person, and no name a living person shares, is in the list or marked", () => {
  const names = new Set(data.people.flatMap((p) => p[4].map((n) => n.toLowerCase())));
  for (const n of LIVING) {
    assert.ok(!names.has(n.toLowerCase()), `${n} is not on the list`);
    for (const handle of [n.replace(/\s+/g, ""), n.split(" ").pop() + "Official"]) assert.equal(personaOf(index, { display: `${n} Official`, handle }), null, `${n} @${handle}`);
  }
});

test("everyone on the list has died, by Wikidata's dates, and names are two words or an ancient single name", () => {
  for (const [qid, name, born, died, names] of data.people) {
    assert.match(qid, /^Q\d+$/);
    assert.ok(Number.isInteger(died), `${name} has a death year`);
    for (const n of names) assert.ok(n.trim().split(/\s+/).length >= 2 || died < 1500, `${n} is a single name for someone who died before 1500`);
  }
  assert.ok(data.people.length > 1000 && data.people.length < 5000);
});

test("years before the common era read as BCE in Wikidata's numbering", () => {
  assert.equal(yearText(-398), "399 BCE");
  assert.equal(yearText(180), "180");
});
