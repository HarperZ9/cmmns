// French grammar for the stance-neutral markers. JavaScript's \b treats accented letters as
// non-word characters, so every boundary here is a Unicode letter lookaround with the "u" flag.
// These run only for families the English grammar did not already find in the same text.

import * as F from "./lexicon-fr.js";

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const alt = (list) => list.map(esc).sort((a, b) => b.length - a.length).join("|");
const B = "(?<![\\p{L}\\p{N}_])", E = "(?![\\p{L}\\p{N}_])";
const re = (src) => new RegExp(src, "iu");
const G = alt(F.GROUPS_FR), D = alt(F.DEHUMANISE_FR);
const FILL = "(?:\\s+[\\p{L}']+){0,3}?";
const ART = "(?:les\\s+|ces\\s+|tous\\s+ces\\s+|des\\s+)?";

export const RE_FR = {
  dehumanise: re(`${B}(?:${G})${E}${FILL}\\s+(?:sont|c'est|ce sont|restent)\\s+(?:tous\\s+|toutes\\s+|que\\s+)?` +
    `(?:des\\s+|de la\\s+|de l'|du\\s+|une\\s+|un\\s+|d'|de\\s+)?(?:vraies?\\s+|vrais\\s+|sales\\s+)?(?:${D})${E}`),
  dehumaniseOf: re(`${B}(?:ces|cette|ce|cet)\\s+(?:${D})\\s+(?:de\\s+|d')(?:${G})${E}`),
  violenceCall: re(`${B}(?:il faut|faut|il faudrait|faudrait|il faudra|on doit|on devrait|on va|allons)\\s+` +
    `(?:tous\\s+|toutes\\s+)?(?:${alt(F.KILL_INF_FR)})\\s+(?:tous\\s+|toutes\\s+)?${ART}(?:${G})${E}`),
  violenceDeserve: re(`${B}(?:${G})${E}(?:\\s+[\\p{L}']+){0,4}?\\s+(?:doivent|devraient|méritent|meritent|mériteraient)` +
    `\\s+(?:tous\\s+|toutes\\s+)?(?:d'être|d'etre|être|etre)\\s+(?:${alt(F.KILL_PP_FR)})${E}`),
  violenceSlogan: re(`${B}(?:(?:mort aux|à mort les|a mort les)\\s+(?:${G})|${alt(F.SLOGANS_FR)})${E}`),
  stereotype: re(`${B}(?:${G})${E}\\s+(?:sont|restent)\\s+(?:tous\\s+|toutes\\s+|juste\\s+|que\\s+|rien que\\s+)?` +
    `(?:des\\s+|de\\s+)?(?:${alt(F.STEREOTYPE_TRAITS_FR)})${E}`),
  conspiracy: re(`${B}(?:${alt(F.CONSPIRACY_FR)})${E}`),
};

// "ne sont pas des animaux", "jamais": the opposite of the marker.
export const NEGATION_FR = /(?<![\p{L}])(?:ne|n'|pas|jamais|aucun|aucune)(?![\p{L}])/iu;

// Adds French markers through `hit(family, regex, negatable)` for families not yet in `have`.
export function scoreFr(hit, have) {
  if (!have.has("dehumanise") && !hit("dehumanise", RE_FR.dehumanise, true)) hit("dehumanise", RE_FR.dehumaniseOf, true);
  if (!have.has("violence") && !hit("violence", RE_FR.violenceCall, true) && !hit("violence", RE_FR.violenceDeserve, true)) {
    hit("violence", RE_FR.violenceSlogan);
  }
  if (!have.has("stereotype")) hit("stereotype", RE_FR.stereotype, true);
  if (!have.has("conspiracy")) hit("conspiracy", RE_FR.conspiracy);
}
