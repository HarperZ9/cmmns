// The argument lens (project-docs/ARGUMENT-LENS.md), after the reading method in Aliocha's notes on the
// Summa: split a passage into segments, mark the connective that opens each one, give each segment a
// role by its position in the argument (premise, minor premise, supporting premise, assumption,
// conclusion, turn), and group segments into movements (a list of arguments, a chain, a turn).
// A connective is what the author says links two claims. The lens shows "the author marks this as
// following", never "this follows".
import { CUES, CLAUSE_START, POSTPOSITIVE, LANGS } from "./argument-cues.js";
import { content } from "./text.js";

const LETTER = "\\p{L}";
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const COMPILED = Object.fromEntries(LANGS.map((l) => [l, CUES[l].slice().sort((a, b) => b.form.length - a.form.length)
  .map((c) => ({ ...c, re: new RegExp(`(?<!${LETTER})${esc(c.form).replace(/ /g, "\\s+")}(?!${LETTER})`, "giu") }))]));

// Strong punctuation ends a segment; a comma does not. A full stop after these abbreviations does not.
const ABBREV = new Set(["mr", "mrs", "ms", "dr", "st", "vs", "cf", "eg", "ie", "e.g", "i.e", "p", "pp", "ch", "art", "q", "obj", "ad", "no", "sr", "sra", "m", "mme"]);
const STRONG = /[.;!?]/;
// Where the clause a position sits in starts: after strong punctuation or a colon, or at the start.
function clauseStartAt(text, i) {
  let j = i - 1;
  while (j >= 0 && /\s/.test(text[j])) j--;
  return j < 0 || /[.;:!?(“"]/.test(text[j]) ? "strong" : text[j] === "," ? "comma" : null;
}
// The word before position i, and where it starts.
function prevWord(text, i) {
  const m = text.slice(0, i).match(/([\p{L}\d'-]+)\s*$/u);
  return m ? { word: m[1], at: i - m[0].length } : null;
}

// Every connective in the text: { start, end, form, roles, clause: "strong" | "comma" | null }.
export function findConnectives(text, lang) {
  const out = [], taken = [];
  for (const c of COMPILED[lang] || []) {
    for (const m of text.matchAll(c.re)) {
      const start = m.index, end = start + m[0].length;
      if (taken.some(([a, b]) => start < b && end > a)) continue;
      let clause = clauseStartAt(text, start);
      if (!clause && POSTPOSITIVE[lang] && POSTPOSITIVE[lang].has(c.form)) { const p = prevWord(text, start); if (p) clause = clauseStartAt(text, p.at); }
      if (CLAUSE_START[lang] && CLAUSE_START[lang].has(c.form) && !clause) continue;
      taken.push([start, end]);
      out.push({ start, end, form: m[0].toLowerCase().replace(/\s+/g, " "), roles: c.roles, clause });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

// The language whose connectives the text uses most, or the one the site gave.
export function guessLang(text, given = null) {
  if (given && CUES[given]) return given;
  let best = "en", n = 0;
  for (const l of LANGS) { const k = findConnectives(text, l).length; if (k > n) { best = l; n = k; } }
  return best;
}

// Segments: cut at strong punctuation. Each keeps the connectives in its first three words.
export function segment(text, lang) {
  const cons = findConnectives(text, lang), segs = [];
  let start = 0;
  const push = (end) => {
    const raw = text.slice(start, end), lead = raw.length - raw.trimStart().length, s = start + lead, e = start + raw.trimEnd().length;
    if (e > s && /[\p{L}\d]/u.test(text.slice(s, e))) {
      const words = [...text.slice(s, e).matchAll(/[\p{L}\d'-]+/gu)], third = words[2] ? s + words[2].index + words[2][0].length : e;
      segs.push({ start: s, end: e, text: text.slice(s, e), openers: cons.filter((c) => c.start >= s && c.start < third), inner: cons.filter((c) => c.start >= third && c.start < e) });
    }
    start = end;
  };
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    if (/["\u201c\u201d]/.test(text[i])) quoted = text[i] === "\u201c" ? true : text[i] === "\u201d" ? false : !quoted;
    // a stop inside quotation marks, or not followed by a space or the end (a URL, "U.S."), does not cut
    if (!STRONG.test(text[i]) || quoted || (i + 1 < text.length && !/[\s"\u201d)]/.test(text[i + 1]))) continue;
    const w = prevWord(text, i);
    if (text[i] === "." && w && (ABBREV.has(w.word.toLowerCase()) || /^\p{Lu}$/u.test(w.word))) continue;
    push(i + 1);
  }
  push(text.length);
  return segs;
}

const has = (seg, role) => seg.openers.some((c) => c.roles.includes(role));
const opensWith = (seg, role) => seg.openers.length && seg.openers[0].roles[0] === role;
const ASSUME = /^(?:\W*)(?:if|suppose|assuming|given that|se|si|caso|supposons|suponiendo|supondo)\b/iu;

// Roles by position. A unit is one argument: it starts at the first segment or at a segment opened by a
// continuation ("Praeterea", "Moreover"), and a conclusion closes it.
export function readArgument(text, lang = null) {
  const L = guessLang(text, lang), segs = segment(text, L), units = [];
  let unit = null;
  for (const s of segs) {
    const isC = has(s, "conclusion") && !opensWith(s, "condition");
    if (!unit || (opensWith(s, "continuation") && !isC) || (unit.closed && !isC)) { unit = { segments: [], closed: false, opener: s.openers[0] || null }; units.push(unit); }
    s.role = isC ? "conclusion" : null;
    unit.segments.push(s);
    if (isC) unit.closed = true;
  }
  for (const u of units) labelUnit(u);
  return { lang: L, segments: segs.map(({ start, end, text: t, role, openers }) => ({ start, end, text: t, role, opener: openers[0] ? { form: openers[0].form, roles: openers[0].roles } : null })), units: units.map((u, i) => ({ segments: u.segments.map((s) => segs.indexOf(s)), movement: movement(u, units[i - 1]) })) };
}

function labelUnit(u) {
  const segs = u.segments, lastC = segs.map((s) => s.role === "conclusion").lastIndexOf(true);
  let sawMinor = false;
  segs.forEach((s, i) => {
    if (s.role) return;
    const minorish = has(s, "minor"), before = segs.slice(0, i).some((x) => !x.role || x.role === "premise" || x.role === "assumption");
    if (minorish && before && lastC > i) { s.role = sawMinor ? "supporting premise" : "minor premise"; sawMinor = true; }
    else if (has(s, "reversal") && !(lastC > i)) s.role = "turn";
    else if (ASSUME.test(s.text.replace(/^[\p{L}]+,\s*/u, (m) => (has(s, "continuation") ? "" : m)))) s.role = "assumption";
    else s.role = "premise";
  });
}

// How a unit moves against the one before: a list (opened by "Moreover", "Praeterea"), a turn (opened
// by "But", "However", "Sed contra", or holding a turn), a chain (its first premise takes up the
// previous conclusion's words) or a single argument.
function movement(u, prev) {
  const first = u.segments[0];
  if (u.segments.some((s) => s.role === "turn") || (first.openers[0] && first.openers[0].roles[0] === "reversal")) return "turn";
  if (first.openers[0] && first.openers[0].roles.includes("continuation") && prev) return "list";
  const prevC = prev && prev.segments.filter((s) => s.role === "conclusion").pop();
  if (prevC) { const a = new Set(content(prevC.text)); if (content(first.text).filter((w) => a.has(w)).length >= 2) return "chain"; }
  return "argument";
}

// The boundaries the lens draws: where each segment after the first starts.
export const boundaries = (reading) => reading.segments.slice(1).map((s) => s.start);
