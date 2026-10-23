// The definition catalogue (project-docs/DEFINITION-CATALOGUE.md): every entry passes the rule, every
// signal it cites exists, and the element tables say "matches elements A and B of [definition]"
// without ever turning a comparison into a verdict.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { entryProblems, OFFICIAL_HOSTS } from "../src/core/definitions-schema.js";
import { elementTable, elementTables, elementRow, signalsFromCampaign, applicableJurisdictions, verdictHits, generatedText, VERDICT_WORDS, LEGAL_NOTE } from "../src/core/definitions.js";
import { campaignLens, actorOf } from "../src/core/campaign.js";
import { emptyStore, recordLaunch, overlapOf } from "../src/core/campaign-overlap.js";
import { farmAccounts, campaignQuotes, OWN_POSTS, LAUNCH_COUNTS } from "./fixtures/campaign-fixtures.js";
import { loadCatalogue, byId, CATALOGUE_DIR } from "./fixtures/catalogue.js";

const { entries, registry, list } = loadCatalogue();
const ids = new Set(list.map((e) => e.id));

function strongLens(actor = null) {
  let S = emptyStore("s");
  const accounts = farmAccounts(30);
  for (const id of ["A", "B"]) S = recordLaunch(S, id, accounts.map((a) => a.handle));
  return campaignLens({ platform: "x", post: LAUNCH_COUNTS, ownPosts: OWN_POSTS, accounts, quotes: campaignQuotes(8), overlap: overlapOf(S, "C", accounts.map((a) => a.handle)), actor });
}
const allSignals = { signals: registry.signals.map((s) => ({ id: s.id, ref: `test:${s.id}` })) };

test("every catalogue entry passes the entry rule", () => {
  assert.ok(entries.length >= 15);
  assert.equal(ids.size, entries.length, "ids are unique");
  for (const { file, entry } of entries) assert.deepEqual(entryProblems(entry, { registry, ids, file }), [], file);
});

test("the rule refuses an unofficial source, an unknown signal, a context-only signal and quotes on an unverified entry", () => {
  const e = structuredClone(byId(list, "us-ftc-fake-social-media-indicators"));
  e.sources[0].url = "https://example.com/law";
  e.elements[0].signals.push("no-such-signal", "random-suffix");
  const p = entryProblems(e, { registry, ids });
  assert.ok(p.some((x) => /official source host/.test(x)));
  assert.ok(p.some((x) => /unknown signal no-such-signal/.test(x)));
  assert.ok(p.some((x) => /random-suffix is context only/.test(x)));
  const u = { ...structuredClone(byId(list, "uk-fraud-act-2006-s2")), verification: "unverified" };
  assert.ok(entryProblems(u, { registry, ids }).some((x) => /unverified entry must not carry quotes/.test(x)));
  assert.ok(!OFFICIAL_HOSTS.includes("wikipedia.org"));
});

test("the signal registry: unique ids, campaign signals exist in the lens, context-only never cited", () => {
  const rids = registry.signals.map((s) => s.id);
  assert.equal(new Set(rids).size, rids.length);
  const lensSrc = readFileSync(join(CATALOGUE_DIR, "..", "src", "core", "campaign.js"), "utf8");
  for (const s of registry.signals.filter((x) => /campaign\.js \(campaign lens\)/.test(x.source))) assert.ok(lensSrc.includes(`"${s.id}"`), `${s.id} is a campaign lens row id`);
  const cited = new Set(list.flatMap((e) => e.elements.flatMap((el) => el.signals)));
  for (const s of registry.signals.filter((x) => x.context_only)) assert.ok(!cited.has(s.id), `${s.id} is never cited`);
});

test("the positive campaign fixture matches the visible elements of 16 CFR 465.8 and no more", () => {
  const lens = strongLens();
  assert.equal(lens.status, "strong");
  const t = elementTable(byId(list, "us-ftc-fake-social-media-indicators"), signalsFromCampaign(lens), registry);
  assert.deepEqual(t.matched, ["A", "B", "F"]);
  assert.deepEqual(t.notObservable, ["D", "E"]);
  assert.deepEqual(t.notMatched, ["C"]);
  assert.match(t.summary, /^This conduct matches elements A, B and F of 16 CFR 465\.8\(b\)/);
  assert.match(t.summary, /Element B is matched on indicative evidence: signals consistent with it\./);
  assert.match(t.summary, /Elements D and E are outside what this page can show\./);
  assert.match(t.summary, /Findings belong to courts, regulators and the platform\./);
  assert.equal(t.catalogue, "us-ftc-fake-social-media-indicators@1.0.0");
  assert.equal(t.legal_note, LEGAL_NOTE);
  const b = t.rows.find((r) => r.id === "B");
  assert.ok(b.evidence.length >= 4 && b.evidence.every((e) => e.refs[0].startsWith("campaign:")), "each match carries its evidence reference");
});

test("one signal family is not enough for an indicative element that needs two", () => {
  const t = elementTable(byId(list, "us-ftc-fake-social-media-indicators"), { signals: [{ id: "bio-template", ref: "r1" }, { id: "stock-persona", ref: "r2" }] }, registry);
  const b = t.rows.find((r) => r.id === "B");
  assert.equal(b.status, "not-matched");
  assert.equal(b.families, 1, "bio-template and stock-persona are one family");
  assert.match(t.summary, /Element B has 1 of the 2 independent signal families it needs/);
});

