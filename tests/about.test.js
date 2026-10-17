// These fixtures are written from public descriptions of X's "About this account" page, not
// from a live capture. They pin the parser's behaviour; LIVE-CHECKS.md tracks confirming the
// real wording on a logged-in page.
import test from "node:test";
import assert from "node:assert/strict";
import { parseAbout, parseJoined, parseNameChanges } from "../src/core/about.js";

test("label-then-value layout", () => {
  const text = "About this account\nDate joined\nMarch 2019\nAccount based in\nNigeria\nConnected via\nNigeria App Store\n3 username changes";
  const a = parseAbout(text, "someone");
  assert.equal(a.basedIn, "Nigeria");
  assert.equal(a.joinDate, "2019-03-01");
  assert.equal(a.connectedVia, "Nigeria App Store");
  assert.equal(a.nameChanges, 3);
});

test("label and value on one line", () => {
  const a = parseAbout("Account based in: France\nJoined October 2026\nUsername changes · 0", "x");
  assert.equal(a.basedIn, "France");
  assert.equal(a.joinDate, "2026-10-01");
  assert.equal(a.nameChanges, 0);
});

test("missing fields come back null", () => {
  const a = parseAbout("About this account\nDate joined\nJune 2012", "x");
  assert.equal(a.basedIn, null);
  assert.equal(a.nameChanges, null);
  assert.equal(a.joinDate, "2012-06-01");
});

test("helpers", () => {
  assert.equal(parseJoined("Joined Sep. 2024"), "2024-09-01");
  assert.equal(parseJoined("nonsense"), null);
  assert.equal(parseNameChanges("No username changes"), 0);
  assert.equal(parseNameChanges("Changed username 2 times"), 2);
});
