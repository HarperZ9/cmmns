// The word lists derived from labelled corpora (Hebrew, Turkish, Korean, Japanese, Persian,
// Indonesian, Hindi). Every language is checked, shipped or held back: the same sentence about any
// group gets the same signs, neutral and policy sentences get none, no group or public name is a
// term, and each script's Unicode handling holds.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { score } from "../src/core/rhetoric.js";
import { DERIVED, DERIVED_SHIP } from "../src/core/lexicon-derived.js";
import { DERIVED_CODES, prepDerived, compileTerms, candidates, markerCode } from "../src/core/rhetoric-derived.js";
import { GROUP_NAMES, NEUTRAL_NAMES } from "../scripts/eval/derived-groups.mjs";

const own = (code, t) => score(t, { derived: [code] }).markers.filter((m) => m.lang === markerCode(code)).map((m) => m.family).sort().join(",");
const terms = (code) => (DERIVED[code] && DERIVED[code].slur) || [];
// A term as it would be written: a Turkish stem gets an ending.
const written = (t) => (t.endsWith("*") ? t.slice(0, -1) + "lar" : t);

// Neutral sentences about a group, and policy positions from several directions, per language.
const NEUTRAL = {
  he: ["{G} גרים בעיר הזאת", "אני לא מסכים עם {G}", "{G} הצביעו בבחירות"],
  tr: ["{G} bu şehirde yaşıyor", "{G} ile aynı fikirde değilim", "{G} seçimde oy kullandı"],
  ko: ["{G}에 대한 기사를 읽었다", "나는 {G}의 의견에 동의하지 않는다", "{G}도 투표했다"],
  ja: ["{G}についての記事を読んだ", "私は{G}の意見に反対だ", "{G}も選挙で投票した"],
  fa: ["{G} در این شهر زندگی می‌کنند", "من با {G} موافق نیستم", "{G} در انتخابات رای دادند"],
  id: ["{G} tinggal di kota ini", "saya tidak setuju dengan {G}", "{G} ikut memilih dalam pemilu"],
  hi: ["{G} इस शहर में रहते हैं", "मैं {G} से सहमत नहीं हूं", "{G} ने चुनाव में वोट दिया"],
};
const POLICY = {
  he: ["צריך להעלות מסים לעשירים", "צריך לצמצם את ההגירה", "צריך יותר שוטרים ברחובות", "צריך להגדיל את קצבאות הרווחה"],
  tr: ["zenginlerden daha fazla vergi alınmalı", "göç azaltılmalı", "sokaklarda daha fazla polis olmalı", "sosyal yardımlar artırılmalı"],
  ko: ["부자 증세가 필요하다", "이민을 줄여야 한다", "경찰 예산을 늘려야 한다", "복지를 확대해야 한다"],
  ja: ["富裕層への増税が必要だ", "移民を減らすべきだ", "警察を増やすべきだ", "福祉を拡大すべきだ"],
  fa: ["باید از ثروتمندان مالیات بیشتری گرفت", "مهاجرت باید کاهش یابد", "پلیس بیشتری لازم است", "یارانه‌ها باید افزایش یابد"],
  id: ["orang kaya harus membayar pajak lebih tinggi", "imigrasi harus dikurangi", "kita butuh lebih banyak polisi", "bantuan sosial harus ditambah"],
  hi: ["अमीरों पर ज़्यादा टैक्स लगना चाहिए", "घुसपैठ रोकनी चाहिए", "हमें और पुलिस चाहिए", "गरीबों के लिए योजनाएं बढ़नी चाहिए"],
};

for (const code of DERIVED_CODES) {
  const targets = GROUP_NAMES[code];
  test(`${code}: at least 14 targets from every direction`, () => assert.ok(targets.length >= 14));
  test(`${code}: no group or public name is a derived term`, () => {
    const re = compileTerms(code, terms(code));
    const named = [...targets, ...NEUTRAL_NAMES[code]].filter((g) => re && re.test(prepDerived(code, g)));
    assert.deepEqual(named, []);
  });
  test(`${code}: neutral sentences and policy positions get no derived sign, for every target`, () => {
    for (const tpl of NEUTRAL[code]) for (const g of targets) assert.equal(own(code, tpl.replace("{G}", g)), "", tpl.replace("{G}", g));
    for (const t of POLICY[code]) assert.equal(own(code, t), "", t);
  });
  test(`${code}: a derived term gets the same sign whichever group it sits beside`, () => {
    for (const t of terms(code).slice(0, 12)) {
      const got = targets.map((g) => own(code, `${g} ${written(t)}`));
      assert.deepEqual([...new Set(got)], ["slur"], t);
    }
  });
}

test("held-back languages never run on a reply; shipped ones do", () => {
  for (const code of DERIVED_CODES) {
    const t = terms(code)[0];
    if (!t) continue;
    const found = score(written(t)).markers.some((m) => m.lang === markerCode(code));
    assert.equal(found, DERIVED_SHIP.includes(code), code);
  }
});

test("the lists are the derivation's output, term for term", () => {
  const ev = JSON.parse(readFileSync(new URL("../project-docs/evidence/derived-lexicon.json", import.meta.url), "utf8"));
  for (const code of DERIVED_CODES) assert.deepEqual(terms(code), ev.languages[code].terms.map((x) => x.term).sort(), code);
});

test("Unicode handling per script", () => {
  assert.equal(prepDerived("he", "שָׁלוֹם"), "שלום");
  assert.equal(prepDerived("tr", "İSTANBUL IŞIK"), "istanbul ışık");
  assert.equal(prepDerived("ja", "ｼﾈ"), "シネ");
  assert.equal(prepDerived("fa", "علي كتاب"), "علی کتاب");
  assert.equal(prepDerived("fa", "می‌‌خواهم"), "می‌خواهم");
  assert.equal(prepDerived("id", "anjiiiing"), "anjing");
  assert.equal(prepDerived("ko", "ㅅㅂ"), "ㅅㅂ");
  // Korean n-grams start a word; Japanese n-grams start anywhere.
  assert.deepEqual([...candidates("ko", "세대들")].sort(), ["세대", "세대들"]);
  assert.ok(candidates("ja", "あいつら").has("いつら"));
  assert.equal(compileTerms("ko", ["대들"]).test("세대들"), false);
  // Hebrew one-letter prefixes and Persian plural endings attach to a term.
  assert.ok(compileTerms("he", ["זבל"]).test("והזבל"));
  assert.ok(compileTerms("fa", ["کتاب"]).test("کتاب‌ها"));
  assert.ok(compileTerms("tr", ["kitap*"]).test("kitaplar"));
  assert.equal(compileTerms("id", ["bodoh"]).test("kebodohan"), false);
});

test("the window line for a shipped derived list gives its number and sources", async () => {
  const { langLine, MEASURED_DERIVED } = await import("../src/core/measured-langs.js");
  for (const code of DERIVED_SHIP) {
    const r = MEASURED_DERIVED[markerCode(code)];
    assert.ok(r.ship && r.low >= 0.7, code);
    const line = langLine(markerCode(code));
    assert.match(line, /derived from labelled research data/);
    assert.ok(line.includes(r.sources), line);
  }
});