test("a not-observable element is never matched, whatever the signals", () => {
  const row = elementRow({ id: "D", label: "Knew they were fake", observable_from: "not-observable", strength: "direct", signals: ["bio-template"] }, new Map([["bio-template", ["r"]]]), new Map());
  assert.equal(row.status, "not-observable");
  assert.deepEqual(row.evidence, []);
});

test("word ban: no table Daylight Commons can build says committed, guilty, is fraud or any verdict", () => {
  for (const sample of ["committed fraud", "This is fraud", "guilty", "violated the rule", "illegal", "liable", "a crime", "in breach"]) assert.ok(verdictHits(sample).length, sample);
  for (const finding of [allSignals, { signals: [] }, signalsFromCampaign(strongLens(actorOf({ handle: "examplecorp", verifiedType: "Business" })))]) {
    for (const e of list) {
      const t = elementTable(e, finding, registry);
      assert.deepEqual(verdictHits(generatedText(t)), [], `${e.id}: ${verdictHits(generatedText(t))}`);
      assert.doesNotMatch(t.summary, VERDICT_WORDS);
      assert.doesNotMatch(t.summary, /\b(?:is met|was met|meets|satisf(?:y|ies|ied)|proves?|proven)\b/i);
    }
  }
});

test("fraud definitions are shown for comparison and never have every element matched", () => {
  for (const id of ["uk-fraud-act-2006-s2", "us-wire-fraud-18usc1343"]) {
    const e = byId(list, id);
    assert.equal(e.role, "comparison");
    const t = elementTable(e, allSignals, registry);
    assert.ok(t.notObservable.length >= 3, `${id}: intent and knowledge stay not observable`);
    assert.match(t.summary, /^For comparison: /);
  }
  for (const e of list) {
    const t = elementTable(e, allSignals, registry);
    const unseenRequired = t.rows.filter((r) => r.required && r.status !== "matched");
    if (unseenRequired.length) assert.doesNotMatch(t.summary, /\b(?:all|every) (?:listed |required )?elements? (?:match|are matched)\b/i, e.id);
  }
});

test("an unverified or withdrawn entry is never matched", () => {
  const e = byId(list, "us-ftc-endorsement-material-connection");
  assert.equal(elementTable({ ...e, verification: "unverified", quotes: [] }, allSignals, registry), null);
  assert.equal(elementTable({ ...e, status: "withdrawn" }, allSignals, registry), null);
});

test("jurisdictions: every one that applies is shown, the actor's absence is said, order is fixed", () => {
  const j = applicableJurisdictions({ platform: "x", actor: null, audience: "EU" });
  assert.deepEqual(j.jurisdictions.map((x) => x.code), ["platform:x", "EU"]);
  assert.match(j.notes[0], /actor's location is private/);
  const finding = signalsFromCampaign(strongLens());
  const t1 = elementTables(list, finding, registry, { jurisdictions: j.jurisdictions });
  assert.ok(t1.every((t) => ["EU", "platform:x"].includes(t.jurisdiction.code)));
  assert.ok(t1.some((t) => t.jurisdiction.code === "EU") && t1.some((t) => t.jurisdiction.code === "platform:x"));
  const t2 = elementTables([...list].reverse(), finding, registry, { jurisdictions: ["EU", "platform:x"] });
  assert.deepEqual(t1.map((t) => t.entry), t2.map((t) => t.entry), "order does not depend on input order");
  const uk = elementTables(list, finding, registry, { jurisdictions: ["UK"] });
  assert.ok(uk.some((t) => t.entry === "uk-fraud-act-2006-s2"), "UK covers England and Wales, and Northern Ireland");
  const all = elementTables(list, finding, registry);
  assert.equal(all.length, list.length);
});

test("every table carries its source, retrieval date, hash, quotes and does-not-prove line", () => {
  for (const t of elementTables(list, allSignals, registry)) {
    assert.match(t.source.url, /^https:\/\//);
    assert.match(t.source.retrieved_at, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(t.source.sha256, /^[0-9a-f]{64}$/);
    assert.ok(t.quotes.length && t.quotes.every((q) => q.text.length > 20));
    assert.ok(t.dnp.length > 40);
    assert.match(t.challenge, /template=challenge\.yml/);
  }
});

test("the catalogue changelog names every entry at its current version", () => {
  const log = readFileSync(join(CATALOGUE_DIR, "CHANGELOG.md"), "utf8");
  for (const e of list) assert.ok(log.includes(`${e.id}@${e.version}`), `${e.id}@${e.version} in catalogue/CHANGELOG.md`);
});

test("refetch helpers: quotes are found across list labels and ellipses, and a changed word is not", async () => {
  const { htmlText, quoteFound } = await import("../scripts/catalogue-refetch.mjs");
  const text = htmlText("<p>(1) A person is in breach if he&#x2014;</p><p>(a) dishonestly makes a false representation, and</p><p>(b) intends a gain.</p>");
  assert.ok(quoteFound("(1) A person is in breach if he— (a) dishonestly makes a false representation, and (b) intends a gain.", text));
  assert.ok(!quoteFound("(a) carelessly makes a false representation", text));
  assert.ok(quoteFound("A person is in breach … intends a gain.", text));
});
