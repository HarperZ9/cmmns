// Loads the Propaganda Techniques Corpus (PTC, SemEval-2020 Task 11, Da San Martino et al. 2019 and
// 2020; Zenodo record 3952415, CC BY 4.0) from <data dir>/ptc. Only the 371 training articles carry
// gold labels in the public release, so Daylight Commons splits those articles into dev and test with the fixed
// seed in corpora.mjs. Offsets are code-point offsets into the article file.
// Item shape: { id, text, split, spans: [{ technique, start, end }] }.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { splitOf } from "./corpora.mjs";

export const PTC_DIR = "ptc/x/datasets";
export const PTC_ARCHIVE = "ptc/datasets-v2.tgz";

// PTC labels a merged superclass in places; a Daylight Commons technique counts as correct when it overlaps a
// gold span of any label in its list.
export const GOLD_OF = {
  "loaded-language": ["Loaded_Language"],
  "name-calling": ["Name_Calling,Labeling"],
  "bandwagon": ["Bandwagon,Reductio_ad_hitlerum"],
  "appeal-to-fear": ["Appeal_to_fear-prejudice"],
  "flag-waving": ["Flag-Waving"],
  "thought-terminating": ["Thought-terminating_Cliches"],
  "whataboutism": ["Whataboutism,Straw_Men,Red_Herring"],
  "black-and-white": ["Black-and-White_Fallacy"],
  "doubt": ["Doubt"],
  "appeal-to-authority": ["Appeal_to_Authority"],
  "exaggeration": ["Exaggeration,Minimisation"],
  // No PTC label names hidden-motive claims or question-form insinuation. Both are scored against
  // "Doubt" (questioning credibility), the nearest label, so their figures are proxy measurements.
  "motive-attribution": ["Doubt"],
  "just-asking": ["Doubt"],
  "slogans": ["Slogans"],
  "causal-oversimplification": ["Causal_Oversimplification"],
};

// Code-point string to UTF-16 index map, so gold offsets line up with JavaScript match indices.
function utf16Index(text) {
  const map = [];
  let u = 0;
  for (const ch of text) { map.push(u); u += ch.length; }
  map.push(u);
  return map;
}

export function loadPtc(data) {
  const dir = join(data, PTC_DIR);
  const labels = new Map();
  for (const line of readFileSync(join(dir, "train-task2-TC.labels"), "utf8").split("\n").filter(Boolean)) {
    const [id, technique, s, e] = line.trim().split("\t");
    if (!labels.has(id)) labels.set(id, []);
    labels.get(id).push({ technique, s: Number(s), e: Number(e) });
  }
  return readdirSync(join(dir, "train-articles")).filter((f) => /^article\d+\.txt$/.test(f)).map((f) => {
    const id = f.match(/\d+/)[0];
    const text = readFileSync(join(dir, "train-articles", f), "utf8");
    const map = utf16Index(text);
    const spans = (labels.get(id) || []).map((x) => ({ technique: x.technique, start: map[x.s], end: map[Math.min(x.e, map.length - 1)] }));
    return { id, text, split: splitOf("ptc", id), spans };
  });
}
