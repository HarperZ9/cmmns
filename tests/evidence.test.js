// Evidence cards: a thread-level card to save or share. It carries the thread report, fact-check
// matches, media and site context, its sources and what it does not prove, and a content hash.
// It never names an account, and it is refused for a thread with too few accounts to be about
// more than one person.
import test from "node:test";
import assert from "node:assert/strict";
import { canonicalJSON } from "../src/core/sig.js";
import { evidenceCard, sealCard, verifyCard, cardLines, MIN_CARD_ACCOUNTS } from "../src/core/evidence.js";

const report = { replies: 40, lookedUp: 30, notLookedUp: 10, verdict: "no-clear-difference", sentence: "3 of 12 extreme replies (25%) come from flagged accounts, against 4 of 18 other replies (22%). The difference is within the uncertainty.",
  extreme: { n: 12, flagged: 3, share: 0.25, ci: [0.09, 0.53] }, others: { n: 18, flagged: 4, share: 0.22, ci: [0.09, 0.45] },
  bursts: [{ authors: ["alice_1", "bob_2", "carol_3"], from: "2026-10-20T10:00:00Z", to: "2026-10-20T10:00:30Z", p: 0.001 }],
  machine: { n: 2 }, upstream: { accounts: [{ handle: "source_acct", n: 3 }], domains: [], uploads: 4, recycled: 1 }, groups: [{ a: "alice_1", b: "bob_2", n: 3 }] };
const authors = ["alice_1", "bob_2", "carol_3", "dave_4", "erin_5", "frank_6"];
const input = (over = {}) => ({ tool: "Daylight Commons test", savedAt: "2026-10-20T12:00:00.000Z", site: "X", page: "https://x.com/someone/status/123", thread: true, authors, report, sameText: 1,
  claims: [{ claim: "A claim the checker reviewed", rating: "False", checker: "Checker", url: "https://check.example/1", date: "2026-10-01", coverage: 0.9 }],
  sites: [{ domain: "rt.com", n: 3, owner: null, state: ["State-owned (Russia)"] }], ...over });

test("a card is refused for a page that is not a thread", () => {
  const c = evidenceCard(input({ thread: false }));
  assert.equal(c.ok, false);
  assert.match(c.reason, /thread/);
});

test("a card is refused when the thread has too few accounts to be about more than one person", () => {
  const c = evidenceCard(input({ authors: authors.slice(0, MIN_CARD_ACCOUNTS - 1) }));
  assert.equal(c.ok, false);
  assert.match(c.reason, /accounts/);
});

test("a card names no account anywhere, only counts", () => {
  const c = evidenceCard(input());
  assert.equal(c.ok, true);
  const text = JSON.stringify(c.card);
  for (const h of [...authors, "source_acct", "someone"]) assert.ok(!text.toLowerCase().includes(h), `card mentions ${h}`);
  assert.equal(c.card.report.timingBursts, 1);
  assert.equal(c.card.report.sameTextGroups, 1);
  assert.equal(c.card.media.recycledUploads, 1);
  assert.equal(c.card.thread.page, "https://x.com/i/status/123");
});

test("every card carries sources and does-not-prove lines", () => {
  const { card } = evidenceCard(input());
  assert.ok(card.sources.length >= 3);
  assert.ok(card.doesNotProve.length >= 3);
  assert.ok(card.doesNotProve.some((l) => /one reply or account/.test(l)));
  assert.ok(card.sources.some((l) => /ClaimReview/.test(l)));
});

test("the content hash is stable under key order and changes with the content", async () => {
  assert.equal(canonicalJSON({ b: 1, a: [2, { d: 3, c: 4 }] }), '{"a":[2,{"c":4,"d":3}],"b":1}');
  const { card } = evidenceCard(input());
  const one = await sealCard(card), two = await sealCard(JSON.parse(JSON.stringify(card)));
  assert.equal(one.hash.value, two.hash.value);
  assert.match(one.hash.value, /^[0-9a-f]{64}$/);
  assert.equal(await verifyCard(one), true);
  const tampered = { ...one, report: { ...one.report, replies: 41 } };
  assert.equal(await verifyCard(tampered), false);
});

test("the PNG lines lead with the report and end with the limits; the hash stays in the JSON", async () => {
  const sealed = await sealCard(evidenceCard(input()).card);
  const lines = cardLines(sealed);
  assert.equal(lines[0].kind, "title");
  assert.ok(lines.some((l) => l.text.includes(report.sentence)));
  assert.ok(lines.some((l) => l.kind === "limit"));
  assert.ok(lines.every((l) => !l.text.includes(sealed.hash.value.slice(0, 16)) && l.kind !== "hash"), "no hash in the image");
  assert.match(lines[lines.length - 1].text, /JSON file saved with this image/);
});

test("checked media goes on the card as credential states, never as a signer's name", async () => {
  const media = [
    { found: true, checks: { signature: { ok: true }, binding: { ok: true } }, aiAnywhere: true, active: { cert: { subject: "Signer Org" } } },
    { found: true, checks: { signature: { ok: false } } },
    { found: false, meta: {} },
  ];
  const { card } = evidenceCard(input({ media }));
  assert.deepEqual(card.media.credentials, { checked: 3, unchanged: 1, changed: 1, unchecked: 0, none: 1, ai: 1 });
  assert.ok(!JSON.stringify(card).includes("Signer Org"));
  assert.ok(card.doesNotProve.some((l) => /signing tool declared/.test(l)));
  assert.ok(cardLines(card).some((l) => /3 files checked/.test(l.text)));
  assert.equal(evidenceCard(input()).card.media.credentials, null);
});

test("a thread with too few extreme replies prints no interval for them", async () => {
  const few = { ...report, verdict: "too-few", extreme: { n: 1, flagged: 1, share: 1, ci: [0.21, 1] } };
  const lines = cardLines(evidenceCard(input({ report: few })).card);
  assert.ok(!lines.some((l) => /95% interval/.test(l.text)));
});
