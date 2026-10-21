// Which grammar found a marker, and what the window says about how that language was measured.
import test from "node:test";
import assert from "node:assert/strict";
import { score } from "../src/core/rhetoric.js";
import { langLine, MEASURED_LANGS, MIN_N } from "../src/core/measured-langs.js";
import { mentionedIntl } from "../src/core/rhetoric-mention.js";

test("a marker carries the code of the language grammar that found it; English carries none", () => {
  assert.equal(score("immigrants are vermin").markers[0].lang, undefined);
  assert.equal(score("либералы — крысы").markers[0].lang, "ru");
  assert.equal(score("ватники — тварини").markers[0].lang, "uk");
  assert.equal(score("اليهود خنازير").markers[0].lang, "ar");
  assert.equal(score("黑人都是蟑螂").markers[0].lang, "zh");
  assert.equal(score("मुसलमान कीड़े हैं").markers[0].lang, "hi");
});

test("the language line gives a number only with enough labelled signs, and names its sources", () => {
  for (const [code, r] of Object.entries(MEASURED_LANGS)) {
    const line = langLine(code);
    if (r.n >= MIN_N) { assert.match(line, /95% interval/); assert.ok(line.includes(r.sources), line); }
    else assert.match(line, /Not measured in/);
  }
  assert.match(langLine("fr"), /Not measured in French/);
});

test("reported and quoted words are a mention in every new language", () => {
  const cases = ["عمري ما قلت ان اليهود حثالة", "他骂女人是垃圾", "не называй либералов крысами, либералы — крысы это ложь",
    "他说这是“典型的台巴子行为”"];
  for (const t of cases.slice(0, 2)) assert.equal(score(t).markers.length, 0, t);
  assert.equal(score(cases[3]).markers.length, 0, cases[3]);
  const s = "他发送“黑人都是蟑螂”";
  assert.equal(mentionedIntl(s, Object.assign(["黑人都是蟑螂"], { index: s.indexOf("黑") })), true);
});
