// Loads the prepared corpora behind the derived word lists (scripts/eval/prep-derived.py) and maps
// each corpus's human labels onto two fields. Every mapping decision is here and in
// project-docs/evidence/CORPORA.md ("Hebrew, Turkish, Korean, Japanese, Persian, Indonesian, Hindi").
//   hostile  the corpus's broad label (offensive, toxic, hostile)
//   group    hate aimed at a group or at a person for a group trait; null when the corpus has no such label
//   targets  the targeted groups the labels name, [] when none
// Item: { corpus, lang, id, text, split, gold: { hostile, group }, targets }.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { splitOf } from "./corpora.mjs";

const readJsonl = (dir, name) => readFileSync(join(dir, name), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const item = (corpus, lang, id, text, gold, targets = []) => ({ corpus, lang, id, text, gold, targets, split: splitOf(corpus, id) });
// Majority of a list of "0"/"1" votes; null on a tie (the IndoDiscourse card drops perfect disagreement).
const majority = (votes) => { const k = votes.filter((v) => v === "1").length, n = votes.length; return 2 * k === n ? null : 2 * k > n; };

// OLaH: 0/1 offensive. No group label.
const olah = (dir) => readJsonl(dir, "derive-olah.jsonl").map((r) => item("olah", "he", r.id, r.text, { hostile: r.offensive === 1, group: null }));

// OffensEval 2020 Turkish: OFF/NOT (profanity or a targeted offence). No group label.
const offensevalTr = (dir) => readJsonl(dir, "derive-offenseval-tr.jsonl").map((r) => item("offenseval-tr", "tr", r.id, r.text, { hostile: r.off, group: null }));

// TurkishHateMap: 0 offensive, 1 hate, 2 neutral, 3 civilized, per topic. Hate is the group label,
// so offensive entries count as hostile but not as group hate. The topic names the target.
const hatemapTr = (dir) => readJsonl(dir, "derive-hatemap-tr.jsonl").map((r) =>
  item("hatemap-tr", "tr", r.id, r.text, { hostile: r.label <= 1, group: r.label === 1 }, r.label === 1 ? [r.topic] : []));

// K-MHaS: 0 origin, 1 physical, 2 politics, 3 profanity, 4 age, 5 gender, 6 race, 7 religion, 8 not hate.
// Group hate is any class but profanity, physical appearance and not-hate. Profanity alone, and
// remarks on one person's looks, are hostile only: CMMNS' markers are about groups.
const KMHAS = ["origin", "physical", "politics", "profanity", "age", "gender", "race", "religion"];
const kmhas = (dir) => readJsonl(dir, "derive-kmhas.jsonl").map((r) => {
  const t = r.labels.filter((l) => l !== 1 && l !== 3 && l !== 8).map((l) => KMHAS[l]);
  return item("kmhas", "ko", r.id, r.text, { hostile: !r.labels.includes(8), group: t.length > 0 }, t);
});

// BEEP! (Korean HateSpeech): hate / offensive / none. "hate" is the group label.
const beep = (dir) => readJsonl(dir, "derive-beep.jsonl").map((r) => item("beep", "ko", r.id, r.text, { hostile: r.hate !== "none", group: r.hate === "hate" }));

// LLM-jp Toxicity v2: toxic / has_toxic_expression / nontoxic; "discriminatory" is the group label.
const llmjp = (dir) => readJsonl(dir, "derive-llmjp.jsonl").map((r) =>
  item("llmjp", "ja", r.id, r.text, { hostile: r.label === "toxic", group: r.discriminatory === "yes" }));

// inspection-ai Japanese toxicity subset: annotator counts per level; 差別 (discrimination) is the group label.
const inspectionJa = (dir) => readJsonl(dir, "derive-inspection-ja.jsonl").map((r) =>
  item("inspection-ja", "ja", r.id, r.text, { hostile: r.toxic + r.very > r.not + r.hard, group: 2 * r.discrimination > r.annotators }));

// Persian offensive language (Kebriaei et al. 2024): "0- NO", "1- Offensive", "2- <target group>".
const persianOff = (dir) => readJsonl(dir, "derive-persian-off.jsonl").map((r) => {
  const c = r.cls[0], target = r.cls.replace(/^2-\s*/, "").trim();
  return item("persian-off", "fa", r.id, r.text, { hostile: c !== "0", group: c === "2" }, c === "2" ? [target] : []);
});

// IndoDiscourse (IndoToxic2024): one vote list per label; majority, ties unlabelled. identity_attack
// is the group label. Texts the coders marked as noise or spam are dropped.
const indodiscourse = (dir) => readJsonl(dir, "derive-indodiscourse.jsonl").filter((r) => majority(r.spam) !== true).map((r) =>
  item("indodiscourse", "id", r.id, r.text, { hostile: majority(r.toxicity), group: majority(r.identity) }));

// IDHSD (Alfina et al. 2017): HS / Non_HS, hate speech at religion, race, ethnicity and political groups.
const idhsd = (dir) => readJsonl(dir, "derive-idhsd.jsonl").map((r) => item("idhsd", "id", r.id, r.text, { hostile: r.hs, group: r.hs }));

// TextDetox Hindi (already prepared for scripts/eval-langs.mjs): binary toxic, no group label.
const textdetoxHi = (dir) => readJsonl(dir, "lang-textdetox-hi.jsonl").map((r) => item("textdetox-hi", "hi", r.id, r.text, { hostile: r.toxic === 1, group: null }));

// Multilingual HateCheck Hindi: template cases, "hateful" is the group label, the target is named.
const mhcHi = (dir) => readJsonl(dir, "lang-mhc-hindi.jsonl").map((r) => {
  const h = r.label === "hateful";
  return item("mhc-hi", "hi", r.id, r.text, { hostile: h, group: h }, h && r.target ? [r.target] : []);
});

export const DERIVED_LOADERS = {
  he: { olah }, tr: { "offenseval-tr": offensevalTr, "hatemap-tr": hatemapTr }, ko: { kmhas, beep },
  ja: { llmjp, "inspection-ja": inspectionJa }, fa: { "persian-off": persianOff }, id: { indodiscourse, idhsd },
  hi: { "textdetox-hi": textdetoxHi, "mhc-hi": mhcHi },
};
// Natural text pooled for the shipping gate. HateCheck is template-built, so it is reported, never pooled.
export const GATE_POOL = { he: ["olah"], tr: ["offenseval-tr", "hatemap-tr"], ko: ["kmhas", "beep"], ja: ["llmjp", "inspection-ja"],
  fa: ["persian-off"], id: ["indodiscourse", "idhsd"], hi: ["textdetox-hi"] };
// Template-built cases share their wording between dev and test, so words picked from them are the
// templates' words. HateCheck is measured, never derived from.
export const EVAL_ONLY = ["mhc-hi"];
export const DERIVED_PREPARED = ["olah", "offenseval-tr", "hatemap-tr", "kmhas", "beep", "llmjp", "inspection-ja", "persian-off",
  "indodiscourse", "idhsd", "nsmc"].map((n) => `derive-${n}.jsonl`);

// General text in the language, unlabelled for hostility: a derived term that is common here is an
// ordinary word or a piece of one. Korean only (Naver movie reviews, CC0); the other languages'
// candidates are words, which the boundary rules already keep whole.
const REFERENCE = { ko: "derive-nsmc.jsonl" };
export const loadReference = (dir, code) => (REFERENCE[code] ? readJsonl(dir, REFERENCE[code]).map((r) => r.text) : []);

export function loadLanguage(dir, code) {
  return Object.values(DERIVED_LOADERS[code]).flatMap((load) => load(dir)).filter((i) => i.text && i.gold.hostile != null);
}

// Other-language text the derived terms must not fire on: the prepared English, French and
// Arabic, Russian, Ukrainian, Chinese corpora already used by scripts/eval.mjs and eval-langs.mjs.
const FOREIGN = ["mhs.jsonl", "civil.jsonl", "hatexplain.jsonl", "mlma-fr.jsonl", "lang-mlma-ar.jsonl", "lang-cold.jsonl",
  ...["ar", "ru", "uk"].map((l) => `lang-textdetox-${l}.jsonl`)];
export function loadForeign(dir) {
  return FOREIGN.filter((f) => existsSync(join(dir, f))).flatMap((f) => readJsonl(dir, f).map((r) => ({ corpus: f, text: r.text || "" })));
}
