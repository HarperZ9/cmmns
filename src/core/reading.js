// The reading lens: names the techniques a post uses, at the span, and weighs each one by its
// context (reading-inflection.js). A finding is { technique, name, family, start, end, match,
// weight, shown, top }: the span, its name, and the two factors that moved its weight.
// Thread and feed patterns count how many posts and authors use the same technique, so a frame
// repeated across a thread shows as a pattern. Pure: no DOM, no network.
// Which techniques the window shows comes from held-out measurement (reading-measured.js): a
// technique under READING_SHIP_PRECISION held-out precision stays off.

import { READING_RULES, TECHNIQUE_BY_ID, READING_TECHNIQUES } from "./reading-cues.js";
import { postFactors, matchFactors, inflect } from "./reading-inflection.js";
import { READING_MEASURED } from "./reading-measured.js";

export const READING_SHIP_PRECISION = 0.8;
export const READING_SHIP_MIN_N = 3;

// Techniques the window shows: held-out precision at or above the bar from enough hits.
export function readingOn(table = READING_MEASURED) {
  return new Set(READING_TECHNIQUES.map((t) => t.id).filter((id) => { const r = (table || {})[id]; return !!(r && r.on); }));
}

// The shown set for a user's settings: every technique when they turned the lens fully on.
export const lensOn = (settings) => (settings && settings.lensAll ? new Set(READING_TECHNIQUES.map((t) => t.id)) : readingOn());

// Every cue match in the text, overlapping matches of one technique merged into the first.
export function cueHits(text) {
  const s = String(text || "").replace(/[’]/g, "'");
  const hits = [];
  for (const r of READING_RULES) {
    r.re.lastIndex = 0;
    for (const m of s.matchAll(r.re)) if (m[0].trim()) hits.push({ technique: r.technique, cue: r.cue, start: m.index, end: m.index + m[0].length });
  }
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const out = [];
  for (const h of hits) if (!out.some((o) => o.technique === h.technique && h.start < o.end && o.start < h.end)) out.push(h);
  return out.map((h) => ({ ...h, match: String(text || "").slice(h.start, h.end) }));
}

// Who uses which technique in a thread, from the raw cue hits.
function usage(posts, hits) {
  const authorsOf = new Map(), rebutters = new Set();
  posts.forEach((p, i) => {
    if (postFactors(p.text).rebuts) rebutters.add(`${p.author}#${i}`);
    for (const t of new Set(hits[i].map((h) => h.technique))) {
      if (!authorsOf.has(t)) authorsOf.set(t, []);
      authorsOf.get(t).push({ author: p.author, i });
    }
  });
  return { authorsOf, rebutters };
}

function context(posts, i, technique, U) {
  const users = U.authorsOf.get(technique) || [], me = posts[i].author, rootAt = posts.findIndex((p) => p.role === "root");
  return {
    echo: new Set(users.filter((u) => u.author !== me).map((u) => u.author)).size,
    root: rootAt >= 0 && rootAt !== i && users.some((u) => u.i === rootAt) ? 1 : 0,
    repeat: users.some((u) => u.author === me && u.i !== i) ? 1 : 0,
    authorRebuts: [...U.rebutters].some((k) => k.startsWith(`${me}#`) && k !== `${me}#${i}`) ? 1 : 0,
  };
}

// posts: [{ id, author, text, role? }] in thread order. Returns one entry per post:
// { id, findings }. Options: inflection (default true), on (the shown set; default readingOn()).
export function readThread(posts, { inflection = true, on = readingOn(), withFactors = false } = {}) {
  const P = posts.map((p) => ({ id: String(p.id), author: String(p.author || ""), text: String(p.text || ""), role: p.role || "reply" }));
  const hits = P.map((p) => cueHits(p.text));
  const U = usage(P, hits);
  return P.map((p, i) => {
    const base = postFactors(p.text);
    const findings = hits[i].map((h) => {
      const t = TECHNIQUE_BY_ID.get(h.technique);
      const factors = matchFactors(p.text, h, base, context(P, i, h.technique, U)), inf = inflect(factors);
      const kept = inflection ? inf.shown : true;
      const f = { technique: t.id, name: t.name, family: t.family, start: h.start, end: h.end, match: h.match.trim().slice(0, 120),
        weight: inf.weight, top: inf.top, shown: kept && on.has(t.id) };
      return withFactors ? { ...f, factors } : f;
    });
    return { id: p.id, findings };
  });
}

// One post read on its own.
export const readPost = (text, opts) => readThread([{ id: "post", author: "", text, role: "root" }], opts)[0].findings;

// How many posts and authors use each shown technique: [{ technique, name, posts, authors, of }],
// most used first. A technique in two or more posts by two or more authors is a pattern.
export function patternCounts(read, posts) {
  const by = new Map();
  read.forEach((r, i) => {
    for (const t of new Set(r.findings.filter((f) => f.shown).map((f) => f.technique))) {
      if (!by.has(t)) by.set(t, { posts: 0, authors: new Set() });
      const x = by.get(t);
      x.posts++;
      x.authors.add(String((posts[i] || {}).author || i));
    }
  });
  return [...by.entries()].map(([t, x]) => ({ technique: t, name: TECHNIQUE_BY_ID.get(t).name, posts: x.posts, authors: x.authors.size, of: read.length,
    pattern: x.posts >= 2 && x.authors.size >= 2 })).sort((a, b) => b.posts - a.posts || a.technique.localeCompare(b.technique));
}

// A whole thread: per-post findings plus the thread's pattern counts.
export function readingReport(posts, opts) {
  const read = readThread(posts, opts);
  return { posts: read, patterns: patternCounts(read, posts) };
}

// A feed is not a conversation: each post is read on its own, then the frames are counted.
export function feedPatterns(posts, opts) {
  const read = posts.map((p) => ({ id: String(p.id), findings: readThread([{ ...p, role: "root" }], opts)[0].findings }));
  return patternCounts(read, posts);
}
