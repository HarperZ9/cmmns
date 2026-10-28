// The label marker, part of the claim-type reading (F7), project-docs/ARGUMENT-LENS.md. It finds an
// epithet applied to a person or group, with its span: before a name ("Senator, crook Pat Doe"), after
// one ("Pat Doe, a known liar"), as a predicate ("this woman is a liar", "they are traitors", "you're a
// lying fraud"), or in a naming frame ("I call him a fraud"). Each hit has a status: "label"
// when the post itself applies it, or "negated", "self", "quoted" or "reported" when it does not, so
// a reader still sees the word. Only "label" hits count. The rule reads structure and the words in
// labels-data.js; it is never given a side, and the lexicon it reads carries none.
import { LABEL_HEADS, LABEL_MODIFIERS, LABEL_INTENSIFIERS, LABEL_INSTITUTIONS } from "./labels-data.js";

export const LABEL_DOES_NOT_PROVE = "A label is an epithet the post applies to someone. Finding one says how the post names a person, not whether the word fits them, and irony or a quotation the marker did not see can mislead it.";

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// A hyphen or space in a word matches either; the first letter matches either case.
const wordForm = (w) => `[${w[0].toLowerCase()}${w[0].toUpperCase()}]` + esc(w.slice(1)).replace(/[- ]/g, "[\\s-]");
const alt = (words) => [...new Set(words)].sort((a, b) => b.length - a.length).map(wordForm).join("|");

const NAME = "\\p{Lu}[\\p{Ll}'’]+(?:-\\p{Lu}?[\\p{Ll}'’]+)*";
// An adjective-shaped word that may sit inside a label without counting ("a shameless hypocrite").
const ADJ = "\\p{Ll}[\\p{Ll}-]*(?:ed|less|ful|ous|ive|al|ic|ish|ing|ent|ant|ate|y)";
const SEP = "(?:\\s*,\\s*|[\\s-]+)";
const COPULA = "(?:\\s+(?:is|was|are|were|am)(?<neg1>n['’]?t)?|['’](?:s|re|m)|\\s+(?:has|have|had)(?<neg2>\\s+never|\\s+not|n['’]?t)?\\s+been)(?<neg3>\\s+(?:not|never|no\\s+longer|hardly))?";
const FILLER = "(?:\\s+(?:just|simply|nothing\\s+but|such|also|still|always|ever|basically|clearly|obviously))*";
const SUBJECT = `\\b(?<subj>[Hh]e|[Ss]he|[Tt]hey|[Yy]ou|I|[Ww]e|(?:[Tt]his|[Tt]hat|[Tt]hese|[Tt]hose)(?:\\s+\\p{Ll}+){1,2}|[Yy]ou\\s+people|${NAME}(?:\\s+${NAME}){0,2})`;
const FUNCTION_WORDS = new Set(["However", "But", "And", "So", "Then", "Now", "Well", "Yes", "No", "Also", "Still", "Today", "Meanwhile", "Indeed", "Again", "Instead", "Look", "Listen", "Honestly", "Sadly", "Frankly", "Okay", "Oh", "The", "A", "An", "This", "That", "It", "In", "On", "At", "As", "If", "When", "While"]);
const REPORT = /\b(?:said|says|say|claimed|claims|claim|insisted|insists|argued|argues|told\s+\p{L}+|tweeted|wrote|writes|alleged|alleges|believes|believe|thinks|think|feel|feels|suggested|denied|denies|reported|added|shouted|yelled|posted)\s+(?:that\s+)?$/u;
const OWN_REPORT = /\b(?:I|[Ww]e)\s+(?:\p{Ll}+\s+)?(?:think|believe|say|said|maintain|insist)\s+(?:that\s+)?$/u;

// Regular expressions for a lexicon of the labels-data.js shape.
export function compileLexicon(lex = { heads: LABEL_HEADS, modifiers: LABEL_MODIFIERS, intensifiers: LABEL_INTENSIFIERS, institutions: LABEL_INSTITUTIONS }) {
  const head = alt(lex.heads.flat()), mod = alt(lex.modifiers), int = alt(lex.intensifiers);
  const ep = `(?<ep>(?:(?:${mod}|${int}|${ADJ})${SEP}){0,4}(?<head>${head}))(?![\\p{L}-])`;
  const D = "(?:(?:a|an)\\s+)?";
  return {
    mod: new RegExp(`(?<![\\p{L}-])(?:${mod})(?![\\p{L}])`, "gu"), institutions: new Set(lex.institutions),
    patterns: [
      ["naming", new RegExp(`(?<who>\\b\\p{L}+\\s+)?\\b(?<verb>[Cc]all(?:s|ed|ing)?|[Bb]rand(?:s|ed|ing)?|[Ll]abel(?:s|ed|led|ing)?|[Dd]ub(?:s|bed|bing)?)\\s+(?<obj>him|her|them|me|us|you|${NAME}(?:\\s+${NAME}){0,2})\\s+${D}${ep}`, "gu")],
      ["being", new RegExp(`\\b(?<frame>[Aa]ccus(?:ed|es|ing)\\s+(?:\\p{L}+\\s+)?of\\s+being|[Dd]en(?:ied|ies|y|ying)\\s+being|(?:not|never)\\s+being)\\s+${D}${ep}`, "gu")],
      ["self", new RegExp(`\\b[Aa]s\\s+(?:a|an)\\s+${ep}\\s*,\\s*(?<subj>I|[Ww]e)\\b`, "gu")],
      ["predicate", new RegExp(`${SUBJECT}${COPULA}${FILLER}\\s+(?:(?<det>a|an|no)\\s+)?${ep}`, "gu")],
      ["appositive-after", new RegExp(`(?<name>${NAME}(?:\\s+${NAME}){0,2}),\\s+(?:a|an|the)\\s+${ep}`, "gu")],
      ["appositive-before", new RegExp(`(?<![\\p{L}-])(?<desc>[\\p{L}-]+,\\s+)?${ep}\\s+(?<name>${NAME}(?:\\s+${NAME}){1,2})`, "gu")],
    ],
  };
}
const DEFAULT = compileLexicon();

