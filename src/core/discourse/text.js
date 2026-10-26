// Shared text tools for the discourse checks (project-docs/DISCOURSE.md): one normal form for a quote
// and a passage, so a modern paraphrase and a nineteenth-century translation meet on the same
// words. Pure functions; no data, no network.

// Older English the public-domain translations use, mapped to the words a post would use.
const ARCHAIC = new Map(Object.entries({
  thee: "you", thou: "you", thy: "your", thine: "your", thyself: "yourself", ye: "you",
  art: "are", hast: "have", hath: "has", doth: "does", dost: "do", shalt: "shall", wilt: "will",
  canst: "can", couldst: "could", wouldst: "would", shouldst: "should", mayst: "may", didst: "did",
  wast: "was", wert: "were", whence: "where", whither: "where", unto: "to", oft: "often", ere: "before",
}));

// Words that carry no meaning of their own for matching. Kept short on purpose: "not" and "never"
// stay, since they flip a quote.
export const STOP = new Set(("a an and are as at be been but by can could did do does for from had has have he her his i if in into is it its " +
  "me my of on or our she so than that the their them then there these they this those to too us was we were what when which who whom why " +
  "will with would you your yourself yourselves himself herself itself ourselves themselves shall should may might must also just very " +
  "all any each every such only own same other some more most much many upon about over under again once here how out up down off").split(" "));

// Letters only, lower case, accents folded, apostrophes and hyphenated line breaks joined.
export function fold(s) {
  return String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/(\w)-\s*\n\s*(\w)/g, "$1$2").replace(/[‘’ʼ']/g, "").toLowerCase();
}

// A light suffix strip, enough to meet "imagining" and "imagine", "thoughts" and "thought".
export function stem(w) {
  if (w.length <= 4) return w;
  if (w.endsWith("ies") && w.length > 5) return w.slice(0, -3) + "y";
  if (w.endsWith("ing") && w.length > 6) return w.slice(0, -3);
  if (w.endsWith("ed") && w.length > 5) return w.slice(0, -2);
  if (w.endsWith("es") && w.length > 5) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

// Every word of a text in order, archaic forms modernised and stemmed.
export function words(s) {
  return (fold(s).match(/[a-z0-9]+/g) || []).map((w) => stem(ARCHAIC.get(w) || w));
}

// The words that carry meaning, in order.
export const content = (s) => words(s).filter((w) => !STOP.has(w) && w.length > 1);

// Levenshtein distance with an early stop once it passes max.
export function editDistance(a, b, max = 3) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

// True when word w appears in s with at most one letter wrong (OCR slips, a doubled letter in a
// handle). Words under six letters must match exactly.
export function containsNear(s, w) {
  if (s.includes(w)) return true;
  if (w.length < 6) return false;
  for (let len = w.length - 1; len <= w.length + 1; len++) {
    for (let i = 0; i + len <= s.length; i++) if (editDistance(s.slice(i, i + len), w, 1) <= 1) return true;
  }
  return false;
}

// A short window of a passage around the first place one of the words occurs, cut at word edges.
export function snippet(text, near, max = 280) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const low = fold(t);
  const at = (near || []).map((w) => low.indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, at - Math.floor(max / 3));
  const cut = t.slice(start, start + max).replace(/^\S*\s/, start > 0 ? "" : "$&").replace(/\s\S*$/, "");
  return (start > 0 ? "… " : "") + cut + (start + max < t.length ? " …" : "");
}
