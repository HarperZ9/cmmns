// radar-core (src/core/api.js): every output fits schema/evidence.v1.json, every item says what it
// shows, its source and what it does not prove, and no output names an account.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeThread, analyzeText, checkMedia, siteInfo, useData, API_VERSION, EVIDENCE_SCHEMA } from "../src/core/api.js";
import { validate } from "../bin/lib/jsonschema.mjs";

const SCHEMA = JSON.parse(readFileSync(new URL("../schema/evidence.v1.json", import.meta.url), "utf8"));
const THREAD = JSON.parse(readFileSync(new URL("./fixtures/integration/thread.json", import.meta.url), "utf8"));
const NOW = Date.parse("2026-10-02T00:00:00Z");
const kinds = (r) => r.evidence.map((e) => e.kind);
const fits = (r) => assert.deepEqual(validate(SCHEMA, r), [], "fits the schema");

test("a thread gives the coordination, language, link and account evidence it holds", () => {
  const r = analyzeThread(THREAD, { now: NOW });
  fits(r);
  assert.equal(r.schema, EVIDENCE_SCHEMA);
  assert.equal(r.api, API_VERSION);
  assert.equal(r.posts.n, 15);
  assert.equal(r.posts.accounts, 14);
  for (const k of ["thread-report", "same-text", "timing-burst", "strong-language", "leaked-ai", "lookalike-domain", "account-flag"]) assert.ok(kinds(r).includes(k), k);
  const burst = r.evidence.find((e) => e.kind === "timing-burst");
  assert.deepEqual(burst.posts, ["100", "101", "102", "103", "104"]);
  assert.match(burst.shows, /5 accounts replied within 8 s/);
  const same = r.evidence.filter((e) => e.kind === "same-text").map((e) => e.posts.length).sort();
  assert.deepEqual(same, [5, 6]);
});

test("every item states what it shows, where it came from and what it does not prove", () => {
  const r = analyzeThread(THREAD, { now: NOW });
  for (const e of r.evidence) {
    for (const k of ["label", "shows", "source", "doesNotProve"]) assert.ok(e[k] && e[k].length > 8, `${e.kind} ${k}`);
    assert.doesNotMatch(e.shows + e.doesNotProve + e.label, /\bbot\b|propagandist|extremist|undefined|NaN/i, e.kind);
  }
  assert.deepEqual(r.evidence.map((e) => e.id), r.evidence.map((_, i) => "e" + (i + 1)));
});

test("no output names an account: items point at posts by id", () => {
  const text = JSON.stringify(analyzeThread(THREAD, { now: NOW }));
  for (const r of THREAD.replies) assert.ok(!text.includes(`"${r.author}"`) && !text.includes(`@${r.author}`), r.author);
  assert.ok(!text.includes("council\""), "the root author is not named");
});

test("spans locate the matched words in the post", () => {
  const r = analyzeThread(THREAD, { now: NOW });
  const byId = new Map(THREAD.replies.map((p) => [p.id, p.text]));
  const spans = r.evidence.flatMap((e) => e.spans).filter((s) => s.start != null);
  assert.ok(spans.length >= 2);
  for (const s of spans) assert.equal(byId.get(s.post).slice(s.start, s.end), s.text);
});

test("account details given as data become flags through Daylight Commons' own rules", () => {
  const r = analyzeThread({ site: "X", replies: [{ id: "1", author: "a", text: "hello there", account: { joinDate: "2026-09-25", handle: "a" } }] }, { now: NOW });
  fits(r);
  assert.ok(r.evidence.some((e) => e.kind === "account-flag" && e.data.flag === "new-account"));
});

test("one account gives no thread comparisons, and an empty thread still fits the schema", () => {
  const one = analyzeThread({ replies: [{ id: "1", author: "a", text: "x" }, { id: "2", author: "a", text: "x" }] });
  assert.ok(!kinds(one).some((k) => ["same-text", "timing-burst", "swarming"].includes(k)));
  fits(analyzeThread({ replies: [] }));
  fits(analyzeThread(null));
});

test("analyzeText reads one text: language, persuasion, machine and spam signs", () => {
  const r = analyzeText("As an AI language model I cannot help. DM me for a crypto giveaway. Hang them all.");
  fits(r);
  assert.deepEqual(kinds(r).sort(), ["leaked-ai", "spam-pattern", "strong-language"]);
  assert.equal(r.posts.n, 1);
  fits(analyzeText(""));
});

test("siteInfo reads only the tables it was given, and says so when it has none", () => {
  const bare = siteInfo("https://www.washingtonpost.pm/a");
  fits(bare);
  assert.equal(bare.site.domain, "washingtonpost.pm");
  assert.deepEqual(kinds(bare), ["lookalike-domain"]);
  assert.match(bare.limits.join(" "), /No site tables were loaded/);
  assert.equal(siteInfo(""), null);
  const ext = (f) => JSON.parse(readFileSync(new URL(`../src/ext/${f}`, import.meta.url), "utf8"));
  useData({ sites: ext("sites.json"), owners: ext("owners.json"), state: ext("state.json") });
  const rt = siteInfo("rt.com");
  fits(rt);
  for (const k of ["state-link", "site-owner", "site-record"]) assert.ok(kinds(rt).includes(k), k);
  assert.ok(rt.evidence.every((e) => !/undefined/.test(e.shows)), "every state link reads in full");
});

test("checkMedia reports credentials and AI metadata in the card's words", async () => {
  const load = (f) => new Uint8Array(readFileSync(new URL(`./fixtures/c2pa/${f}`, import.meta.url)));
  const ai = await checkMedia(load("ai.jpg"));
  fits(ai);
  assert.equal(ai.media.ai, true);
  assert.ok(kinds(ai).includes("credentials-ai"));
  const plain = await checkMedia(load("plain.jpg"));
  fits(plain);
  assert.deepEqual(kinds(plain), ["no-credentials"]);
  assert.equal((await checkMedia(load("tampered.jpg"))).media.state, "changed");
});
