// Builds the quote finder's index (src/ext/discourse/quotes.json) from the public-domain texts listed
// in data/discourse/texts.json. Each text is cut to the work's own words (begin and end markers),
// split into paragraphs, and each paragraph gets a locator from the headings above it.
const MAX_PASSAGE = 900;

// The work's own lines, without the Project Gutenberg header and licence and without front and back
// matter by other hands.
export function workLines(raw, t) {
  const lines = String(raw).replace(/\r/g, "").split("\n");
  const begin = new RegExp(t.begin), end = t.end ? new RegExp(t.end) : null;
  let start = -1, seen = 0;
  for (let i = 0; i < lines.length; i++) if (begin.test(lines[i]) && ++seen === (t.nth || 1)) { start = i; break; }
  if (start < 0) throw new Error(`${t.id}: begin marker ${t.begin} (occurrence ${t.nth || 1}) not found`);
  let stop = lines.findIndex((l, i) => i > start && ((end && end.test(l)) || /^\*\*\* END OF (THE|THIS) PROJECT GUTENBERG|^End of (the )?Project Gutenberg/i.test(l)));
  if (stop < 0) stop = lines.length;
  return lines.slice(start, stop);
}

// Lines a machine-read scan adds that are not the text: running heads, page numbers, specks.
function ocrNoise(l) {
  const s = l.trim();
  return /DOSTOEVSKY'?S\s+LETTERS/i.test(s) || /^\S{0,4}\s*\d+[-–]\d+\]/.test(s) || /^\d{1,3}$/.test(s) || (s.length > 0 && (s.match(/[A-Za-z]/g) || []).length < 3);
}

// "THE FIRST BOOK" reads as "The First Book"; Roman numerals stay as they are.
const titleCase = (s) => s.replace(/[A-Z’']{2,}/g, (w) => (/^[IVXLC]+$/.test(w) ? w : w[0] + w.slice(1).toLowerCase()));
const tidy = (s) => s.replace(/(\w)-\s+(\w)/g, "$1$2").replace(/\s+/g, " ").replace(/_([^_]+)_/g, "$1").trim();

// Paragraphs with their locators. heads: [{ re, as }], one per level; section: a pattern at the start
// of a paragraph that numbers it.
export function passages(lines, t) {
  const heads = (t.heads || []).map((h) => ({ re: new RegExp(h.re), as: h.as }));
  const section = t.section ? new RegExp(t.section) : null;
  const where = heads.map(() => null), out = [];
  let buf = [], count = 0;
  const flush = () => {
    const whole = tidy(buf.join(" "));
    buf = [];
    // Some editions run several numbered sections into one paragraph; each becomes its own passage.
    for (const text of t.splitSections ? whole.split(/\s(?=[IVXLC]{1,7}\.\s+[A-Z])/) : [whole]) {
      if (text.length < 40) continue;
      count++;
      const sec = section && text.match(section);
      const loc = [...where.filter(Boolean), sec ? `section ${sec[1]}` : null].filter(Boolean).join(", ") || `paragraph ${count}`;
      for (const chunk of split(text)) out.push([loc, chunk]);
    }
  };
  for (const raw of lines) {
    const l = raw.trim();
    const level = heads.findIndex((h) => h.re.test(l));
    if (level < 0 && t.ocr && ocrNoise(raw)) continue;
    if (level >= 0) {
      flush();
      where[level] = titleCase(l.replace(heads[level].re, heads[level].as).replace(/\s+/g, " ").replace(/\.$/, ""));
      for (let k = level + 1; k < where.length; k++) where[k] = null;
      continue;
    }
    if (!l) flush(); else buf.push(l);
  }
  flush();
  return out;
}

// A long paragraph in sentence-bounded pieces of up to MAX_PASSAGE characters.
function split(text) {
  if (text.length <= MAX_PASSAGE) return [text];
  const out = [];
  let cur = "";
  for (const s of text.match(/[^.!?;]+[.!?;]+["'”’)]*\s*|[^.!?;]+$/g) || [text]) {
    if (cur && cur.length + s.length > MAX_PASSAGE) { out.push(cur.trim()); cur = ""; }
    cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// The index file: works, passages as [work, locator, text], and the curated lists.
export function buildQuotes(manifest, readRaw, mis, att) {
  const works = [], all = [];
  manifest.texts.forEach((t, w) => {
    works.push({ id: t.id, title: t.title, author: t.author, translator: t.translator || null, year: t.year || null, link: t.link, licence: "public domain", ...(t.note ? { note: t.note } : {}) });
    for (const [loc, text] of passages(workLines(readRaw(t), t), t)) all.push([w, loc, text]);
  });
  return { format: "daylight.quotes/1", retrieved: manifest.retrieved, works, passages: all, misattributed: mis.misattributed, attested: att.attested };
}
