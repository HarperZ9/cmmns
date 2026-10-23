// The launch campaign lens (project-docs/CAMPAIGN-LENS.md): units, the positive fixture and the
// controls that must not reach the lead. All fixtures are synthetic (tests/fixtures/campaign-fixtures.js).
import test from "node:test";
import assert from "node:assert/strict";
import { skeleton, templateGroups, personaCues, topicsOf, promoCues, providerFromPack, setPromoTemplateProvider } from "../src/core/campaign-text.js";
import { shapeOf, ownBaseline, engagementShape, position } from "../src/core/campaign-shape.js";
import { sampleSigns, randomSuffix, joinCluster } from "../src/core/campaign-sample.js";
import { quoteCluster, bunching } from "../src/core/campaign-quotes.js";
import { emptyStore, recordLaunch, overlapOf, hashHandle, pruneLaunches, OVERLAP_RETAIN_DAYS } from "../src/core/campaign-overlap.js";
import { campaignLens, CAMPAIGN_LEADS } from "../src/core/campaign.js";
import { farmAccounts, organicAccounts, campaignQuotes, organicQuotes, OWN_POSTS, LAUNCH_COUNTS, ORDINARY_COUNTS, LAUNCH_TEXT, rng, farmBio } from "./fixtures/campaign-fixtures.js";

test("skeleton masks names, places, numbers and cashtags", () => {
  assert.deepEqual(skeleton("A Recruiter in Avalon, stacking $ETH like a pro"), ["SLOT", "SLOT", "in", "SLOT", "stacking", "TOKEN", "like", "a", "pro"]);
  assert.deepEqual(skeleton("Age 42"), ["SLOT", "NUM"]);
});

test("template groups find bios cut from one template and leave varied bios alone", () => {
  const r = rng(5);
  const farm = Array.from({ length: 10 }, (_, i) => ({ id: i, text: farmBio(r, i) }));
  const g = templateGroups(farm);
  assert.equal(g.reduce((s, x) => s + x.size, 0), 10);
  assert.equal(g.length, 2);
  const organic = organicAccounts(24).map((a, i) => ({ id: i, text: a.bio }));
  assert.deepEqual(templateGroups(organic), []);
});

test("persona cues need several families; a single hobby line is not a persona", () => {
  assert.deepEqual(personaCues("Age 42, still young at heart, passionate about Pottery. Crypto is the future. | Cat person").sort(), ["age", "crypto", "filler", "passion", "pet"]);
  assert.ok(personaCues("Passionate about pottery and my cat").length < 3);
});

test("topics: unknown is empty, never a mismatch", () => {
  assert.deepEqual(topicsOf("I like long walks"), []);
  assert.ok(topicsOf("stacking $SOL").includes("crypto"));
  assert.ok(topicsOf(LAUNCH_TEXT).includes("tech"));
});

test("promo provider: local fallback, pack provider, bad patterns skipped, failing provider falls back", () => {
  assert.equal(promoCues("sir... they just dropped a model")[0].source, "radar-local");
  const p = providerFromPack({ version: 1, templates: [{ id: "wow", pattern: "\\bwow\\b", source: "articulate" }, { id: "bad", pattern: "(" }] });
  assert.deepEqual(p.skipped, ["bad"]);
  setPromoTemplateProvider(p);
  try { assert.deepEqual(promoCues("wow look").map((c) => c.id), ["wow"]); } finally { setPromoTemplateProvider(null); }
  setPromoTemplateProvider(() => { throw new Error("boom"); });
  const orig = console.error; console.error = () => {};
  try { assert.equal(promoCues("this is a game changer")[0].id, "game-changer"); } finally { console.error = orig; setPromoTemplateProvider(null); }
});

test("shape ratios and own-account baseline", () => {
  const s = shapeOf(LAUNCH_COUNTS);
  assert.ok(Math.abs(s.repostsPerLike - 5200 / 631) < 1e-9);
  assert.equal(shapeOf({ reposts: 3, likes: 0 }).repostsPerLike, Infinity);
  const own = ownBaseline(LAUNCH_COUNTS, OWN_POSTS);
  assert.equal(own.outlier, true);
  assert.equal(ownBaseline(ORDINARY_COUNTS, OWN_POSTS).outlier, false);
  assert.equal(ownBaseline(LAUNCH_COUNTS, OWN_POSTS.slice(0, 3)).insufficient, true);
});

test("X today has no current baseline: insufficient, with a labelled historical reference", () => {
  const sh = engagementShape("x", LAUNCH_COUNTS, OWN_POSTS);
  assert.equal(sh.currentInsufficient, true);
  assert.match(sh.historical.source, /PHEME/);
  assert.ok(sh.historical.position);
  assert.equal(position(1, { q05: 0.5, q25: 0.8, q50: 1, q75: 2, q95: 5, q99: 9 }), "in the middle half");
  assert.equal(engagementShape("x", { reposts: 2, likes: 3 }, []).tooFew, true);
});

