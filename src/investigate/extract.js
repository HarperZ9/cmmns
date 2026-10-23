// Claim extraction for `case run`. The rule path is deterministic: sentences with a checkable
// shape (a number or date, a quotation, a named party, an assertion verb) become proposed claims,
// each with the exact span it came from. A configured model may propose claims instead; a model's
// claim is kept only when its quote is found in the source text, so every proposal has a span.
import { jsonFrom, PROMPTS } from "./models.js";
import { datesInText } from "./timeline.js";

const BOILER = /\b(cookies?|subscribe|newsletter|sign up|log in|all rights reserved|advertisement|share this|read more|privacy policy|terms of (use|service)|click here|follow us|copyright)\b|©/i;
const ASSERT = /\b(said|says|told|tells|ordered|orders|confirmed|confirms|announced|announces|reported|reports|denied|denies|signed|paid|pays|voted|filed|will|plans?|restricted|restored|approved|blocked|launched|wrote|posted|claims?|admitted|agreed|cut|limited)\b/i;

// Sentences with their offsets in the text.
export function sentences(text) {
  const out = [], s = String(text || "");
  const re = /[^.!?\n]+(?:[.!?]+["”’)]?|\n|$)/g;
  let m;
  while ((m = re.exec(s))) {
    const raw = m[0], lead = raw.length - raw.trimStart().length, t = raw.trim();
    if (t) out.push({ text: t, start: m.index + lead, end: m.index + lead + t.length });
    if (m[0] === "") re.lastIndex++;
  }
  return out;
}

export function claimScore(t) {
  const words = t.split(/\s+/);
  if (words.length < 6 || words.length > 60 || /\?["”’)]?$/.test(t) || BOILER.test(t) || /^https?:\/\//.test(t)) return 0;
  let s = 0;
  if (/\d/.test(t)) s += 2;
  if (/["“”]/.test(t)) s += 1;
  if (words.slice(1).some((w) => /^\p{Lu}[\p{L}'’-]+/u.test(w))) s += 1;
  if (ASSERT.test(t)) s += 1;
  return s;
}

// Rule-based proposals from one source's text: [{ text, spans: [{ source, start, end, text }], date }].
export function ruleClaims(sourceId, text, { max = 12, year } = {}) {
  const scored = sentences(text).map((x, i) => ({ ...x, i, score: claimScore(x.text) })).filter((x) => x.score >= 2);
  const keep = scored.sort((a, b) => b.score - a.score || a.i - b.i).slice(0, max).sort((a, b) => a.i - b.i);
  return keep.map((x) => {
    const d = datesInText(x.text, year)[0];
    return { text: x.text, spans: [{ source: sourceId, start: x.start, end: x.end, text: x.text }], date: d ? d.day : null };
  });
}

// Where a quoted passage sits in the text, allowing for differences in white space. Or null.
export function locate(text, quote) {
  const q = String(quote || "").trim();
  if (!q) return null;
  let i = text.indexOf(q);
  if (i >= 0) return { start: i, end: i + q.length };
  const words = q.split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const m = new RegExp(words.join("\\s+")).exec(text);
  return m ? { start: m.index, end: m.index + m[0].length } : null;
}

// Model proposals from one source's text. Claims whose quote is not in the text are dropped and
// counted, never kept without a span.
export async function modelClaims(model, sourceId, text, { year } = {}) {
  const reply = jsonFrom(await model.complete(PROMPTS.claims(text.slice(0, 12000))));
  const list = Array.isArray(reply) ? reply : [];
  const out = [];
  let dropped = 0;
  for (const x of list) {
    const at = x && typeof x.claim === "string" ? locate(text, x.quote) : null;
    if (!at) { dropped++; continue; }
    const d = datesInText(x.claim, year)[0];
    out.push({ text: x.claim.trim(), spans: [{ source: sourceId, ...at, text: text.slice(at.start, at.end) }], date: d ? d.day : null });
  }
  return { claims: out, dropped };
}
