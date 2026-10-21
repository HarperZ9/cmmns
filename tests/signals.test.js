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

test("the card's posting section reads the saved pattern", () => {
  const pattern = { posts: 96, from: "2026-10-15T00:00:00Z", to: "2026-10-18T23:00:00Z", days: 4, perDay: 24, reposts: 0.1, replies: 0, quotes: 0, media: 0.2, clients: [{ name: "Buffer", share: 1 }], langs: [{ lang: "en", share: 1 }], medianGapSec: 3600, activeUtcHours: 24 };
  const sec = PBCard.sections({ site: X, handle: "a", reading: { pattern }, markers: [], machine: {}, flags: [] }, [], null).find((s) => s.title === "How it posts");
  const text = sec.rows.map(([h, t]) => `${h}: ${t}`).join(" | ");
  assert.deepEqual(sec.rows.find(([h]) => h === "Sent from")[1], { stack: [{ label: "Buffer", share: 1 }] });
  assert.equal(sec.rows.find(([h]) => h === "Posts by hour")[1], null, "no histogram without hourHist");
  assert.match(text, /60 min between posts/);
  assert.match(text, /24 of 24 UTC hours across 4 days/);
});

test("areas: strongest level per area, none where nothing was found", () => {
  const sig = PBSignals.all({ site: X, handle: "a", markers: PB.score("Migrants are vermin").markers, machine: {}, flags: [{ id: "new-account", evidence: "e", doesNotProve: "d" }] });
  const a = Object.fromEntries(PBSignals.areas(sig).map((x) => [x.id, x.level]));
  assert.equal(a.language, "warn");
  assert.equal(a.account, "flag");
  assert.equal(a.place, "none");
  assert.deepEqual(PBSignals.AREAS.map(([id]) => id), ["place", "account", "posting", "coordination", "language", "sources", "media"]);
});

test("overview groups signals by area; comparison needs five accounts read", () => {
  const sig = PBSignals.all({ site: X, handle: "a", markers: [], machine: {}, flags: [{ id: "new-account", evidence: "e", doesNotProve: "d" }, { id: "automation-app", evidence: "e", doesNotProve: "d" }] });
  const base = { site: X, handle: "a", markers: [], machine: {}, flags: [], reading: { joinDate: new Date(Date.now() - 11 * 86400000).toISOString().slice(0, 10), basedIn: "France" } };
  const secs = PBCard.sections({ ...base, thread: { n: 20, medianAgeDays: 2400, places: { France: 12 }, flagged: 3 } }, sig, null);
  assert.deepEqual(secs.filter((s) => s.area).map((s) => s.area), ["account", "posting"]);
  const cmp = secs.find((s) => s.title === "Compared with this thread").rows.map(([h, t]) => `${h}: ${t}`).join(" | ");
  assert.match(cmp, /11 days; the median in this thread is 2,400/);
  assert.match(cmp, /12 of 20 accounts read in this thread are labelled France/);
  assert.deepEqual(PBCard.sections({ ...base, thread: { n: 3, medianAgeDays: 1, places: {}, flagged: 0 } }, sig, null).find((s) => s.title === "Compared with this thread").rows, []);
});

// A home or search timeline is not a conversation: live check 2026-10-21 showed "the thread's
// median" in the window on x.com/home.
test("on a feed the comparison speaks of the page, not a thread", () => {
  const base = { site: X, handle: "a", markers: [], machine: {}, flags: [], reading: { joinDate: "2020-01-01", basedIn: "France" } };
  const secs = PBCard.sections({ ...base, thread: { feed: true, n: 20, medianAgeDays: 2400, places: { France: 2 }, flagged: 3 } }, [], null);
  const sec = secs.find((s) => s.title === "Compared with this page");
  const text = sec.rows.map(([h, t]) => `${h}: ${t}`).join(" | ");
  assert.match(text, /median on this page/);
  assert.doesNotMatch(text, /thread/);
});

test("a persuasion technique is an info-level language entry with its words, definition, limit and measurement", () => {
  const persuasion = PB.persuasion("What a disgusting smear.", ["loaded-language"]);
  const sig = PBSignals.all({ site: X, handle: "a", markers: [], machine: {}, flags: [], persuasion });
  const s = sig.find((x) => x.fam === "loaded-language");
  assert.equal(s.label, "persuasion: loaded language");
  assert.equal(s.level, "info");
  assert.equal(s.cat, "language");
  const rows = Object.fromEntries(s.rows);
  assert.equal(rows["In this post"], "\"disgusting\"");
  assert.match(rows["What it is"], /emotional charge/);
  assert.equal(rows["Does not prove"], "A technique can carry a true claim; it describes how the post argues.");
  assert.match(rows.Measured, /precision \d+% \(95% interval \d+ to \d+%\)/);
});

test("a persuasion entry never becomes an account flag", () => {
  const persuasion = PB.persuasion("Everyone knows it, before it's too late.", ["bandwagon", "appeal-to-fear"]);
  assert.equal(persuasion.length, 2);
  assert.equal(PB.isFlagged([]), false);
  const sig = PBSignals.all({ site: X, handle: "a", markers: [], machine: {}, flags: [], persuasion });
  assert.ok(sig.filter((x) => x.fam === "bandwagon" || x.fam === "appeal-to-fear").every((x) => x.level === "info" && x.cat === "language"));
});