test("random suffix and join clusters", () => {
  for (const h of ["abcd_4k7", "user38", "zq7m4p", "lw3k8r"]) assert.ok(randomSuffix(h), h);
  for (const h of ["janedoe", "pottery_fan", "dataperson"]) assert.ok(!randomSuffix(h), h);
  const jc = joinCluster(["2026-01-01", "2026-01-05", "2026-01-10", "2025-01-01"]);
  assert.equal(jc.n, 3);
});

test("quote cluster: labelled and unlabelled quotes in one template are look-alikes", () => {
  const q = quoteCluster(campaignQuotes(8));
  assert.equal(q.disclosed, 4);
  assert.ok(q.lookalikes >= 3);
  assert.ok(q.bunch.kWindowMs <= 30 * 60000);
  assert.equal(quoteCluster(organicQuotes(8)).lookalikes, 0);
  assert.equal(bunching([]).kWindowMs, null);
});

test("overlap store keeps hashes only, finds repeat amplifiers, prunes and wipes", () => {
  let S = emptyStore("salt-1");
  const farm = farmAccounts(20).map((a) => a.handle);
  for (const id of ["L1", "L2", "L3"]) S = recordLaunch(S, id, farm);
  assert.ok(!JSON.stringify(S).includes(farm[0]), "no handle in storage");
  assert.equal(S.launches.L1.a[0], hashHandle("salt-1", farm[0]));
  const o = overlapOf(S, "L4", farm);
  assert.equal(o.repeat, 20);
  assert.equal(o.indicator, true);
  assert.equal(overlapOf(S, "L4", ["someone_new"]).repeat, 0);
  const later = Date.now() + (OVERLAP_RETAIN_DAYS + 1) * 86400000;
  assert.deepEqual(pruneLaunches(S, later).launches, {});
});

test("positive fixture reaches the lead with several independent families", () => {
  let S = emptyStore("s");
  const accounts = farmAccounts(30);
  for (const id of ["A", "B"]) S = recordLaunch(S, id, accounts.map((a) => a.handle));
  const lens = campaignLens({ platform: "x", post: LAUNCH_COUNTS, ownPosts: OWN_POSTS, accounts, quotes: campaignQuotes(8), overlap: overlapOf(S, "C", accounts.map((a) => a.handle)) });
  assert.equal(lens.status, "strong");
  assert.equal(lens.lead, CAMPAIGN_LEADS.strong);
  for (const f of ["shape", "bios", "joins", "topic", "quotes", "overlap"]) assert.ok(lens.families.includes(f), f);
  for (const row of [...lens.indicators, ...lens.context]) assert.ok(row.dnp && row.dnp.length > 20, `${row.id} has a does-not-prove line`);
  const all = JSON.stringify(lens);
  for (const a of accounts) assert.ok(!all.includes(a.handle), "no handle in the lens output");
  assert.doesNotMatch(all, /\bbots?\b/i);
});

test("control 1: organic fandom launch with bunched quotes is coordination context only", () => {
  const quotes = organicQuotes(8).map((q, i) => ({ ...q, posted: new Date(Date.parse("2026-06-01T15:00:00Z") + i * 5 * 60000).toISOString() }));
  const lens = campaignLens({ platform: "x", post: ORDINARY_COUNTS, ownPosts: OWN_POSTS, accounts: organicAccounts(40), quotes });
  assert.equal(lens.status, "coordinated");
  assert.equal(lens.indicators.length, 0);
});

test("control 2: a diaspora community in another script with random handles has no indicators", () => {
  const r = rng(9);
  const bios = ["東京で働くエンジニア。週末は料理", "ラーメンと写真が好き", "大阪出身、データ分析の仕事", "猫と暮らすデザイナー", "読書と登山", "大学で言語学を研究中", "子育て中のプログラマー", "音楽とコーヒー"];
  const accounts = Array.from({ length: 30 }, (_, i) => ({ handle: `n${Math.floor(r() * 9)}k${Math.floor(r() * 9)}_${i}x${Math.floor(r() * 9)}`, bio: `${bios[i % bios.length]} ${i}`, joinDate: `20${10 + (i % 14)}-0${1 + (i % 9)}-15` }));
  const lens = campaignLens({ platform: "x", post: ORDINARY_COUNTS, ownPosts: OWN_POSTS, accounts, quotes: [] });
  assert.equal(lens.indicators.length, 0, JSON.stringify(lens.indicators));
  assert.ok(lens.context.some((c) => c.id === "random-suffix"));
});

