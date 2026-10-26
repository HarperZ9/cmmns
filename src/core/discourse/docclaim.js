// The document-image claim check (project-docs/DISCOURSE.md). A post shows a letter, a filing or a
// report as pictures and says what it says. Daylight Commons reads each picture with its own text
// recogniser, on this device, then sets the post's key terms against the words on the pages: which
// appear, on which image, and which do not. It compares words, not meaning.
import { fold, containsNear, editDistance, STOP, snippet } from "./text.js";

export const DOC_DOES_NOT_PROVE = "A word missing from the pages shown does not mean the document never says it: pages can be missing, the recogniser can misread a word, and a document can say the same thing in other words. A word found can be used in another sense; read the line shown.";
const MAX_TERMS = 12;
// Words too common in letters and posts to tell anything apart.
const PLAIN = new Set("would could should about after again against because before being between both claim claims every first from have having into just like made make many more most much never other over people said same says since some still such than that their them then there these they this those through very what when where which while will with without your said also does doing done even here just know made says told yesterday today".split(" "));

// The terms a post stakes its claim on: phrases in quotation marks, names (runs of capitalised
// words), amounts, and its longer content words, with two-word phrases kept together.
export function keyTerms(text) {
  const t = String(text || ""), terms = [];
  const add = (s, kind) => { const k = s.trim(); if (k.length >= 3 && !terms.some((x) => fold(x.term) === fold(k))) terms.push({ term: k, kind }); };
  for (const m of t.matchAll(/["“]([^"”]{3,60})["”]/g)) add(m[1], "quoted");
  for (const m of t.matchAll(/\$?\d[\d,.]*\s*(?:million|billion|trillion|percent|%)?/gi)) if (/\d{2,}|million|billion|%/.test(m[0])) add(m[0], "amount");
  for (const m of t.matchAll(/\b([A-Z][a-z]+(?:\s+(?:[A-Z][a-z]+|of|al|de|la))*\s+[A-Z][a-z]+|[A-Z]{2,})\b/g)) add(m[1], "name");
  const ws = (fold(t).match(/[a-z]+/g) || []);
  for (let i = 0; i < ws.length - 1; i++) {
    const [a, b] = [ws[i], ws[i + 1]];
    if (a.length >= 6 && b.length >= 6 && !STOP.has(a) && !STOP.has(b) && !PLAIN.has(a) && !PLAIN.has(b)) add(`${a} ${b}`, "phrase");
  }
  for (const w of ws) if (w.length >= 7 && !STOP.has(w) && !PLAIN.has(w) && !terms.some((x) => fold(x.term).includes(w))) add(w, "word");
  return terms.slice(0, MAX_TERMS);
}

// Where one term appears in one page's text: a phrase must appear whole; a word may be off by one
// letter when it has six or more, for the recogniser's slips; a word's stem also counts
// ("clearances" finds "clearance").
export function findIn(page, term) {
  const p = fold(page).replace(/\s+/g, " "), t = fold(term).replace(/\s+/g, " ");
  if (p.includes(t)) return t;
  const parts = t.split(" ");
  if (parts.length === 1) {
    const stem = t.length > 7 ? t.slice(0, Math.max(6, t.length - 3)) : t;
    if (p.includes(stem)) return stem;
    return containsNear(p, t) ? t : null;
  }
  // A phrase: the same words in a row, each long word allowed one wrong letter.
  const ws = p.match(/[a-z0-9$]+/g) || [];
  const same = (a, b) => a === b || (b.length >= 6 && editDistance(a, b, 1) <= 1);
  for (let i = 0; i + parts.length <= ws.length; i++) if (parts.every((w, k) => same(ws[i + k], w))) return ws[i];
  return null;
}

// pages: [{ text, confidence }] in the order the post shows them. Returns the found and absent terms.
export function checkDocument(postText, pages) {
  const usable = (pages || []).filter((p) => p && p.text);
  const terms = keyTerms(postText);
  const found = [], absent = [];
  for (const x of terms) {
    const where = [];
    let shown = null;
    usable.forEach((p, i) => { const hit = findIn(p.text, x.term); if (hit) { where.push(i + 1); if (!shown) shown = snippet(p.text, [hit], 200); } });
    (where.length ? found : absent).push({ ...x, images: where, snippet: shown });
  }
  return { images: (pages || []).length, read: usable.length, terms: terms.length, found, absent };
}

const list = (xs) => xs.map((x) => `"${x.term}"`).join(", ");

// The window's rows for a finished check.
export function docRows(r) {
  if (!r || !r.terms) return [["Document check", "The post has no terms to look for."]];
  const n = r.read, img = `${n} ${n === 1 ? "image" : "images"} read`;
  const rows = [["Pages", `${img} of the ${r.images} the post shows. Pages the post does not show were not checked.`]];
  if (r.absent.length) rows.push(["Not on the pages shown", list(r.absent)]);
  if (r.found.length) rows.push(["On the pages shown", r.found.map((x) => `"${x.term}" (image ${x.images.join(", ")})`).join("; ")]);
  for (const x of r.found.filter((f) => f.kind !== "name" && f.kind !== "amount").slice(0, 3)) rows.push([`"${x.term}" in context`, x.snippet]);
  rows.push(["What it shows", DOC_DOES_NOT_PROVE]);
  return rows;
}
