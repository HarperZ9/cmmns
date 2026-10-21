// Stance-neutral rhetoric markers. The word lists live in lexicon.js; this file holds the grammar.
//   dehumanise   a group described as vermin, disease, animals, filth
//   violence     a call for violence or collective punishment against a group
//   vigilante    a call for people outside the law, or soldiers, to act against people
//   slur         a slur or coded hate term (strong), or a context-dependent one (slurSoft)
//   stereotype   "<group> are <trait>": a whole group named by a trait
//   motive       "<group> want to destroy / replace ...": an aim put in a whole group's mouth
//   essentialise blanket and replacement claims ("all X are", "violence is cultural")
//   conspiracy   conspiracy framing; absolutist  us-versus-them framing
// Disagreement, anger and strong opinions score 0; only the marker grammar counts. Scores feed
// the thread report, and the strong families also label the comment (never the person).

import * as L from "./lexicon.js";
import { scoreFr, NEGATION_FR } from "./rhetoric-fr.js";

export const GROUPS = L.GROUPS;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const alt = (list) => list.map(esc).sort((a, b) => b.length - a.length).join("|");
const word = (list) => new RegExp(`\\b(?:${alt(list)})\\b`, "i");
// Slurs may start or end with symbols ("(((", "14/88"), so their edges are any non-word character.
const edged = (list) => new RegExp(`(?:^|[^\\w])(?:${alt(list)})(?:$|[^\\w])`, "i");
const G = alt(L.GROUPS);
const CALL = "should|must|need to|needs to|have to|has to|let's|lets|let us|time to|gotta|got to|ought to|we will|we'll" +
  "|we'd|we would|i'd|i would";
const DET = "(?:the\\s+|these\\s+|those\\s+|our\\s+|their\\s+|your\\s+)?";

const RE = {
  dehumanise: new RegExp(`\\b(?:${G})\\b(?:\\W+\\w+){0,4}?\\W+(?:${alt(L.DEHUMANISE)})\\b|\\b(?:${alt(L.DEHUMANISE)})\\b(?:\\W+\\w+){0,3}?\\W+(?:like\\s+)?(?:these\\s+|those\\s+|the\\s+)?(?:${G})\\b`, "i"),
  violenceGroup: new RegExp(`\\b(?:${G})\\b(?:\\W+\\w+){0,6}?\\W+(?:should|must|need to|needs to|deserve to|ought to|will)\\s+(?:all\\s+)?(?:be\\s+)?(?:${alt(L.VIOLENCE_VERBS)})\\b`, "i"),
  violenceSlogan: word(L.VIOLENT_SLOGANS),
  // "we should exterminate the X", "let's kill all the X": a call with the group as the object
  violenceCall: new RegExp(`\\b(?:${CALL})\\s+(?:just\\s+)?(?:${alt(L.KILL_VERBS)})\\s+(?:all\\s+(?:of\\s+)?|every one of\\s+|each of\\s+|every\\s+)?${DET}(?:${G})\\b`, "i"),
  // "... the same fate for our X", counted only when the text names a killing (VIOLENT_STEM)
  sameFate: new RegExp(`\\bsame fate\\s+(?:for|to|as)\\s+(?:all\\s+)?${DET}(?:${G})\\b`, "i"),
  // "the only good commie is a dead commie": the same word twice, any target
  onlyGoodDead: /\bthe only good (\w+) (?:is|are) (?:a )?dead \1\b/i,
  // "communists aren't people": denying a group is human. Matched before the negation filter,
  // since the "not" is the marker here.
  notHuman: new RegExp(`\\b(?:${G})\\s+(?:are not|aren't|arent|ain't)\\s+(?:even\\s+)?(?:people|human|humans|real people)\\b`, "i"),
  // "declare war on Islam", "war against the Jews"
  warOn: new RegExp(`\\b(?:declare|declaring|wage|waging|start)\\s+(?:a\\s+)?(?:holy\\s+)?war\\s+(?:on|against)\\s+(?:the\\s+)?(?:${G})\\b`, "i"),
  vigilante: word(L.VIGILANTE),
  slur: edged(L.SLURS),
  slurSoft: word(L.SLURS_SOFT),
  stereotype: new RegExp(`\\b(?:${G})\\s+(?:are|is)\\s+(?:all\\s+|just\\s+|nothing but\\s+|such\\s+)?(?:${alt(L.STEREOTYPE_TRAITS)})\\b|\\btypical\\s+(?:${G})\\b`, "i"),
  motive: new RegExp(`\\b(?:${G})\\s+(?:want|wants|are trying|plan|are planning|intend)\\s+to\\s+(?:${alt(L.MOTIVE_VERBS)})\\b|\\b(?:they|${G})\\s+(?:all\\s+)?hate\\s+(?:${alt(L.HATRED_OBJECTS)})\\b`, "i"),
  essentialise: new RegExp(`\\b(?:${alt(L.ESSENTIALISE)})\\b|\\ball (?:the )?(?:${G}) are\\b|\\b(?:${G}) are all\\b`, "i"),
  conspiracy: word(L.CONSPIRACY),
  absolutist: word(L.ABSOLUTIST),
};