test("control 3: a protest slogan quoted by many old accounts stays below the lead", () => {
  const quotes = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, author: `citizen${i}`, posted: new Date(Date.parse("2026-06-01T15:00:00Z") + i * 4 * 60000).toISOString(), paidPartnership: false, text: "Fund the libraries, keep them open, we stand together" }));
  const lens = campaignLens({ platform: "x", post: ORDINARY_COUNTS, ownPosts: OWN_POSTS, accounts: organicAccounts(30), quotes });
  assert.ok(lens.families.length <= 1);
  assert.notEqual(lens.status, "strong");
});

test("control 4 and 5: thin data and disclosed-only promotion never reach the lead", () => {
  assert.equal(campaignLens({ platform: "x", post: { reposts: 2, likes: 5 }, ownPosts: [], accounts: organicAccounts(4), quotes: [] }).status, "thin");
  const disclosed = organicQuotes(6).map((q) => ({ ...q, paidPartnership: true }));
  const lens = campaignLens({ platform: "x", post: ORDINARY_COUNTS, ownPosts: OWN_POSTS, accounts: organicAccounts(20), quotes: disclosed });
  assert.equal(lens.indicators.length, 0);
  assert.ok(lens.context.some((c) => c.id === "disclosed-paid"));
});

test("platforms without a definition say so and never borrow X's rules", () => {
  for (const p of ["reddit", "instagram", "tiktok", "linkedin", "nowhere"]) {
    const lens = campaignLens({ platform: p, post: LAUNCH_COUNTS, accounts: farmAccounts(30), quotes: campaignQuotes(8) });
    assert.equal(lens.status, "undefined", p);
    assert.equal(lens.indicators.length, 0);
  }
});

test("sample signs need a minimum sample", () => {
  assert.equal(sampleSigns(farmAccounts(5), LAUNCH_TEXT).enough, false);
});

test("accusation ladder, reviewed wording: an organisation is named at steps 1 and 2; a private account never is", async () => {
  const { actorOf, CAMPAIGN_DISPUTE } = await import("../src/core/campaign.js");
  let S = emptyStore("s");
  const accounts = farmAccounts(30);
  for (const id of ["A", "B"]) S = recordLaunch(S, id, accounts.map((a) => a.handle));
  const input = { platform: "x", post: LAUNCH_COUNTS, ownPosts: OWN_POSTS, accounts, quotes: campaignQuotes(8), overlap: overlapOf(S, "C", accounts.map((a) => a.handle)) };
  const org = campaignLens({ ...input, reviewed: true, actor: actorOf({ handle: "examplecorp", verifiedType: "Business" }) });
  assert.ok(org.claims.some((c) => c.step === 1 && c.text.includes("@examplecorp")));
  assert.ok(org.claims.some((c) => c.step === 2 && /consistent with purchased amplification/.test(c.text)));
  assert.ok(org.claims.some((c) => /paid buzz dressed as organic/i.test(c.text)));
  assert.equal(org.dispute, CAMPAIGN_DISPUTE);
  assert.equal(actorOf({ handle: "someperson", verifiedType: "Blue" }), null);
  const priv = campaignLens({ ...input, reviewed: true, actor: actorOf({ handle: "someperson", verifiedType: "Blue" }) });
  assert.ok(!JSON.stringify(priv).includes("someperson"));
  for (const lens of [org, priv]) assert.doesNotMatch(JSON.stringify(lens), /\b(?:bots?|fraud\w*|crim\w*|illegal|scam\w*)\b/i);
});

test("accusation ladder: one sign or coordination alone makes no step-2 claim", () => {
  const one = campaignLens({ platform: "x", post: LAUNCH_COUNTS, ownPosts: OWN_POSTS, accounts: organicAccounts(30), quotes: [] });
  assert.equal(one.status, "one");
  assert.ok(!one.claims.some((c) => c.step === 2));
});

