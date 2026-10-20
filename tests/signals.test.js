// The signal and card logic in src/ext runs in the page, but it is plain data shaping over the core
// bundle, so it is tested here in node with the bundle loaded first.
import test from "node:test";
import assert from "node:assert/strict";

await import("../src/ext/core.bundle.js");
await import("../src/ext/signals.js");
await import("../src/ext/card.js");
const { PBSignals, PBCard, PB } = globalThis;
const X = { id: "x", name: "X", hasLocation: true };

test("strong language, leaked AI text and old media are warn-level; weak flags are info", () => {
  const sig = PBSignals.all({
    site: X, handle: "a", markers: PB.score("Migrants are vermin").markers,
    machine: PB.machineSigns("As an AI language model I cannot do that"),
    tweet: { posted: "2026-10-18T10:00:00.000Z", media: [{ type: "video", url: "u", uploaded: "2019-05-02T00:00:00.000Z" }] },
    flags: [{ id: "default-handle", evidence: "e", doesNotProve: "d" }, { id: "new-account", evidence: "e", doesNotProve: "d" }],
  });
  const by = Object.fromEntries(sig.map((s) => [s.label, s.level]));
  assert.equal(by["dehumanising language"], "warn");
  assert.equal(by["leaked AI text"], "warn");
  assert.equal(by["media from 2019-05-02"], "warn");
  assert.equal(by["new account"], "flag");
  assert.equal(by["sign-up handle"], "info");
  // warn first, then flag, then info
  const order = sig.map((s) => s.level);
  assert.deepEqual(order, [...order].sort((a, b) => ["warn", "flag", "info"].indexOf(a) - ["warn", "flag", "info"].indexOf(b)));
});

test("every signal carries rows, and evidence signals say what they do not prove", () => {
  const sig = PBSignals.all({ site: X, handle: "a", flags: [{ id: "new-account", evidence: "account is 3 days old", doesNotProve: "New accounts include real people." }], markers: [], machine: {} });
  for (const s of sig) assert.ok(s.rows.length && s.rows.every(([h]) => h !== undefined));
  assert.ok(sig[0].rows.some(([h]) => h === "Does not prove"));
});

test("the language chip is dropped when it fits where the account is based", () => {
  const base = { site: X, handle: "a", markers: [], machine: {}, flags: [], writtenIn: "French" };
  assert.ok(!PBSignals.all({ ...base, reading: { basedIn: "France" } }).some((s) => s.label.startsWith("written in")));
  assert.ok(PBSignals.all({ ...base, reading: { basedIn: "Japan" } }).some((s) => s.label.startsWith("written in")));
});

test("the card offers a lookup only while X has not given account data", () => {
  const m = { site: X, handle: "a", markers: [], machine: {}, flags: [] };
  const rows = (sections) => sections.flatMap((s) => s.rows || []);
  assert.ok(rows(PBCard.sections(m, [], () => {})).some(([h, t]) => h === "About this account" && t.action));
  assert.ok(!rows(PBCard.sections({ ...m, reading: { aboutRead: true } }, [], () => {})).some(([h]) => h === "About this account"));
  // and never shows demographics
  const foot = PBCard.sections(m, [], null).find((s) => s.foot);
  assert.match(foot.foot, /does not show or guess demographics/);
});

test("the source trail section reads the upstream steps and the spread", () => {
  const trail = { steps: [{ kind: "quotes", id: "9", handle: "origin", at: "2019-05-02T01:00:00Z" }], media: [{ posts: 4, accounts: 4, first: { id: "9", handle: "origin", at: "2019-05-02T01:00:00Z" }, isFirst: false, sharers: ["origin"] }], links: [] };
  const sec = PBCard.sections({ site: X, handle: "a", trail, markers: [], machine: {}, flags: [] }, [], null).find((s) => s.title === "Source trail");
  const text = sec.rows.map(([h, t]) => `${h} ${typeof t === "string" ? t : ""}`).join(" | ");
  assert.match(text, /Quotes @origin, 2019-05-02 01:00 UTC/);
  assert.match(text, /in 4 posts by 4 accounts/);
});
