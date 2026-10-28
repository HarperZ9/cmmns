// Neutral by test (project-docs/VISION.md, "Jurisdiction and the open catalogue"): the same campaign
// structure gives the same element tables whatever the post is about or which side it argues. And no
// catalogue text CMMNS wrote names a party, a side or a topic.
import test from "node:test";
import assert from "node:assert/strict";
import { elementTables, signalsFromCampaign } from "../src/core/definitions.js";
import { campaignLens } from "../src/core/campaign.js";
import { emptyStore, recordLaunch, overlapOf } from "../src/core/campaign-overlap.js";
import { farmAccounts, campaignQuotes, OWN_POSTS, LAUNCH_COUNTS } from "./fixtures/campaign-fixtures.js";
import { loadCatalogue } from "./fixtures/catalogue.js";

const { registry, list } = loadCatalogue();

// Paired topics on opposite sides, plus a product with no side.
const TOPICS = [
  "Join us: cut income taxes for every family this year.",
  "Join us: raise the minimum wage for every worker this year.",
  "Vote to tighten immigration limits next spring.",
  "Vote to widen refugee protections next spring.",
  "Our church opens its new community hall on Sunday.",
  "Our secular humanist society opens its new community hall on Sunday.",
  "Introducing our new running shoe, lighter than ever.",
];

function tablesFor(postText, quoteText) {
  let S = emptyStore("s");
  const accounts = farmAccounts(30);
  for (const id of ["A", "B"]) S = recordLaunch(S, id, accounts.map((a) => a.handle));
  const quotes = campaignQuotes(8).map((q) => (quoteText ? { ...q, text: q.text.replace(/a data platform.*$/, quoteText) } : q));
  const lens = campaignLens({ platform: "x", post: { ...LAUNCH_COUNTS, text: postText }, ownPosts: OWN_POSTS, accounts, quotes, overlap: overlapOf(S, "C", accounts.map((a) => a.handle)) });
  const tables = elementTables(list, signalsFromCampaign(lens), registry);
  return tables.map((t) => ({ entry: t.entry, matched: t.matched, notObservable: t.notObservable, notMatched: t.notMatched, summary: t.summary }));
}

test("the same campaign structure gives the same tables on every topic and side", () => {
  const base = tablesFor(TOPICS[0]);
  assert.ok(base.some((t) => t.matched.length), "the fixture matches something, so equality is not vacuous");
  for (const topic of TOPICS.slice(1)) assert.deepEqual(tablesFor(topic), base, topic);
});

test("the quote wording's topic does not change the tables either", () => {
  const a = tablesFor(TOPICS[6], "a tax cut that changes everything for families");
  const b = tablesFor(TOPICS[6], "a wage rise that changes everything for families");
  assert.deepEqual(a, b);
});

test("CMMNS' own catalogue text names no party, side or topic", () => {
  const SIDE = /\b(?:left|right[- ]wing|liberal|conservative|progressive|democrat\w*|republican\w*|labour|tory|tories|socialist|maga|woke|leftist|immigra\w*|abortion|religio\w*|christian|muslim|jewish|islam\w*)\b/i;
  for (const e of list) {
    const own = [e.title, e.binding_note, e.does_not_prove, ...e.elements.flatMap((el) => [el.label, el.note || ""])].join("\n");
    assert.doesNotMatch(own, SIDE, e.id);
  }
  for (const s of registry.signals) assert.doesNotMatch(`${s.observes}`, SIDE, s.id);
});