test("Articulate campaign report: input has no handles, report feeds cues, wrong format throws", async () => {
  const { articulateInput, providerFromReport, ARTICULATE_REPORT_FORMAT } = await import("../src/core/campaign-text.js");
  const quotes = campaignQuotes(3);
  const input = articulateInput({ quotes, bios: ["Age 40, cat person"] });
  for (const q of quotes) assert.ok(!JSON.stringify(input).includes(q.author));
  assert.deepEqual(input.map((x) => x.kind), ["post", "post", "post", "bio"]);
  const report = { format: ARTICULATE_REPORT_FORMAT, platform: "x", parameters: {}, summary: {}, persona_groups: [], does_not_prove: "x",
    clusters: [{ ids: ["q:q0", "q:q1"], size: 2, kind: "template", similarity_min: 0.8, similarity_max: 0.9, skeleton: "sir {} just dropped", shared_tokens: 3, fillers: [] }],
    items: [{ id: "q:q0", kind: "post", platform: "x", template: true, score: 4, findings: [{ line: 1, col: 1, start: 0, end: 6, category: "promo", label: "hype opener", match: "sir...", rule_id: "promo.sir-opener", weight: 2, cost: "c", tier: "high" }] },
      { id: "b:0", kind: "bio", platform: "x", template: true, score: 3, findings: [] }] };
  const p = providerFromReport(report, input);
  assert.deepEqual(p(quotes[0].text).cues.map((c) => c.id), ["promo.sir-opener"]);
  assert.equal(p(quotes[0].text).cues[0].source, "articulate");
  assert.equal(p.personaTemplates, 1);
  assert.equal(p.clusters[0].skeleton, "sir {} just dropped");
  assert.equal(p("this is a game changer").cues[0].source, "radar-local");
  assert.throws(() => providerFromReport({ format: "other/2" }, input), /articulate-campaign-report\/1/);
});

test("symmetry: the same campaign structure gives the same finding whatever the topic or side", () => {
  const sides = [
    ["Join the rally for lower taxes and smaller government this weekend", "sir... they just dropped the plan for lower taxes and smaller government"],
    ["Join the rally for higher wages and public healthcare this weekend", "sir... they just dropped the plan for higher wages and public healthcare"],
    ["Our new running shoe is out today, lighter and faster", "sir... they just dropped a running shoe that is lighter and faster"],
  ];
  const out = sides.map(([post, quote]) => {
    const quotes = campaignQuotes(8).map((q) => ({ ...q, text: quote }));
    const lens = campaignLens({ platform: "x", post: { ...LAUNCH_COUNTS, text: post }, ownPosts: OWN_POSTS, accounts: farmAccounts(30), quotes });
    return { status: lens.status, families: lens.families, n: lens.indicators.length };
  });
  assert.deepEqual(out[1], out[0]);
  assert.deepEqual(out[2], out[0]);
});

// Until the media-lawyer review (project-docs/CAMPAIGN-LENS.md), the shipped lens names no one and
// leaves out the blunt line, whatever the launch account discloses; the evidence stays the same.
test("accusation ladder, as shipped: naming is held, so no handle and no blunt line reach the window", async () => {
  const { actorOf, NAMING_HELD } = await import("../src/core/campaign.js");
  assert.equal(NAMING_HELD, true, "flip only with the review's record");
  let S = emptyStore("s");
  const accounts = farmAccounts(30);
  for (const id of ["A", "B"]) S = recordLaunch(S, id, accounts.map((a) => a.handle));
  const input = { platform: "x", post: LAUNCH_COUNTS, ownPosts: OWN_POSTS, accounts, quotes: campaignQuotes(8), overlap: overlapOf(S, "C", accounts.map((a) => a.handle)), actor: actorOf({ handle: "examplecorp", verifiedType: "Business" }) };
  const shipped = campaignLens(input), reviewed = campaignLens({ ...input, reviewed: true });
  assert.equal(shipped.naming, "held");
  assert.ok(!JSON.stringify(shipped).includes("examplecorp"));
  assert.ok(shipped.claims.some((c) => c.step === 1 && c.text.includes("this launch")));
  assert.ok(shipped.claims.some((c) => c.step === 2 && /this launch is consistent with purchased amplification/.test(c.text)));
  assert.ok(!shipped.claims.some((c) => /paid buzz/i.test(c.text)));
  assert.deepEqual(shipped.indicators, reviewed.indicators, "holding the name changes no evidence");
  assert.equal(shipped.status, reviewed.status);
});

// Found on the demo stage, 2026-10-23: 8 quotes spread nine hours apart read as "looks coordinated",
// because any five quotes have a narrowest window. Only five inside an hour count now.
test("control 3: quotes spread over days are timing, not coordination", () => {
  const quotes = organicQuotes(8).map((q, i) => ({ ...q, posted: new Date(Date.parse("2026-06-01T15:00:00Z") + i * 9 * 3600000).toISOString() }));
  // X's created_at gives seconds; quotes on round hours here are synthetic, not rounded.
  const lens = campaignLens({ platform: "x", timePrecision: "second", post: ORDINARY_COUNTS, ownPosts: OWN_POSTS, accounts: organicAccounts(40), quotes });
  assert.equal(lens.status, "none", lens.lead);
  assert.ok(lens.context.some((c) => c.id === "quote-timing"), "the timing is still shown");
  assert.ok(!lens.context.some((c) => c.id === "quote-bunching"));
});
