// The quote finder (project-docs/DISCOURSE.md). It takes the quoted lines a post attributes to
// someone, looks for each in a bundled index of public-domain texts (src/ext/discourse/quotes.json),
// and checks a short list of sourced misattributions and of quotes attested outside the index.
// Every answer is one of: found, close paraphrase, listed as misattributed, attested elsewhere, or not
// found. "Not found" proves nothing: the index holds a few dozen works, not everything ever written.
import { content, fold, snippet, words } from "./text.js";

export const QUOTE_DOES_NOT_PROVE = "A match shows these words, or close ones, in the passage cited. It does not show the person meant what the post says, and a translation is a translator's wording. Not finding a quote proves nothing: the index holds a few dozen public-domain works.";
const MIN_WORDS = 5, MAX_QUERIES = 8;

// Quoted spans in a post: text inside quotation marks, and the "Name: words" lines of a list.
// Returns { quotes: [{ text, by }], list: { lines, named, sourced } | null }.
export function extractQuotes(post, names = []) {
  const text = String(post || "");
  const quotes = [];
  for (const m of text.matchAll(/["“«„]([^"“”«»„]{12,600})["”»“]/g)) {
    if (words(m[1]).length >= MIN_WORDS) quotes.push({ text: m[1].trim(), by: fullName(text, nameNear(text, m.index, m[0].length, names)) });
  }
  const list = nameList(text, names);
  if (!quotes.length && !list) {
    // A post that is one quote with a name on it, with no marks: "Name: words" or "words. - Name".
    const one = text.match(/^\s*([^:\n]{3,40}):\s*(.{25,400})$/s) || text.match(/^(.{25,400}?)\s*[-–]\s*([A-Z][\w .']{2,40})\s*$/s);
    if (one && names.some((n) => fold(one[0]).includes(fold(n)))) {
      const [q, by] = one[0].includes(":") && text.indexOf(":") < 40 ? [one[2], one[1]] : [one[1], one[2]];
      if (words(q).length >= MIN_WORDS) quotes.push({ text: q.trim(), by: by.trim() });
    }
  }
  return { quotes: quotes.slice(0, MAX_QUERIES), list };
}

// A surname as the post writes it in full: "Aurelius" in "Marcus Aurelius wrote" reads as "Marcus Aurelius".
function fullName(text, n) {
  if (!n || !/^[A-Za-z'-]+$/.test(n)) return n;
  const m = text.match(new RegExp(`((?:[A-Z][a-z]+ ){1,2})${n}\\b`));
  return m ? (m[1] + n).trim() : n;
}

// The name nearest a quote, within 120 characters before it or 60 after, from the known names.
function nameNear(text, at, len, names) {
  const before = fold(text.slice(Math.max(0, at - 120), at)), after = fold(text.slice(at + len, at + len + 60));
  let best = null, dist = Infinity;
  for (const n of names) {
    const k = fold(n), b = before.lastIndexOf(k), a = after.indexOf(k);
    // Distance from the end of the name, so "Marcus Aurelius" and "Aurelius" tie, and the longer wins.
    const db = b >= 0 ? before.length - (b + k.length) : Infinity, da = a >= 0 ? a : Infinity, d = Math.min(db, da);
    if (d < dist || (d === dist && best && n.length > best.length)) { best = n; dist = d; }
  }
  return best;
}

// Three or more lines of "Name: words" form a list of attributions. Counts how many lines name a
// known person and how many give any source (a link, a work's title in quotes, or a year in brackets).
function nameList(text, names) {
  const lines = text.split(/\n/).map((l) => l.replace(/^\s*[-•*\d.)]+\s*/, "")).filter((l) => /^[^:]{2,40}:\s*\S/.test(l));
  if (lines.length < 3) return null;
  const known = new Set(names.map(fold));
  const named = lines.filter((l) => known.has(fold(l.split(":")[0]).trim())).length;
  const sourced = lines.filter((l) => /https?:\/\/|\(\d{3,4}\)|["“][^"”]{3,60}["”],? (?:p\.|ch\.|book)/i.test(l)).length;
  const short = lines.filter((l) => words(l.split(":").slice(1).join(":")).length < MIN_WORDS).length;
  return { lines: lines.length, named, sourced, short };
}

// The searchable index over the bundled passages: content words to passage numbers, with each
// word's rarity. Built once, in the background worker, from quotes.json.
export function buildIndex(data) {
  const postings = new Map(), passages = data.passages || [];
  passages.forEach((p, i) => {
    for (const w of new Set(content(p[2]))) { let l = postings.get(w); if (!l) postings.set(w, (l = [])); l.push(i); }
  });
  const n = Math.max(1, passages.length), idf = (w) => Math.log(1 + n / ((postings.get(w) || []).length + 1));
  return { data, postings, idf, n };
}

// How much of the quote's meaning the passage holds: the share of the quote's content words, each
// weighted by rarity, that the passage contains; and the share of the quote's word pairs in order.
function cover(q, passageText, idf) {
  const p = new Set(content(passageText)), qs = [...new Set(q)];
  const total = qs.reduce((a, w) => a + idf(w), 0) || 1;
  const have = qs.filter((w) => p.has(w)).reduce((a, w) => a + idf(w), 0);
  const pw = " " + content(passageText).join(" ") + " ", pairs = q.slice(1).map((w, i) => ` ${q[i]} ${w} `);
  const inOrder = pairs.length ? pairs.filter((pr) => pw.includes(pr)).length / pairs.length : 0;
  return { share: have / total, inOrder, matched: qs.filter((w) => p.has(w)).length, of: qs.length };
}

// The best passages for one quote: candidates share at least two rare words with it.
export function searchIndex(index, quote, { limit = 3 } = {}) {
  const q = content(quote);
  if (q.length < 3) return [];
  // Every word votes by its rarity, so a short quote of common words still finds its passage.
  const votes = new Map();
  for (const w of new Set(q)) for (const i of index.postings.get(w) || []) votes.set(i, (votes.get(i) || 0) + index.idf(w));
  const exact = words(quote).join(" ");
  return [...votes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 200)
    .map(([i]) => { const p = index.data.passages[i]; const c = cover(q, p[2], index.idf); return { i, ...c, exact: words(p[2]).join(" ").includes(exact) }; })
    .sort((a, b) => (b.exact - a.exact) || (b.share - a.share) || (b.inOrder - a.inOrder)).slice(0, limit);
}

export const FOUND_AT = 0.85;
export const CLOSE_AT = 0.6;
// A paraphrase must carry most of the quote's rare words, at least three of them, with some of its
// word pairs in the same order.
const closeEnough = (b) => b.share >= CLOSE_AT && b.matched >= Math.max(3, Math.ceil(0.6 * b.of)) && b.inOrder >= 0.2;

// One quote's answer. by: the person the post credits, if any.
export function lookupQuote(index, quote, by = null) {
  const listed = matchList(index.data.misattributed || [], quote);
  if (listed) return { status: "misattributed", quote, by, entry: listed };
  const attested = matchList(index.data.attested || [], quote);
  if (attested) return { status: "attested", quote, by, entry: attested };
  const [best] = searchIndex(index, quote);
  const kind = !best ? "not-found" : best.exact || (best.share >= FOUND_AT && best.inOrder >= 0.5) ? "found" : closeEnough(best) ? "close" : "not-found";
  if (kind === "not-found") return { status: "not-found", quote, by, searched: worksBy(index.data, by) };
  const p = index.data.passages[best.i], work = index.data.works[p[0]];
  const otherAuthor = by && work.author && !fold(work.author).includes(fold(by).split(" ").pop()) && !fold(by).includes(fold(work.author).split(" ").pop());
  return { status: kind, quote, by, work, locator: p[1], passage: snippet(p[2], content(quote).slice(0, 3)), share: Math.round(best.share * 100) / 100, otherAuthor: !!otherAuthor };
}

// The curated lists match on meaning too, with a higher bar, since they hold one sentence each.
function matchList(list, quote) {
  const q = content(quote);
  if (q.length < 3) return null;
  const idf = () => 1;
  for (const e of list) { const c = cover(q, e.quote, idf); const back = cover(content(e.quote), quote, idf); if (c.share >= 0.75 && back.share >= 0.6) return e; }
  return null;
}

// The works by a credited person that the index holds, so "not found" can say where it looked.
function worksBy(data, by) {
  if (!by) return { works: (data.works || []).length, byPerson: null };
  const last = fold(by).split(" ").pop();
  return { works: (data.works || []).length, byPerson: (data.works || []).filter((w) => fold(w.author).includes(last)).map((w) => `${w.title} (${w.translator ? "trans. " + w.translator : "original"})`) };
}
