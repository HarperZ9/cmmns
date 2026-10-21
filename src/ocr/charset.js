// The Latin recogniser's alphabet. Index 0 is the CTC blank; then printable ASCII and a few UI
// marks. Curly quotes and dashes are drawn in training but labelled with their plain forms, so the
// recogniser answers ' " and - for them; fold() applies the same mapping to any reference text.
const ASCII = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join("");
export const LATIN = "\u0000" + ASCII + "\u2026\u2022\u00b7\u20ac\u00a3\u00b0";

const FOLD = { "\u2018": "'", "\u2019": "'", "\u201a": "'", "\u2032": "'", "\u201c": '"', "\u201d": '"', "\u201e": '"', "\u2033": '"',
  "\u2010": "-", "\u2011": "-", "\u2012": "-", "\u2013": "-", "\u2014": "-", "\u2212": "-", "\u00a0": " ", "\u202f": " ", "\u2009": " " };

// Reference text in the recogniser's own terms: folded marks, runs of spaces as one.
export function fold(text) {
  return String(text || "").replace(/[\u2018\u2019\u201a\u2032\u201c\u201d\u201e\u2033\u2010-\u2014\u2212\u00a0\u202f\u2009]/g, (c) => FOLD[c]).replace(/[ \t]+/g, " ");
}

// Text for the matchers: the ellipsis spelled out, words broken across lines joined again.
export function plain(lines) {
  return lines.join("\n").replace(/\u2026/g, "...").replace(/(\p{L})-\n(\p{Ll})/gu, "$1$2").replace(/\s*\n\s*/g, " ").trim();
}