// "Immigrants are not animals" and "nobody should be killed" are the opposite of the marker.
const NEGATION = /\b(?:not|never|no one|nobody|aren't|arent|isn't|isnt|shouldn't|shouldnt|don't|dont)\b/i;
const VIOLENT_STEM = /\b(?:extermin|kill|massacr|slaughter|genocid|gass(?:ed|ing)|hang(?:ed|ing)|shoot|shot|lynch|wiped? out|wiping out|eradicat)/i;
const unleet = (s) => s.replace(/[013457@$!]/g, (c) => L.LEET[c] || c);

export const WEIGHTS = { dehumanise: 2, violence: 3, vigilante: 2, slur: 2, slurSoft: 1, stereotype: 2, motive: 1,
  essentialise: 1, conspiracy: 1, absolutist: 1 };
// "Extreme" for the thread report: any strong marker, or two weaker ones together.
export const EXTREME_AT = 2;
// Families strong enough to label the comment itself.
export const STRONG = new Set(["dehumanise", "violence", "vigilante", "slur", "stereotype"]);

// Returns { score, markers: [{ family, match }], extreme }.
export function score(text) {
  const s = String(text || "").replace(/[’]/g, "'");
  const markers = [];
  const hit = (family, re, negatable = false, on = s) => {
    const m = on.match(re);
    if (!m || (negatable && (NEGATION.test(m[0]) || NEGATION_FR.test(m[0])))) return false;
    markers.push({ family, match: m[0].trim().slice(0, 80) });
    return true;
  };
  if (!hit("dehumanise", RE.notHuman)) hit("dehumanise", RE.dehumanise, true);
  if (!hit("violence", RE.violenceGroup, true) && !hit("violence", RE.violenceCall, true) && !hit("violence", RE.warOn, true)
    && !hit("violence", RE.onlyGoodDead) && !(VIOLENT_STEM.test(s) && hit("violence", RE.sameFate, true))) {
    hit("violence", RE.violenceSlogan);
  }
  hit("vigilante", RE.vigilante);
  if (!hit("slur", RE.slur) && !hit("slur", RE.slur, false, unleet(s))) hit("slurSoft", RE.slurSoft);
  hit("stereotype", RE.stereotype, true);
  hit("motive", RE.motive, true);
  hit("essentialise", RE.essentialise, true);
  hit("conspiracy", RE.conspiracy);
  hit("absolutist", RE.absolutist);
  scoreFr(hit, new Set(markers.map((m) => m.family)));
  const total = markers.reduce((a, m) => a + WEIGHTS[m.family], 0);
  return { score: total, markers, extreme: total >= EXTREME_AT };
}
