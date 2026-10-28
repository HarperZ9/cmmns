// Episodic and thematic framing (Iyengar, "Is Anyone Responsible? How Television Frames Political
// Issues", University of Chicago Press, 1991). An episodic frame tells an issue through one person's
// case or one event; a thematic frame places it in context: trends, numbers, causes, policies,
// systems. Iyengar found episodic coverage leads viewers to hold the individual responsible and
// thematic coverage leads them to hold society or government responsible. The operational split
// follows the narrative-frame part of the codebook of Mendelsohn, Budak and Jurgens, "Modeling
// Framing in Immigration Discourse on Social Media" (NAACL 2021), which codes a post episodic when
// it centres a specific person or event and thematic when it gives broader context. CMMNS cites
// that codebook and copies none of its text.
//
// A cue names no group, person, party, side or issue: the same sentence reads alike whatever it is
// about (tests/framing.symmetry.test.js). The person-story sign is a post that tells the issue only
// through one individual's story, with no structural cue at all. It is held back: no labelled
// corpus with a usable licence exists to measure it (project-docs/EVALUATION.md), so the window,
// the report and the dashboard show only that it is held, never a count.

export const FRAMING_MIN_WORDS = 12;

const EPISODIC = [
  "\\d{1,3}[- ]years?[- ]old", "(?:my|our) (?:[\\w-]+ )?(?:mom|mother|dad|father|son|daughter|brother|sister|wife|husband|partner|friend|best friend|neighbou?r|cousin|uncle|aunt|grandmother|grandfather|grandma|grandpa|coworker|colleague|kid|child|baby|boss|landlord)",
  "(?:this|one|a|the) (?:young |single |elderly |local )?(?:woman|man|mother|father|mom|dad|girl|boy|child|kid|family|teen|teenager|student|veteran|nurse|worker|widow|grandmother|grandfather|toddler) (?:who|was|had|lost|died|says|said|is|has|got|could)",
  "(?:her|his|their) (?:story|ordeal|family says|mother says|father says)", "(?:he|she) (?:was|had been|got) (?:killed|shot|arrested|fired|laid off|evicted|deported|attacked|beaten|hospitali[sz]ed|denied|detained|stabbed|robbed)",
  "(?:lost|losing) (?:her|his|my) (?:job|home|house|son|daughter|husband|wife|life|benefits|insurance|business)",
  "(?:i|we) (?:lost|was|were|got) (?:fired|laid off|evicted|denied|attacked|robbed|turned away|hospitali[sz]ed)", "happened to (?:me|my|her|him)", "when i was (?:a|in|at)",
  { cue: "Meet [A-Z][a-z]+", caseSensitive: true },
];
const THEMATIC = [
  "\\d+(?:[.,]\\d+)?\\s?(?:%|percent|per cent)", "per capita", "(?:the )?(?:rate|rates|share|number) of", "on average", "nationwide", "nationally", "statewide",
  "across the (?:country|nation|state|region|world)", "(?:study|studies|survey|census|report|data|statistics|figures) (?:show|shows|showed|found|finds|suggest|suggests)",
  "polic(?:y|ies)", "legislation", "(?:the |this |a |new )law", "laws", "funding", "budget", "regulations?", "systemic", "structural", "institutional", "the system",
  "since (?:19|20)\\d\\d", "over the (?:past|last) (?:decade|century|\\d+ years)", "trends?", "(?:root )?causes? of", "(?:millions|thousands|hundreds of thousands) of (?:people|families|workers|children|residents)",
];

const compile = (c) => { const { cue, caseSensitive } = typeof c === "string" ? { cue: c } : c; return new RegExp(`(?<![\\w'])(?:${cue})(?![\\w'])`, caseSensitive ? "g" : "gi"); };
const EP = EPISODIC.map(compile), TH = THEMATIC.map(compile);
const words = (s) => (s.match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) || []).length;

function hits(res, s) {
  const out = [];
  for (const re of res) { re.lastIndex = 0; for (const m of s.matchAll(re)) out.push(m[0]); }
  return out;
}

// { episodic, thematic, frame, words } for one post. frame: "person-story" (episodic cues only),
// "structural" (thematic only), "mixed", or null (neither, or too short to read).
export function framingOf(text) {
  const s = String(text || "").replace(/[’]/g, "'");
  const n = words(s), episodic = hits(EP, s), thematic = hits(TH, s);
  let frame = null;
  if (n >= FRAMING_MIN_WORDS) frame = episodic.length && thematic.length ? "mixed" : episodic.length ? "person-story" : thematic.length ? "structural" : null;
  return { episodic, thematic, frame, words: n };
}

// Measurement row for the person-story sign: null until a licensed labelled corpus clears the bar.
// The bar: a 95% Wilson lower bound of at least 0.7 from at least 20 hits on held-out data.
export const MEASURED_FRAMING = null;
export const FRAMING_SHIP_LOW = 0.7, FRAMING_MIN_N = 20;
export function framingShown(row = MEASURED_FRAMING) {
  return !!(row && row.split === "test" && Number.isInteger(row.n) && row.n >= FRAMING_MIN_N && Number.isFinite(row.low) && row.low >= FRAMING_SHIP_LOW);
}
export function framingStatus(row = MEASURED_FRAMING) {
  if (!row) return { shown: false, text: "held back: not measured. A search for a labelled corpus of episodic and thematic posts with a usable licence came up empty (checked 2026-10-21)" };
  const pc = (x) => Math.round(x * 100);
  const m = `precision ${pc(row.precision)}% (95% interval ${pc(row.low)} to ${pc(row.high)}%), ${row.n} posts checked`;
  return framingShown(row) ? { shown: true, text: m } : { shown: false, text: `held back (interval starts below ${pc(FRAMING_SHIP_LOW)}% or fewer than ${FRAMING_MIN_N} hits): ${m}` };
}

export const FRAMING_DOES_NOT_PROVE = "This describes how the post explains the issue. A person's story can be true, typical and the best way to explain it.";

// The frame the feed log keeps for one post: framingOf's frame, "none" for a post long enough to
// read with neither kind of cue, or null for a post too short to read.
export function feedFrame(text) {
  const f = framingOf(text);
  return f.frame || (f.words >= FRAMING_MIN_WORDS ? "none" : null);
}
