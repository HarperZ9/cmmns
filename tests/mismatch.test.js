import test from "node:test";
import assert from "node:assert/strict";
import { localClaims, compare } from "../src/core/mismatch.js";
import { parseLabel } from "../src/core/places.js";
import { flagsFor, isFlagged, ageDays } from "../src/core/flags.js";

const countries = (t) => localClaims(t).map((c) => c.country);

test("local claims in English and French", () => {
  assert.deepEqual(countries("Here in France nobody believes the government"), ["France"]);
  assert.deepEqual(countries("As a Frenchman I can tell you it is chaos"), ["France"]);
  assert.deepEqual(countries("We French know what happened"), ["France"]);
  assert.deepEqual(countries("I live in Paris and it is calm"), ["France"]);
  assert.deepEqual(countries("Ici en France personne n'y croit"), ["France"]);
  assert.deepEqual(countries("Nous les Français savons"), ["France"]);
  assert.deepEqual(countries("my fellow Americans, wake up"), ["United States"]);
});

test("mentioning a place is not a local claim", () => {
  assert.deepEqual(countries("France is burning and the media hides it"), []);
  assert.deepEqual(countries("What is happening in Paris tonight?"), []);
  assert.deepEqual(countries("As an English speaker I struggled with the article"), []);
});

test("labels parse to a country or a region", () => {
  assert.deepEqual(parseLabel("France"), { country: "France", region: "europe" });
  assert.deepEqual(parseLabel("Europe"), { region: "europe" });
  assert.deepEqual(parseLabel("West Asia"), { region: "west asia" });
  assert.equal(parseLabel(""), null);
  assert.equal(parseLabel("Atlantis"), null);
});

test("compare: mismatch, consistent, region-consistent, unknown, none", () => {
  assert.equal(compare("Here in France it is calm", "Nigeria").status, "mismatch");
  assert.equal(compare("Here in France it is calm", "France").status, "consistent");
  assert.equal(compare("Here in France it is calm", "Europe").status, "consistent");
  assert.equal(compare("Here in France it is calm", "South Asia").status, "mismatch");
  assert.equal(compare("Here in France it is calm", "").status, "unknown");
  assert.equal(compare("France is calm", "Nigeria").status, "none");
});

test("flags carry evidence and a does-not-prove line", () => {
  const now = Date.parse("2026-10-17T00:00:00Z");
  const f = flagsFor({ handle: "Marie84736251", joinDate: "2026-10-10", nameChanges: 4 },
    { now, mismatch: compare("Here in France it is calm", "Nigeria"), cluster: { size: 3 } });
  assert.deepEqual(f.map((x) => x.id), ["new-account", "name-changes", "default-handle", "based-elsewhere", "same-text"]);
  for (const x of f) assert.ok(x.doesNotProve && x.evidence);
  assert.equal(ageDays("2026-10-10", now), 7);
});

test("a default handle alone does not make an account flagged", () => {
  assert.equal(isFlagged(flagsFor({ handle: "Marie84736251", joinDate: "2015-01-01", nameChanges: 0 })), false);
  assert.equal(isFlagged(flagsFor({ handle: "marie", joinDate: "2026-10-16", nameChanges: 0 }, { now: Date.parse("2026-10-17") })), true);
});

test("a documented hate symbol in a chosen name is flagged, ordinary names are not", () => {
  assert.ok(flagsFor({ handle: "jerry45", display: "FOID Hating Aryan Jerry" }).some((f) => f.id === "hate-symbol-name"));
  assert.ok(flagsFor({ handle: "anon1488" }).some((f) => f.id === "hate-symbol-name"));
  assert.ok(!flagsFor({ handle: "maria_1987", display: "Maria Lopez" }).some((f) => f.id === "hate-symbol-name"));
  assert.ok(!flagsFor({ handle: "carian", display: "Darian Price" }).some((f) => f.id === "hate-symbol-name"));
});
