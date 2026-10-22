// Loads the prepared corpora (scripts/eval/prep.py) and maps each corpus's human labels onto
// Daylight Commons' families. Every mapping decision is here and in project-docs/evidence/CORPORA.md.
// Item shape: { corpus, id, text, split, gold: { hostile, severe, dehumanise, violence,
// stereotype }, groups: [...], sides: Set("right-targets" | "left-targets" | "both") }.
// A gold field is null when the corpus has no label for it.

import { readFileSync } from "node:fs";
import { join } from "node:path";

export const SEED = "radar-eval-2026-10-21";

// FNV-1a over seed + corpus + id; the low bit picks the split, so it is fixed and 50/50.
export function splitOf(corpus, id) {
  let h = 0x811c9dc5;
  for (const ch of `${SEED}|${corpus}|${id}`) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h & 1 ? "test" : "dev";
}

// "Groups the right is often hostile to" and "groups the left is often hostile to". Groups that
// draw hostility from both directions, or from neither, are "both" and stay out of the gap test.
const SIDE = {
  "right-targets": [
    // MHS
    "race_black", "race_latinx", "race_middle_eastern", "race_native_american", "religion_muslim", "religion_atheist",
    "origin_immigrant", "origin_migrant_worker", "origin_undocumented", "gender_women", "gender_non_binary",
    "gender_transgender_men", "gender_transgender_women", "gender_transgender_unspecified", "sexuality_gay",
    "sexuality_lesbian", "sexuality_bisexual", "politics_leftist", "politics_liberal", "politics_democrat",
    "politics_communist", "politics_socialist", "politics_green_party",
    // HateXplain
    "African", "Islam", "Arab", "Refugee", "Hispanic", "Homosexual", "Women", "Indigenous", "Minority", "Nonreligious",
    "Bisexual", "Asexual",
    // MLMA French
    "african_descent", "arabs", "immigrants", "muslims", "refugees", "left_wing_people", "hispanics", "gay", "women",
  ],
  "left-targets": [
    "race_white", "religion_christian", "religion_mormon", "gender_men", "sexuality_straight", "politics_conservative",
    "politics_republican", "politics_alt_right", "politics_libertarian",
    "Caucasian", "Christian", "Men", "Heterosexual", "Economic",
    "christian",
  ],
};
const SIDE_OF = new Map(Object.entries(SIDE).flatMap(([s, gs]) => gs.map((g) => [g, s])));
export const sideOf = (g) => SIDE_OF.get(g) || "both";

function readJsonl(dir, name) {
  return readFileSync(join(dir, name), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const item = (corpus, id, text, gold, groups) => ({
  corpus, id, text, gold, groups, split: splitOf(corpus, id), sides: new Set(groups.map(sideOf)),
});

// Measuring Hate Speech: several annotators per comment. Items are 0..4 with 4 the most hateful;
// a family is present when the median annotator is at "agree" (3) or above. The IRT
// hate_speech_score is per comment; the authors read > 0.5 as approximately hate speech.
export function loadMhs(dir) {
  const by = new Map();
  for (const r of readJsonl(dir, "mhs.jsonl")) {
    if (!by.has(r.id)) by.set(r.id, []);
    by.get(r.id).push(r);
  }
  const out = [];
  for (const [id, rows] of by) {
    const med = (k) => median(rows.map((r) => r[k]));
    const counts = new Map();
    for (const r of rows) for (const t of r.targets) counts.set(t, (counts.get(t) || 0) + 1);
    const groups = [...counts].filter(([t, n]) => n * 2 > rows.length && !t.endsWith("_other")).map(([t]) => t);
    const hs = rows[0].hate_speech_score;
    const gold = {
      severe: hs > 0.5,
      hostile: hs > 0.5 || ["insult", "humiliate", "status", "dehumanize", "violence", "genocide"].some((k) => med(k) >= 3),
      dehumanise: med("dehumanize") >= 3,
      violence: med("violence") >= 3 || med("genocide") >= 3,
      stereotype: med("status") >= 3,
    };
    out.push(item("mhs", id, rows[0].text, gold, groups));
  }
  return out;
}

// HateXplain: three annotators, labels hatespeech / offensive / normal and target lists. A label
// or target counts when two of the three annotators chose it.
export function loadHatexplain(dir) {
  return readJsonl(dir, "hatexplain.jsonl").map((r) => {
    const n = (l) => r.labels.filter((x) => x === l).length;
    const counts = new Map();
    for (const ts of r.targets) for (const t of new Set(ts)) counts.set(t, (counts.get(t) || 0) + 1);
    const groups = [...counts].filter(([t, k]) => k >= 2 && t !== "None" && t !== "Other").map(([t]) => t);
    const gold = { severe: n("hatespeech") >= 2, hostile: n("normal") <= 1, dehumanise: null, violence: null, stereotype: null };
    return item("hatexplain", r.id, r.text, gold, groups);
  });
}

// Civil Comments (Jigsaw): each label is the share of raters who chose it. Present at 0.5 or above,
// the threshold Jigsaw used. No target groups in this release.
export function loadCivil(dir) {
  return readJsonl(dir, "civil.jsonl").map((r) => {
    // severe_toxicity almost never reaches 0.5 in this release, so it gives no severity label.
    const gold = { severe: null, hostile: r.toxicity >= 0.5 || r.identity_attack >= 0.5 || r.threat >= 0.5,
      dehumanise: null, violence: r.threat >= 0.5, stereotype: null };
    return item("civil", r.id, r.text, gold, []);
  });
}

// MLMA French tweets: one hostility label set per tweet (abusive, hateful, offensive,
// disrespectful, fearful, normal). Hostile unless "normal" is the only label; severe when
// "hateful" is among them. The group field names the target.
export function loadMlmaFr(dir) {
  return readJsonl(dir, "mlma-fr.jsonl").map((r) => {
    const labels = r.sentiment.split("_");
    const gold = { severe: labels.includes("hateful"), hostile: !(labels.length === 1 && labels[0] === "normal"),
      dehumanise: null, violence: null, stereotype: null };
    const groups = ["other", "individual"].includes(r.group) ? [] : [r.group];
    return item("mlma-fr", r.id, r.text, gold, groups);
  });
}

export const LOADERS = { mhs: loadMhs, hatexplain: loadHatexplain, civil: loadCivil, "mlma-fr": loadMlmaFr };
