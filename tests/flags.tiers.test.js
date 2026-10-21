// Flag tiers for the "flagged" count. On a live thread about the riots in France (2026-10-21),
// 10 of 19 accounts counted as flagged. Place-context signals (app store, typed location, a flag
// in the name) fire for ordinary expats and diaspora, who fill threads like that one. Alone they
// are context; two of them together, or one strong signal, still count.
import test from "node:test";
import assert from "node:assert/strict";
import { isFlagged, WEAK_FLAGS } from "../src/core/flags.js";

const f = (...ids) => ids.map((id) => ({ id }));

test("one weak place-context signal alone does not count as flagged", () => {
  for (const id of ["store-elsewhere", "profile-location-elsewhere", "flag-elsewhere", "hours-elsewhere"]) {
    assert.equal(isFlagged(f(id)), false, id);
  }
});

test("two different weak signals together count", () => {
  assert.equal(isFlagged(f("store-elsewhere", "flag-elsewhere")), true);
});

test("the same weak signal twice is still one signal", () => {
  assert.equal(isFlagged(f("store-elsewhere", "store-elsewhere")), false);
});

test("strong signals count alone", () => {
  for (const id of ["based-elsewhere", "same-text", "copied-elsewhere", "automation-app", "no-sleep-gap",
    "new-account", "name-changes", "high-volume"]) {
    assert.equal(isFlagged(f(id)), true, id);
  }
});

test("signals that never count stay out, even beside a weak one", () => {
  assert.equal(isFlagged(f("default-handle", "hate-symbol-name", "follow-pattern")), false);
  assert.equal(isFlagged(f("default-handle", "store-elsewhere")), false);
});

test("every weak flag has a does-not-prove note", async () => {
  const { DOES_NOT_PROVE } = await import("../src/core/flags.js");
  for (const id of WEAK_FLAGS) assert.ok(DOES_NOT_PROVE[id], id);
});
