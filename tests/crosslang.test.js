// Cross-language repetition (src/core/crosslang.js): one link, one upload or one fact-checked claim
// carried by replies in different languages from different accounts. The same rule for every
// language and every account; it describes the material, never the people.
import test from "node:test";
import assert from "node:assert/strict";
import { crossLanguage, scriptOf, langOf, acrossViewed, CROSS_DOES_NOT_PROVE } from "../src/core/crosslang.js";
import { recordSpread } from "../src/core/trail.js";

const r = (id, author, lang, extra = {}) => ({ id, author, lang, text: "", links: [], media: [], claims: [], ...extra });
const L = "https://example.org/story?id=7";

test("one link in two languages from two accounts is a cross-language group", () => {
  const g = crossLanguage([r("1", "a", "en", { links: [L] }), r("2", "b", "fr", { links: [L + "&utm_source=x"] }), r("3", "c", "en")]);
  assert.equal(g.length, 1);
  assert.deepEqual(g[0].langs, ["en", "fr"]);
  assert.equal(g[0].kind, "link");
  assert.equal(g[0].accounts, 2);
  assert.deepEqual(g[0].ids, ["1", "2"]);
});

test("one account in two languages, or many accounts in one language, is not", () => {
  assert.deepEqual(crossLanguage([r("1", "a", "en", { links: [L] }), r("2", "a", "fr", { links: [L] })]), []);
  assert.deepEqual(crossLanguage([r("1", "a", "en", { links: [L] }), r("2", "b", "en", { links: [L] }), r("3", "c", "en", { links: [L] })]), []);
  // A and B both in English, A also in French: no two accounts differ in language
  assert.deepEqual(crossLanguage([r("1", "a", "en", { links: [L] }), r("2", "a", "fr", { links: [L] }), r("3", "b", "en", { links: [L] })]), []);
});

test("the same upload and the same fact-checked claim count as one item across languages", () => {
  const m = { url: "https://pbs.twimg.com/media/ABC.jpg" };
  const g = crossLanguage([r("1", "a", "ru", { media: [m] }), r("2", "b", "uk", { media: [m] }), r("3", "c", "de", { claims: [{ url: "https://fc.example/1" }] }), r("4", "d", "es", { claims: [{ url: "https://fc.example/1" }] })]);
  assert.deepEqual(g.map((x) => x.kind).sort(), ["claim", "media"]);
  // media lifted from another post points upstream; it is the same file only through the trail
  assert.deepEqual(crossLanguage([r("1", "a", "ru", { media: [{ fromPost: "9" }] }), r("2", "b", "uk", { media: [{ fromPost: "9" }] })]), []);
});

test("without a platform language, a distinct script stands in; Latin text stays unknown", () => {
  assert.equal(scriptOf("שלום לכולם"), "Hebr");
  assert.equal(scriptOf("سلام به همه"), "Arab");
  assert.equal(scriptOf("こんにちは皆さん"), "Jpan");
  assert.equal(scriptOf("안녕하세요 여러분"), "Kore");
  assert.equal(scriptOf("大家好"), "Hani");
  assert.equal(scriptOf("hello everyone"), null);
  assert.equal(langOf({ lang: null, text: "привет всем" }), "script:Cyrl");
  // a group with any platform language uses only platform languages
  const g = crossLanguage([r("1", "a", "fa", { links: [L] }), r("2", "b", null, { text: "سلام", links: [L] })]);
  assert.deepEqual(g, []);
  const s = crossLanguage([r("1", "a", null, { text: "שלום עולם", links: [L] }), r("2", "b", null, { text: "مرحبا بالعالم", links: [L] })]);
  assert.equal(s.length, 1);
  assert.equal(s[0].basis, "script");
});

test("symmetry: every language pair and every account name gets the same answer", () => {
  const langs = ["en", "fr", "ru", "uk", "ar", "he", "fa", "tr", "ko", "ja", "id", "hi", "zh", "de", "es"];
  for (const a of langs) for (const b of langs) {
    const got = crossLanguage([r("1", "x" + a, a, { links: [L] }), r("2", "y" + b, b, { links: [L] })]).length;
    assert.equal(got, a === b ? 0 : 1, `${a}/${b}`);
  }
  assert.match(CROSS_DOES_NOT_PROVE, /translat/i);
});

test("across viewed threads: the trail log keeps each post's language", () => {
  const tw = (id, author, lang) => ({ id, author, lang, posted: `2026-10-0${id}T00:00:00Z`, links: [L], media: [] });
  const log = recordSpread(null, [tw("1", "a", "en"), tw("2", "b", "ja"), tw("3", "c", "en")]);
  const x = acrossViewed(tw("3", "c", "en"), log);
  assert.equal(x.length, 1);
  assert.deepEqual(x[0].langs, ["en", "ja"]);
  assert.equal(x[0].accounts, 3);
  assert.equal(x[0].across, true);
  assert.deepEqual(acrossViewed(tw("4", "d", "en"), recordSpread(null, [tw("1", "a", "en"), tw("2", "b", "en")])), []);
});

test("older platform codes for one language are the same language", () => {
  assert.deepEqual(crossLanguage([r("1", "a", "in", { links: [L] }), r("2", "b", "id", { links: [L] })]), []);
  assert.deepEqual(crossLanguage([r("1", "a", "iw", { links: [L] }), r("2", "b", "he", { links: [L] })]), []);
});

test("the root post's own link or upload, carried on in other languages, is not a group", () => {
  const rows = [r("1", "a", "en", { links: [L] }), r("2", "b", "ja", { links: [L] })];
  assert.equal(crossLanguage(rows).length, 1);
  assert.deepEqual(crossLanguage(rows, { root: { links: [L], media: [] } }), []);
});
