// Picks the argument lens's gold passages (data/argument/passages.json): 60 public-domain passages, 12
// per language, chosen by rule before anyone annotates them, and split 6 development and 6 held out by
// a hash of the passage. Latin and English are the same 12 objections of the Summa, so the two can be
// compared line for line. In the other languages half the passages are the paragraphs with the most
// connectives and half are drawn by hash from every paragraph of the right length, so the set is not
// only the passages the lens is built for.
//   node scripts/argument-gold.mjs --cache DIR      (DIR holds the downloads listed in SOURCES)
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { findConnectives } from "../src/core/discourse/argument.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const CACHE = arg("--cache", join(ROOT, ".cache/argument"));
const hash = (s) => createHash("sha256").update(s).digest("hex");
const words = (s) => (s.match(/[\p{L}\d'-]+/gu) || []).length;

export const SOURCES = {
  la: { file: "sth1003.html", title: "Thomas Aquinas, Summa Theologiae I, qq. 3 to 11 (Leonine text)", link: "https://www.corpusthomisticum.org/sth1003.html", licence: "public domain (13th century; Leonine edition 1888)" },
  en: { file: "pg17611.txt", title: "Thomas Aquinas, Summa Theologica, Part I, trans. Fathers of the English Dominican Province (1920)", link: "https://www.gutenberg.org/ebooks/17611", licence: "public domain (published 1920)" },
  fr: { file: "pg13846.txt", title: "René Descartes, Discours de la méthode (1637)", link: "https://www.gutenberg.org/ebooks/13846", licence: "public domain" },
  es: { file: "pg28929.txt", title: "Jaime Balmes, El Criterio (1845)", link: "https://www.gutenberg.org/ebooks/28929", licence: "public domain" },
  pt: { file: "pg30070.txt", title: "Antero de Quental, Bom-senso e bom-gosto (1865)", link: "https://www.gutenberg.org/ebooks/30070", licence: "public domain" },
};
// The Summa objections both Latin and English use: question, article, objection.
const OBJECTIONS = [[3, 1, 1], [3, 1, 2], [3, 2, 1], [3, 3, 1], [3, 4, 2], [3, 7, 1], [4, 1, 1], [4, 2, 1], [5, 1, 1], [6, 1, 1], [7, 1, 1], [8, 1, 1]];

function latin() {
  const t = readFileSync(join(CACHE, SOURCES.la.file), "latin1"), out = [];
  for (const [q, a, o] of OBJECTIONS) {
    const m = t.match(new RegExp(`<P TITLE="I q\\. ${q} a\\. ${a} arg\\. ${o}">([\\s\\S]*?)</P>`));
    if (!m) throw new Error(`Latin: I q.${q} a.${a} arg.${o} not found`);
    const text = m[1].replace(/<SPAN CLASS="ref">[\s\S]*?<\/SPAN>/, "").replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
    out.push({ locator: `I q.${q} a.${a} obj.${o}`, text });
  }
  return out;
}

function english() {
  const t = readFileSync(join(CACHE, SOURCES.en.file), "utf8").replace(/\r/g, ""), out = [];
  for (const [q, a, o] of OBJECTIONS) {
    const ai = t.indexOf(`[I, Q. ${q}, Art. ${a}]`), next = t.indexOf("ARTICLE [", ai + 10);
    const oi = [t.indexOf(`\nObjection ${o}:`, ai), t.indexOf(`\nObj. ${o}:`, ai)].filter((x) => x > 0 && (next < 0 || x < next)).sort((x, y) => x - y)[0] ?? -1;
    if (ai < 0 || oi < 0) throw new Error(`English: Q${q} A${a} obj.${o} not found`);
    const para = t.slice(oi + 1, t.indexOf("\n\n", oi + 1)).replace(/^Obj(?:ection|\.) \d+:\s*/, "").replace(/\s+/g, " ").trim();
    out.push({ locator: `I q.${q} a.${a} obj.${o}`, text: para });
  }
  return out;
}

// Paragraphs of 40 to 160 words from a Gutenberg text, between its start and end markers.
function paragraphs(file) {
  const t = readFileSync(join(CACHE, file), "utf8").replace(/\r/g, "");
  const body = t.slice(t.indexOf("*** START"), t.indexOf("*** END") > 0 ? t.indexOf("*** END") : t.length);
  return body.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, " ").trim()).filter((p) => words(p) >= 40 && words(p) <= 160 && !/gutenberg|\[Illustration|^[^a-z]*$/i.test(p));
}

function prose(lang) {
  const ps = paragraphs(SOURCES[lang].file).map((text, i) => ({ text, i, n: findConnectives(text, lang).length, h: hash(lang + text) }));
  const byCues = [...ps].sort((a, b) => b.n - a.n || a.i - b.i).slice(0, 6);
  const rest = ps.filter((p) => !byCues.includes(p)).sort((a, b) => (a.h < b.h ? -1 : 1)).slice(0, 6);
  return [...byCues, ...rest].sort((a, b) => a.i - b.i).map((p) => ({ locator: `paragraph ${p.i + 1}`, text: p.text, picked: byCues.includes(p) ? "most connectives" : "drawn by hash" }));
}

const pick = { la: latin, en: english, fr: () => prose("fr"), es: () => prose("es"), pt: () => prose("pt") };
const passages = [];
for (const lang of Object.keys(SOURCES)) {
  const ps = pick[lang]();
  // the split: the six passages with the smallest hash are held out
  const held = new Set([...ps].sort((a, b) => (hash(a.text) < hash(b.text) ? -1 : 1)).slice(0, 6).map((p) => p.text));
  ps.forEach((p, k) => passages.push({ id: `${lang}-${String(k + 1).padStart(2, "0")}`, lang, split: held.has(p.text) ? "heldout" : "dev", source: SOURCES[lang].title, link: SOURCES[lang].link, licence: SOURCES[lang].licence, ...p, sha256: hash(p.text) }));
}
const out = { format: "daylight.argument-gold/1", fixed: "2026-10-26", rule: "scripts/argument-gold.mjs, run before any annotation", passages };
writeFileSync(join(ROOT, "data/argument/passages.json"), JSON.stringify(out, null, 1) + "\n");
// the annotation page reads the same file (docs/annotate/argument.html)
writeFileSync(join(ROOT, "docs/annotate/passages.json"), JSON.stringify(out, null, 1) + "\n");
console.log(`${passages.length} passages: ${Object.keys(SOURCES).map((l) => `${l} ${passages.filter((p) => p.lang === l).length}`).join(", ")}; set hash ${hash(JSON.stringify(passages.map((p) => p.sha256)))}`);
