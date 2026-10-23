// The freshness line on the account card (src/ext/card.js, src/ext/freshness.js): an expired head
// changes the wording and never takes the findings away. BACKLOG increment 1, acceptance test 5.
import test from "node:test";
import assert from "node:assert/strict";

await import("../src/ext/core.bundle.js");
await import("../src/ext/signals.js");
await import("../src/ext/card.js");
const { PBSignals, PBCard, PB } = globalThis;
const X = { id: "x", name: "X", hasLocation: true };
const NOW = Date.parse("2026-12-01T00:00:00Z");
const STATE = { version: 3002000, headSha256: "0".repeat(64), maxTime: "2026-10-20T00:00:00Z", seenAt: "2026-10-21T00:00:00Z", expires: "2026-11-01T00:00:00Z", catalogue: { version: "2026.10.20" }, valid: 1, needed: 1 };
const CATALOGUE = { version: "2026.10.20", date: "2026-10-20" };
const model = () => ({ site: X, handle: "a", markers: PB.score("Migrants are vermin").markers, flags: [{ id: "new-account", evidence: "e", doesNotProve: "d" }] });
const flat = (secs) => secs.flatMap((s) => [s.title || "", ...(s.rows || []).map(([h, t]) => `${h} ${typeof t === "string" ? t : JSON.stringify(t)}`), s.foot || ""]).join("\n");

test("5 (card). an expired head keeps every finding on the card and shows the catalogue date", () => {
  const m = model(), signals = PBSignals.all(m);
  assert.ok(signals.length >= 2, "the model has findings to keep");
  const without = PBCard.sections(m, signals);
  globalThis.PBFreshness = { view: PB.freshness(STATE, { now: NOW, catalogue: CATALOGUE }) };
  try {
    assert.equal(globalThis.PBFreshness.view.status, "expired");
    const secs = PBCard.sections(m, signals), text = flat(secs);
    for (const s of signals) assert.ok(secs.some((x) => (x.signals || []).includes(s)), `finding "${s.label}" disappeared from the card`);
    assert.equal(secs.filter((x) => x.signals).length, without.filter((x) => x.signals).length, "the same evidence groups as with no head at all");
    assert.match(text, /Catalogue dated 2026-10-20\. Newer campaigns may be missing\./);
    assert.match(text, /Expired/);
    assert.doesNotMatch(JSON.stringify(secs.find((x) => x.title === "Catalogue")), /"hot"|warn|alarm/i, "calm wording, no alarm mark");
  } finally { delete globalThis.PBFreshness; }
});

test("with no freshness loaded, the card shows no catalogue section and its findings as before", () => {
  const m = model(), signals = PBSignals.all(m);
  const secs = PBCard.sections(m, signals);
  assert.equal(secs.some((x) => x.title === "Catalogue"), false);
  assert.ok(secs.some((x) => (x.signals || []).length));
});
