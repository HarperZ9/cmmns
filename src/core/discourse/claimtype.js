// The claim-type marker (F7) and the inference-gap marker (F9), project-docs/ARGUMENT-LENS.md.
// F7 names what kind of claim each sentence makes, with the cue that decided it: a question, a
// quotation, a definition, a sourced statement, an opinion or value, an inference, or a factual claim
// with or without a source. F9 marks two moves: a claim about what another person knows, wants or
// intends (not observable from a post), and a conclusion whose words its premises do not contain.
// Every rule reads the move; none reads a side, a party or a person (tests/discourse.argument.test.js
// runs them with the sides swapped).
import { readArgument, segment, guessLang } from "./argument.js";
import { content } from "./text.js";

export const CLAIM_DOES_NOT_PROVE = "A claim type is read from wording cues, so a sentence can carry two kinds, and irony or quotation can mislead the cue. It says what kind of claim the words make, not whether the claim is true.";
export const GAP_DOES_NOT_PROVE = "An inference can be sound even when its words are new, and a claim about someone's intent can be right. The marker shows where the post goes beyond what it states; it does not say the conclusion is wrong.";

const SENT = /[^.!?\n]+[.!?]*/g;
const RULES = [
  ["question", /\?\s*$/u, "ends with a question mark"],
  ["quotation", /["“«][^"”»]{12,}["”»]/u, "a passage in quotation marks"],
  ["definition", /\b(?:by definition|is defined as|(?:the|its) (?:true |real )?meaning of|what counts as|means (?:that )?(?:a|an|the)\b|is not (?:a|an) (?:fact|concept|opinion|matter)\b|is (?:a|an) (?:philosophical|religious|political|legal) (?:concept|term)|in the (?:strict|literal) sense|o que se entende por|se define como|par définition)\b/iu, "defines or disputes what a word means"],
  ["sourced statement", /\b(?:according to|the (?:report|study|assessment|filing|ruling|record|transcript|data|census|survey)\s+(?:says|shows|found|concluded|states)|(?:historians|scientists|researchers|economists|intelligence|investigators|the court|the (?:un|who|odni|cia|fbi))\s+(?:say|says|found|concluded|agree|place|assessed|reported)|declassified|peer[- ]reviewed|published in|https?:\/\/)/iu, "names or links its source"],
  ["classification", /\b(?:is|was|are|were)\s+(?:not\s+)?(?:a\s+|an\s+)?(?:(?:far|hard|radical|extreme|literal|real|true)[- ]?)?(?:\w+\s+){0,3}?(?:\w+ists?|\w+isms?|extremists?|terrorists?|dictators?|tyrants?)\b/iu, "puts a person, group or idea in a category"],
  ["inference", /(?:^|\W)(?:therefore|thus|hence|so|which means|that means|this means|would mean|it follows|proves that|must have|clearly)\b/iu, "a conclusion connective"],
  ["opinion or value", /\b(?:i think|i believe|in my (?:view|opinion)|should|ought to|must|best|worst|greatest|terrible|disgusting|amazing|stupid|scary|evil|shameful|pathetic|beautiful|deserves?|everyone should)\b|!\s*$/iu, "evaluative or first-person wording"],
];
const FACT = /\b\p{Lu}\p{Ll}+\s+\w+ed\b|\b(?:\d{4}|\d+(?:[.,]\d+)?\s*(?:%|percent|million|billion|thousand)|(?:was|were|is|are|has|have|had|did)\s+\w+ed\b|(?:killed|hired|sent|signed|voted|said|wrote|published|arrested|paid|launched|invented|founded|died|won|lost|built|funded|ordered)\b)/iu;
const LINK = /https?:\/\/|\b\w+\.(?:com|org|gov|edu|net)\/\S+/iu;

// Words too general to count as fresh in a conclusion.
const PLAIN = new Set(["claim", "mean", "would", "could", "thing", "fact", "point", "case", "make", "made"]);

// One sentence's type: { type, cue }.
export function claimTypeOf(sentence) {
  const s = sentence.trim();
  for (const [type, re, cue] of RULES) if (re.test(s)) return { type, cue };
  if (FACT.test(s)) return LINK.test(s) ? { type: "factual claim with a link", cue: "a statement of fact with a link" } : { type: "factual claim, no source", cue: "a statement of fact with no source given" };
  return { type: "statement", cue: "no cue for a narrower type" };
}

// Every sentence of a post, typed.
export function claimTypes(text) {
  const t = String(text || "");
  return segment(t, guessLang(t)).flatMap((s) => s.text.split(/\n+/)).map((x) => x.trim()).filter((x) => x.length > 3).map((x) => ({ text: x, ...claimTypeOf(x) }));
}

// Claims about a third party's mind: knowing, wanting, intending, fearing, lying on purpose.
const MIND = /\b(?:he|she|they|his|her|their|[A-Z][a-z]+|(?:[Tt]he|[Tt]his|[Tt]hat)(?:\s+[a-z]+){1,2})\s+(?:absolutely |clearly |obviously |secretly )?(?:knows|knew|is aware|was aware|wants|wanted|intends|intended|is afraid|was afraid|fears|plans|planned|meant to|pretends|is pretending)\b|\b(?:a |the )?(?:calculated|deliberate|intentional) (?:lie|deception|move)\b|\bon purpose\b|\bit'?s (?:all )?about the (?:[Mm]oney|[Bb]enjamins)\b|\b(?:his|her|their) (?:real|true) (?:motive|reason|goal|agenda)\b/u;

// F9: { kind, text, why } for each gap in a post.
export function inferenceGaps(text, lang = null) {
  const out = [], t = String(text || "");
  for (const s of t.match(SENT) || []) {
    const m = s.match(MIND);
    if (m) out.push({ kind: "mind", text: s.trim(), cue: m[0], why: "It states what someone else knows, wants or intends, which a post cannot show." });
  }
  const r = readArgument(t, lang);
  const premises = r.segments.filter((s) => s.role !== "conclusion"), have = new Set(premises.flatMap((s) => content(s.text)));
  for (const c of r.segments.filter((s) => s.role === "conclusion")) {
    if (!premises.length) continue;
    const words = [...new Set(content(c.text))].filter((w) => w.length > 3 && !PLAIN.has(w)), fresh = words.filter((w) => !have.has(w));
    if (words.length >= 4 && fresh.length / words.length >= 0.6) out.push({ kind: "leap", text: c.text, cue: c.opener ? c.opener.form : "", fresh: fresh.slice(0, 8), why: `The conclusion brings ${fresh.length} of its ${words.length} meaning words in fresh: ${fresh.slice(0, 5).join(", ")}. The premises before it do not contain them.` });
  }
  return out;
}
