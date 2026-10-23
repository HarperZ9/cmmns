// The generic reader's page side, injected with the site card only on the user's click, on sites
// Daylight Commons has no reader for (src/ext/sources-bg.js). It walks the page once, passes plain summaries
// of paragraph blocks and repeated sibling boxes to src/core/generic.js, and gives the site card a
// "Text on this page" section with counts only. It reads only what the page shows and sends nothing.
(() => {
  "use strict";
  if (globalThis.PBGenericPage) return;
  const MAX_NODES = 8000, TEXT_MAX = 3000;
  const SKIP = "nav, header, footer, aside, form, [role=navigation], [role=banner], [role=contentinfo], .pb-pop";
  const AUTHOR = '[rel=author], [itemprop=author], [class*="author" i], [class*="username" i], a[href*="/user/"], a[href*="/u/"], a[href*="/profile"], a[href*="/@"]';
  const text = (el) => String(el.textContent || "").replace(/\s+/g, " ").trim();

  // Paragraph blocks: every <p>, grouped by its parent, plus article bodies marked as such.
  function blocks(root) {
    const byParent = new Map();
    for (const p of [...root.querySelectorAll("p")].slice(0, MAX_NODES)) {
      if (p.closest(SKIP)) continue;
      const box = p.closest('article, [itemprop="articleBody"], main') || p.parentElement;
      if (!byParent.has(box)) byParent.set(box, []);
      byParent.get(box).push(text(p));
    }
    return [...byParent.values()].map((paragraphs) => ({ paragraphs }));
  }

  // A box's shape: its tag and its class names without digits, so siblings of one kind match.
  const shape = (el) => el.tagName + "." + [...el.classList].map((c) => c.replace(/\d+/g, "")).filter(Boolean).sort().slice(0, 4).join(".");
  function item(el) {
    const a = el.querySelector(AUTHOR);
    return { text: text(el).slice(0, TEXT_MAX), hasTime: !!el.querySelector("time, [datetime]"), author: a ? text(a).slice(0, 60) || null : null };
  }

  // Runs of three or more siblings with one shape, outside navigation and footers.
  function groups(root) {
    const out = [];
    const all = [...root.querySelectorAll("body *")].slice(0, MAX_NODES);
    for (const parent of all) {
      if (parent.childElementCount < 3 || parent.closest(SKIP)) continue;
      const runs = new Map();
      for (const c of parent.children) { const k = shape(c); if (!runs.has(k)) runs.set(k, []); runs.get(k).push(c); }
      for (const els of runs.values()) if (els.length >= 3) out.push({ items: els.slice(0, 300).map(item) });
    }
    return out;
  }

  const list = (xs) => (xs.length ? [...new Set(xs)].join(", ") : "none");
  function rows(r) {
    const out = [];
    if (r.article) {
      out.push(["Article", `${r.article.chars.toLocaleString("en")} characters read from the page's main text block`],
        ["Rhetoric markers", list(r.article.markers)], ["Persuasion techniques", list(r.article.techniques)],
        ["Machine-writing signs", r.article.leak ? "leaked AI text" : r.article.machineLike ? "yes" : "none"]);
    }
    if (r.comments) {
      const c = r.comments;
      out.push(["Comments", `${c.n} found by layout, ${c.withAuthor} with an author name`], ["With rhetoric markers", String(c.marked)],
        ["With persuasion techniques", String(c.persuasive)], ["Machine-like", String(c.machine)],
        ["Repeated texts", c.repeatedTexts ? `${c.repeatedTexts} texts appear more than once (largest ${c.largestRepeat} times)` : "none"]);
    }
    if (!out.length) out.push([null, { note: "Daylight Commons found zero article bodies or comment lists on this page." }]);
    out.push(["What it shows", PB.GENERIC_DOES_NOT_PROVE]);
    return out;
  }

  // The site card section, read fresh on each call.
  function section() {
    const root = document;
    const found = { article: PB.pickArticle(blocks(root)), comments: PB.pickComments(groups(root)) };
    return { tab: "overview", title: "Text on this page", rows: rows(PB.genericChecks(found)), foot: "Daylight Commons' generic reader, working from the page's layout." };
  }

  globalThis.PBGenericPage = Object.freeze({ section, blocks, groups });
})();
