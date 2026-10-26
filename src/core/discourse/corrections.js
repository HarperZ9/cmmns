// Correction replies (project-docs/DISCOURSE.md): among the replies the page has loaded, the ones
// that name a specific error in the post or bring a source, ranked by the source they bring. Likes,
// followers and the reply's side never enter the ranking, and no word list here names a party, a
// side or a group (tests/discourse.symmetry.test.js swaps the sides of fixture threads and expects
// the same order). A raised reply is a challenge to read, never a verdict.
import { content, fold } from "./text.js";

export const CORRECTIONS_DOES_NOT_PROVE = "A reply that brings a source or names an error can still be wrong. Daylight Commons ranks replies by the kind of source they cite and how specifically they answer the post, not by whether they are right.";

// Reference and primary-record hosts. A link to one of these is the strongest kind of source a reply
// can bring; any other web page counts for less; links to social posts count for nothing.
const PRIMARY = /(^|\.)(doi\.org|arxiv\.org|pubmed\.ncbi\.nlm\.nih\.gov|ncbi\.nlm\.nih\.gov|courtlistener\.com|supremecourt\.gov|legislation\.gov\.uk|eur-lex\.europa\.eu|congress\.gov|govinfo\.gov|dni\.gov|ohchr\.org|sec\.gov|census\.gov|gutenberg\.org|archive\.org|loc\.gov|nationalarchives\.gov\.uk|un\.org|who\.int|oecd\.org|worldbank\.org|imf\.org|data\.gov)$/;
const REFERENCE = /(^|\.)(wikipedia\.org|britannica\.com|plato\.stanford\.edu|iep\.utm\.edu|oxfordreference\.com|jstor\.org|nature\.com|science\.org|thelancet\.com|nejm\.org|bmj\.com|cell\.com|springer\.com|wiley\.com|tandfonline\.com|sciencedirect\.com|quoteinvestigator\.com|wikiquote\.org|snopes\.com|factcheck\.org|fullfact\.org|politifact\.com)$|\.(gov|edu|mil|int)$|\.(gov|ac|edu)\.[a-z]{2}$/;
const SOCIAL = /(^|\.)(x\.com|twitter\.com|t\.co|facebook\.com|instagram\.com|tiktok\.com|threads\.(net|com)|bsky\.app|reddit\.com|youtube\.com|youtu\.be)$/;

// Phrases that name an error or a correction. Neutral by construction: they describe the move.
const CUES = [
  /\bcorrections?\b/i, /\b(?:not|isn'?t|wasn'?t|aren'?t) (?:true|accurate|correct|what (?:he|she|they|it) said)\b/i,
  /\b(?:is|was|that'?s|this is) (?:false|wrong|inaccurate|incorrect|misleading|a misquote|misattributed)\b/i,
  /\bmisattribut\w*/i, /\bnever (?:said|wrote|happened)\b/i, /\b(?:in fact|actually|factually)\b/i,
  /\baccording to\b/i, /\bthe (?:source|record|transcript|original|full quote|paper|study|data) (?:says|shows|is)\b/i,
  /\b(?:first|originally) (?:published|said|written|appeared)\b/i, /\bfake quote\b/i, /\bout of context\b/i,
];

const hostOf = (u) => { try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; } };
export function sourceKind(url) {
  const h = hostOf(url);
  if (!h) return null;
  return PRIMARY.test(h) ? "primary" : REFERENCE.test(h) ? "reference" : SOCIAL.test(h) ? "social" : "web";
}
const KIND_SCORE = { primary: 3, reference: 2.5, web: 1, social: 0 };

// What a reply shares with the post it answers: content words of four letters or more, numbers and
// years. Two or more shared items make a cue "specific". The length bar is low on purpose: a higher
// one would treat "left" and "right" differently.
function shared(post, reply) {
  const p = new Set(content(post).filter((w) => w.length >= 4 || /^\d{2,}$/.test(w)));
  return [...new Set(content(reply))].filter((w) => p.has(w));
}

// One reply's reading: its sources, its quoted passage, its cues and what it shares with the post.
export function readReply(postText, r) {
  const kinds = (r.links || []).map(sourceKind).filter(Boolean);
  const best = kinds.sort((a, b) => KIND_SCORE[b] - KIND_SCORE[a])[0] || null;
  const quoted = (String(r.text).match(/["“]([^"”]{40,})["”]/) || [])[1] || null;
  const cues = CUES.filter((re) => re.test(r.text)).length;
  const common = shared(postText, r.text);
  const specific = common.length >= 2;
  const score = (best ? KIND_SCORE[best] : 0) + (quoted ? 1.5 : 0) + (cues && specific ? 1 + Math.min(1, common.length / 6) : 0);
  const raised = (best && best !== "social" && (common.length >= 1 || cues > 0)) || (quoted && specific) || (cues > 0 && specific);
  // The reply's origin: the host of its best link. Replies with the same origin are one witness, not
  // several (src/core/discourse/sheets.js independence).
  const origin = best && best !== "social" ? hostOf((r.links || []).find((u) => sourceKind(u) === best)) : null;
  return { id: r.id, author: r.author, score: Math.round(score * 100) / 100, raised: !!raised, source: best, origin, quoted: !!quoted, cues, shared: common.slice(0, 6) };
}

// The raised replies, best source first; ties keep the page's order. Likes are never read.
export function rankCorrections(post, replies) {
  const text = (post && post.text) || "";
  return (replies || []).map((r, order) => ({ ...readReply(text, r), order, text: r.text }))
    .filter((x) => x.raised && fold(x.author || "") !== fold((post && post.author) || "\u0000"))
    .sort((a, b) => b.score - a.score || a.order - b.order);
}

const why = (x) => [x.source ? `links a ${x.source === "primary" ? "primary record" : x.source === "reference" ? "reference work" : "web page"}` : null, x.quoted ? "quotes a passage" : null, x.cues && x.shared.length >= 2 ? `names an error about ${x.shared.slice(0, 3).join(", ")}` : null].filter(Boolean).join("; ");

// The window's rows: up to five raised replies, each with why it was raised.
export function correctionRows(ranked) {
  const rows = ranked.slice(0, 5).map((x) => [`@${x.author}`, `"${String(x.text).replace(/\s+/g, " ").slice(0, 160)}${x.text.length > 160 ? " …" : ""}" (${why(x)})`]);
  rows.push(["How they are ranked", "By the kind of source each reply brings, then by how specifically it answers the post. Likes and followers are not read."]);
  rows.push(["What it shows", CORRECTIONS_DOES_NOT_PROVE]);
  return rows;
}
