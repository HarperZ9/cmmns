// The reading lens on the page (src/core/reading.js): each post is read in its thread, its shown
// findings go on the post's model for the window, and each span is marked in the post's own text
// with the CSS Custom Highlight API, which paints the text without changing the page's DOM.
(() => {
  "use strict";
  const NAME = "pb-lens";
  const supported = () => typeof CSS !== "undefined" && CSS.highlights && typeof Highlight === "function";

  // Text nodes under node, with their offsets in the concatenated text.
  function textMap(node) {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT), parts = [];
    let at = 0;
    for (let t = walker.nextNode(); t; t = walker.nextNode()) { parts.push({ t, at }); at += t.data.length; }
    return { parts, text: parts.map((p) => p.t.data).join("") };
  }

  function rangeFor(map, start, end) {
    const a = map.parts.findLast((p) => p.at <= start), b = map.parts.findLast((p) => p.at < end);
    if (!a || !b) return null;
    const r = document.createRange();
    r.setStart(a.t, start - a.at);
    r.setEnd(b.t, end - b.at);
    return r;
  }

  // Ranges for every finding of one post, found by the matched words in the post's text.
  function ranges(node, findings) {
    const map = textMap(node), lower = map.text.toLowerCase(), out = [];
    for (const f of findings) {
      const at = lower.indexOf(String(f.match).toLowerCase());
      if (at < 0) continue;
      try { const r = rangeFor(map, at, at + f.match.length); if (r) out.push(r); } catch (e) { PBGuard.report("lens range failed", e); }
    }
    return out;
  }

  // posts: [{ id, author, text, node }], root first when there is one. feed: each post on its own.
  // Returns { by: Map(id -> shown findings), patterns }.
  function read(posts, { feed = false, settings = null } = {}) {
    const on = PB.lensOn(settings), rows = posts.map((p, i) => ({ id: p.id, author: p.author, text: p.text, role: !feed && i === 0 && p.root ? "root" : "reply" }));
    const by = new Map();
    if (feed) {
      for (const r of rows) by.set(r.id, PB.readPost(r.text, { on }).filter((f) => f.shown));
      return { by, patterns: PB.feedPatterns(rows, { on }) };
    }
    const rep = PB.readingReport(rows, { on });
    for (const x of rep.posts) by.set(x.id, x.findings.filter((f) => f.shown));
    return { by, patterns: rep.patterns };
  }

  // Paints every span of the posts on screen; called after each refresh.
  function paint(posts, by) {
    if (!supported()) return;
    const all = [];
    for (const p of posts) { const f = by.get(p.id); if (f && f.length && p.node && p.node.isConnected) all.push(...ranges(p.node, f)); }
    if (all.length) CSS.highlights.set(NAME, new Highlight(...all)); else CSS.highlights.delete(NAME);
  }

  globalThis.PBLens = Object.freeze({ read, paint });
})();
