// The "speaking as a local" rule. A reply that claims to be from a place ("here in France",
// "as a Frenchman", "we Americans") is compared with the platform's own label for where the
// account is based. The rule is explicit so it can be tested and argued with; it is not a
// model's opinion.
//
// What a mismatch does not prove: the label can be wrong (VPNs, travel, X's own errors at
// rollout), and people living abroad still speak as locals of the country they come from.

import { countryOf, isDemonym, knownPlaceWords, parseLabel, regionOfCountry } from "./places.js";

const EXTRA = new Map([["français", "France"], ["française", "France"], ["francais", "France"], ["francaise", "France"], ["deutsche", "Germany"], ["españoles", "Spain"], ["espanoles", "Spain"]]);
const place = () => "(" + knownPlaceWords().map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")";

let RULES = null;
function rules() {
  if (RULES) return RULES;
  const P = place();
  RULES = [
    { id: "here-in", re: new RegExp("\\bhere in (?:the )?" + P + "\\b", "gi") },
    { id: "live-in", re: new RegExp("\\bi (?:live|grew up|was born) in (?:the )?" + P + "\\b", "gi") },
    { id: "from", re: new RegExp("\\bi(?:'m| am) from (?:the )?" + P + "\\b", "gi") },
    { id: "born-raised", re: new RegExp("\\bborn and raised in (?:the )?" + P + "\\b", "gi") },
    { id: "we-demonym", re: /\b(?:we|us) ([a-z]+)(?: ([a-z]+))?/gi, demonym: true },
    { id: "as-a-demonym", re: /\bas an? ([a-z]+)(?: ([a-z]+))?/gi, demonym: true },
    { id: "fellow", re: /\bmy fellow ([a-z]+)(?: ([a-z]+))?/gi, demonym: true },
    { id: "ici-en", re: new RegExp("\\b(?:ici|chez nous) en " + P + "\\b", "gi") },
    { id: "nous-les", re: /\bnous (?:les|autres) ([a-zàâçéèêëîïôûùüÿñ]+)\b/gi, extra: true },
  ];
  return RULES;
}

// Words that turn a demonym into a description of something else: "as an English speaker".
const NOT_PEOPLE = new Set(["speaker", "speakers", "learner", "learners", "student", "students", "teacher", "teachers", "tourist", "tourists", "visitor", "visitors", "fan", "fans", "food", "shepherd", "word", "words", "language", "version", "translation"]);

const singular = (w) => w.replace(/(men)$/, "man").replace(/(women)$/, "woman").replace(/s$/, "");

// w1 and optional w2 follow "we", "as a" or "my fellow". Two-word demonyms ("south african")
// are tried first; a one-word demonym followed by a NOT_PEOPLE word is not a claim.
function demonymCountry(w1, w2) {
  const a = (w1 || "").toLowerCase(), b = (w2 || "").toLowerCase();
  if (b) for (const w of [a + " " + b, a + " " + singular(b)]) if (isDemonym(w)) return countryOf(w);
  if (b && NOT_PEOPLE.has(b)) return null;
  for (const w of [a, singular(a)]) if (isDemonym(w)) return countryOf(w);
  return null;
}

// Returns [{ country, rule, match }] for every local claim in the text.
export function localClaims(text) {
  const s = String(text || "");
  const out = [];
  for (const r of rules()) {
    r.re.lastIndex = 0;
    let m;
    while ((m = r.re.exec(s))) {
      let country = null;
      if (r.demonym) country = demonymCountry(m[1], m[2]);
      else if (r.extra) country = EXTRA.get(m[1].toLowerCase()) || null;
      else country = countryOf(m[1]);
      if (country) out.push({ country, rule: r.id, match: m[0] });
    }
  }
  const seen = new Set();
  return out.filter((c) => (seen.has(c.country) ? false : (seen.add(c.country), true)));
}

// label: the platform's "based in" text. Returns
//   { status: "mismatch" | "consistent" | "unknown" | "none", claims, label, reason }
export function compare(text, label) {
  const claims = localClaims(text);
  if (!claims.length) return { status: "none", claims, label, reason: "no local claim in the text" };
  const L = parseLabel(label);
  if (!L) return { status: "unknown", claims, label, reason: label ? "label not recognised" : "no label available" };
  for (const c of claims) {
    if (L.country && L.country === c.country) return { status: "consistent", claims, label, reason: "label matches the claimed country" };
    if (!L.country && L.region === regionOfCountry(c.country)) return { status: "consistent", claims, label, reason: "label names the claimed country's region" };
  }
  const c = claims[0];
  return { status: "mismatch", claims, label, reason: `speaks as local to ${c.country} ("${c.match}"); label says ${label}` };
}