// Quoted stretches of a text, as [start, end) pairs.
function quoteSpans(t) {
  return [...t.matchAll(/["“«][^"”»]*["”»]|(?<![\p{L}])['‘][^'’\n]{1,40}['’](?![\p{L}])/gu)].map((m) => [m.index, m.index + m[0].length]);
}

// Why a match is not a hit at all (a proper noun, a function word read as a name), or null.
function skipReason(kind, g, m, lex, t) {
  if (kind === "appositive-before") {
    const first = g.name.split(/\s+/)[0];
    if (lex.institutions.has(first) || g.name.split(/\s+/).some((w) => lex.institutions.has(w))) return "proper noun";
  }
  if (kind === "appositive-after") {
    const toks = g.name.split(/\s+/), before = t.slice(0, m.index).trimEnd();
    if (FUNCTION_WORDS.has(toks[0]) || (toks.length === 1 && (!before || /[.!?:]$/.test(before)))) return "not a name";
  }
  if (kind === "predicate" && /^\p{Lu}/u.test(g.subj) && !/^(?:He|She|They|You|I|We|This|That|These|Those)\b/.test(g.subj) && FUNCTION_WORDS.has(g.subj.split(/\s+/)[0])) return "not a name";
  return null;
}

// The status of a hit: label, negated, self, quoted or reported.
function statusOf(kind, g, start, t, quotes) {
  if (kind === "self" || (g.subj && /^(?:I|[Ww]e)$/.test(g.subj)) || (g.obj && /^(?:me|us)$/.test(g.obj))) return "self";
  if (g.neg1 || g.neg2 || g.neg3 || g.det === "no" || (g.frame && /^(?:not|never)/.test(g.frame))) return "negated";
  if (quotes.some(([a, b]) => start >= a && start < b)) return "quoted";
  if (kind === "naming") return g.who && /^(?:I|[Ww]e)\s+$/.test(g.who) ? "label" : "reported";
  if (kind === "being") return "reported";
  const sentence = t.slice(Math.max(t.lastIndexOf(".", start - 1), t.lastIndexOf("!", start - 1), t.lastIndexOf("?", start - 1), t.lastIndexOf("\n", start - 1)) + 1, start);
  if (OWN_REPORT.test(sentence)) return "label";
  return REPORT.test(sentence) ? "reported" : "label";
}

// Every epithet hit in a text: { kind, status, start, end, text, epithet, severity, target }. Severity is
// the number of epithet words in the label: the head and each pejorative modifier ("a lying,
// corrupt crook" is 3); intensifiers ("total", "known") do not count. `lexicon` replaces the default words.
export function labelsIn(text, { lexicon } = {}) {
  const t = String(text || ""), lex = lexicon ? compileLexicon(lexicon) : DEFAULT, quotes = quoteSpans(t), seen = new Map();
  for (const [kind, re] of lex.patterns) {
    for (const m of t.matchAll(re)) {
      const g = m.groups, epStart = m.index + m[0].lastIndexOf(g.ep);
      if (seen.has(epStart) || skipReason(kind, g, m, lex, t)) continue;
      const start = kind === "appositive-before" && g.desc ? m.index : kind === "appositive-before" ? epStart : m.index;
      const target = g.name || g.obj || g.subj || null;
      seen.set(epStart, { kind, status: statusOf(kind, g, start, t, quotes), start, end: m.index + m[0].length, text: m[0].trim(), epithet: g.head,
        severity: 1 + [...g.ep.slice(0, g.ep.length - g.head.length).matchAll(lex.mod)].length, target });
    }
  }
  return [...seen.values()].sort((a, b) => a.start - b.start);
}

// The hits a post applies itself.
export const appliedLabels = (text, opts) => labelsIn(text, opts).filter((h) => h.status === "label");
