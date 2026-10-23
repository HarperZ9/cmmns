// The generic reader, for article and comment pages on sites Daylight Commons has no reader for. It runs only
// when the user opens the site card on a page (src/ext/generic-page.js walks the page and passes
// plain summaries here). It finds the article body as the block with the most paragraph text, and
// comments as the largest run of sibling boxes that share a shape and carry an author link or a
// time stamp. Then it runs the same text checks Daylight Commons runs on replies. Nothing leaves the browser.
//
// These are structural guesses, not a site reader: they can miss comments, take a list of related
// links for comments, or read a sidebar as the article. The card says so beside every count.

import { score } from "./rhetoric.js";
import { persuasion } from "./persuasion.js";
import { machineSigns } from "./machine.js";

export const GENERIC_MAX_COMMENTS = 200;
const ARTICLE_MIN = 500, PARA_MIN = 40, ARTICLE_MAX = 20000;

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

// blocks: [{ paragraphs: [text] }]. The block with the most text in paragraphs of 40 or more
// characters, if it holds at least 500; its text, capped at 20,000 characters.
export function pickArticle(blocks) {
  let best = null, bestLen = 0;
  for (const b of blocks || []) {
    const paras = (b.paragraphs || []).map((p) => String(p || "").trim()).filter((p) => p.length >= PARA_MIN);
    const len = paras.reduce((n, p) => n + p.length, 0);
    if (len > bestLen) { best = paras; bestLen = len; }
  }
  return best && bestLen >= ARTICLE_MIN ? best.join("\n\n").slice(0, ARTICLE_MAX) : null;
}

// groups: [{ items: [{ text, hasTime, author }] }], each a run of siblings with one shape. The
// comment list is the group with at least three boxes where most carry an author or a time stamp
// and the typical box holds 15 to 3,000 characters; the largest such group wins.
export function pickComments(groups) {
  let best = null, bestScore = 0;
  for (const g of groups || []) {
    const items = (g.items || []).filter((x) => x && typeof x.text === "string");
    if (items.length < 3) continue;
    const marked = items.filter((x) => x.hasTime || x.author).length / items.length;
    const typical = median(items.map((x) => x.text.trim().length));
    if (marked < 0.5 || typical < 15 || typical > 3000) continue;
    const s = items.length * marked;
    if (s > bestScore) { best = items; bestScore = s; }
  }
  return best ? best.slice(0, GENERIC_MAX_COMMENTS).map((x) => ({ text: x.text.trim(), author: x.author || null, hasTime: !!x.hasTime })) : null;
}

const norm = (t) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

// The text checks on what the page offered, as counts. No post text is kept in the result.
export function genericChecks({ article, comments }) {
  const out = { article: null, comments: null };
  if (article) {
    const sc = score(article), pe = persuasion(article), ma = machineSigns(article);
    out.article = { chars: article.length, markers: sc.markers.map((m) => m.family), techniques: pe.map((h) => h.technique), machineLike: !!ma.machineLike, leak: !!ma.leak };
  }
  if (comments && comments.length) {
    const seen = new Map();
    let marked = 0, persuasive = 0, machine = 0;
    for (const c of comments) {
      if (score(c.text).markers.length) marked++;
      if (persuasion(c.text).length) persuasive++;
      if (machineSigns(c.text).machineLike) machine++;
      const k = norm(c.text);
      if (k.length >= 20) seen.set(k, (seen.get(k) || 0) + 1);
    }
    const repeats = [...seen.values()].filter((n) => n >= 2);
    out.comments = { n: comments.length, withAuthor: comments.filter((c) => c.author).length, marked, persuasive, machine, repeatedTexts: repeats.length, largestRepeat: repeats.length ? Math.max(...repeats) : 0 };
  }
  return out;
}

export const GENERIC_DOES_NOT_PROVE = "The generic reader guessed where the article and the comments are from the page's layout, so it can miss comments or count a list of links as comments. A marker is a pattern in wording.";
