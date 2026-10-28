// Loads the prepared corpora for the Arabic, Russian, Ukrainian, Chinese and Hindi evaluation
// (scripts/eval/prep-langs.py) and maps each corpus's human labels onto CMMNS' families. Every
// mapping decision is here and in project-docs/evidence/CORPORA.md. Item shape as in corpora.mjs:
// { corpus, lang, id, text, split, gold: { hostile, severe, dehumanise, violence, slur, groupAttack } }.
// A gold field is null when the corpus has no label for it.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { splitOf } from "./corpora.mjs";

const readJsonl = (dir, name) => readFileSync(join(dir, name), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const blank = { hostile: null, severe: null, dehumanise: null, violence: null, slur: null, groupAttack: null };
const item = (corpus, lang, id, text, gold) => ({ corpus, lang, id, text, gold: { ...blank, ...gold }, split: splitOf(corpus, id) });

// TextDetox 2024 binary toxicity (balanced 2,500 / 2,500). "toxic" is the only label.
const textdetox = (lang) => (dir) => readJsonl(dir, `lang-textdetox-${lang}.jsonl`)
  .map((r) => item(`textdetox-${lang}`, lang, r.id, r.text, { hostile: r.toxic === 1 }));

// MLMA Arabic: hostile unless "normal" is the only label; severe when "hateful" is among them.
const mlmaAr = (dir) => readJsonl(dir, "lang-mlma-ar.jsonl").map((r) => {
  const labels = r.sentiment.split("_");
  return item("mlma-ar", "ar", r.id, r.text, { hostile: !(labels.length === 1 && labels[0] === "normal"), severe: labels.includes("hateful") });
});

// COLD test split: label 1 offensive; fine-grained 2 "attack group" (1 attacks an individual,
// 3 is anti-bias speech, 0 other non-offensive).
const cold = (dir) => readJsonl(dir, "lang-cold.jsonl")
  .map((r) => item("cold", "zh", r.id, r.text, { hostile: r.label === 1, groupAttack: r.fine === 2 }));

// Multilingual HateCheck: functional test cases written from templates and validated by
// annotators. "hateful" is the gold label; the functionality names the kind of case.
const MHC_LANG = { arabic: "ar", hindi: "hi", mandarin: "zh" };
const mhc = (name) => (dir) => readJsonl(dir, `lang-mhc-${name}.jsonl`).map((r) => {
  const f = r.functionality, h = r.label === "hateful";
  return item(`mhc-${MHC_LANG[name]}`, MHC_LANG[name], r.id, r.text, { hostile: h,
    dehumanise: f === "derog_dehum_h" ? true : (h ? null : false),
    violence: /^threat_/.test(f) ? true : (h ? null : false),
    slur: f === "slur_h" ? true : (h ? null : false) });
});

export const LANG_LOADERS = {
  "mlma-ar": mlmaAr, "textdetox-ar": textdetox("ar"), "mhc-ar": mhc("arabic"),
  "textdetox-ru": textdetox("ru"), "textdetox-uk": textdetox("uk"),
  cold, "mhc-zh": mhc("mandarin"),
  "textdetox-hi": textdetox("hi"), "mhc-hi": mhc("hindi"),
};
export const LANG_PREPARED = ["lang-mlma-ar.jsonl", "lang-cold.jsonl", ...["ar", "ru", "uk", "hi"].map((l) => `lang-textdetox-${l}.jsonl`),
  ...["arabic", "hindi", "mandarin"].map((l) => `lang-mhc-${l}.jsonl`)];
