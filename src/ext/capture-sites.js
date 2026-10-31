// The comments of one saved post, read from what the page shows or received, per site. Each reader
// returns { comments, expected, stubs, own, source, scroll } or null: comments a flat list for
// PB.captureThread (src/core/capture-thread.js); expected the site's own count; stubs the "more
// replies" controls still on the page; own true when the post is the page's main post (only then does
// full-capture.js open more); scroll true where the site loads more as the reader scrolls. Commenters
// are other people: only their public handle, words, score, time and link as the page showed them.
globalThis.PBCaptureSites = globalThis.PBCaptureSites || (() => {
  "use strict";
  const txt = (el) => (el && el.innerText ? el.innerText.replace(/\n{3,}/g, "\n\n").trim() || null : el && el.textContent ? el.textContent.trim() || null : null);
  const abs = (h) => { try { return h ? new URL(h, location.href).href : null; } catch { return null; } };
  const hrefs = (el) => (el ? [...el.querySelectorAll("a[href]")].map((a) => a.href).filter((u) => /^https?:/.test(u)) : []);
  const visible = (b) => b && b.isConnected && !b.disabled && b.getAttribute("aria-disabled") !== "true";
  const MORE = /^\s*(\d[\d,.]*[KM]?\s+)?(more repl(y|ies)|more comments?|repl(y|ies)|view more comments|load more comments|show more replies|show additional replies|show probable spam|show replies|view( all)? \d+ repl(y|ies)|view replies)\b/i;
  const stubsIn = (root, sel) => [...root.querySelectorAll(sel)].filter((b) => visible(b) && MORE.test(b.textContent || b.getAttribute("aria-label") || ""));

  // Reddit: the shreddit-comment elements of this post's comment tree, each with its own attributes.
  function reddit(meta) {
    const id = (/\/comments\/([a-z0-9]+)/i.exec(meta.postUrl || "") || [])[1];
    if (!id) return null;
    const own = new RegExp(`/comments/${id}(?:[/?#]|$)`, "i").test(location.pathname);
    const nodes = [...document.querySelectorAll("shreddit-comment")].filter((n) => !n.getAttribute("postid") || n.getAttribute("postid") === "t3_" + id);
    const comments = nodes.map((n) => {
      const a = (k) => n.getAttribute(k) || null, up = n.parentElement && n.parentElement.closest("shreddit-comment");
      const body = [...n.children].find((c) => c.getAttribute("slot") === "comment");
      const deleted = n.hasAttribute("is-comment-deleted") || n.hasAttribute("deleted") || a("author") === "[deleted]";
      return { id: a("thingid"), parent: a("parentid") || (up && up.getAttribute("thingid")) || null, depth: a("depth"), author: a("author") && !deleted ? "u/" + a("author") : null,
        text: txt(body), score: a("score"), postedAt: a("created-timestamp"), permalink: abs(a("permalink")), edited: n.hasAttribute("edited-timestamp") || null,
        flair: txt(n.querySelector(':scope > [slot="authorFlair"], :scope > [slot="commentMeta"] author-flair-text')), deleted, links: hrefs(body) };
    }).filter((c) => c.id);
    const tree = document.querySelector(`shreddit-comment-tree[post-id="t3_${id}"]`) || document.querySelector("shreddit-comment-tree") || document;
    const stubs = own ? stubsIn(tree, "faceplate-partial button, button[slot='more-comments-button'], shreddit-comment button, shreddit-comment-tree > button") : [];
    // "Continue this thread" opens another page; it is counted, never followed.
    const away = own ? [...tree.querySelectorAll("a[href*='/comments/']")].filter((x) => /continue this thread/i.test(x.textContent || "")).length : 0;
    return { comments, expected: meta.engagement && meta.engagement.comments, stubs, away, own, source: "the rendered page", scroll: false };
  }

  // X: replies to the post among the posts X sent the page (sniff.js), each joined to the post it
  // answers; the post's own page loads more as it scrolls, and behind "Show more replies".
  function x(meta) {
    const id = (/\/status\/(\d+)/.exec(meta.postUrl || "") || [])[1], data = PBQuickSites.xData && PBQuickSites.xData();
    if (!id || !data) return null;
    const all = [...data.values()], inThread = new Set([id]);
    for (let grew = true, guard = 0; grew && guard < 50; guard++) {
      grew = false;
      for (const p of all) if (p.replyTo && inThread.has(p.replyTo) && !inThread.has(p.id)) { inThread.add(p.id); grew = true; }
    }
    const comments = all.filter((p) => p.id !== id && inThread.has(p.id)).map((p) => ({ id: p.id, parent: p.replyTo === id ? null : p.replyTo, author: p.author ? "@" + p.author : null,
      text: (p.urls || []).reduce((s, u) => s.split(u.short).join(u.expanded), p.fullText || p.text || ""), score: p.likes, postedAt: p.posted, permalink: PBQuickSites.xUrl(p.author, p.id),
      replies: p.replies, links: p.links || [], edited: p.edits ? true : null }))
      .sort((a, b) => (a.id.length - b.id.length) || (a.id < b.id ? -1 : 1));   // X ids grow with time
    const own = new RegExp(`/status/${id}(?:[/?#]|$)`).test(location.pathname);
    const stubs = own ? stubsIn(document, '[data-testid="cellInnerDiv"] [role="button"], [data-testid="cellInnerDiv"] button') : [];
    return { comments, expected: (data.get(id) || {}).replies ?? (meta.engagement && meta.engagement.replies), stubs, own, source: "the page's own data (X's answers to the page)", scroll: own };
  }

  // Instagram: the comments the page received for this post (quick-instagram.js).
  function instagram(meta) {
    const ig = globalThis.PBQuickInstagram, code = PB.igShortcode(meta.postUrl || "");
    if (!ig || !code) return null;
    const comments = ig.commentsOf(code).map((c) => ({ ...c, author: c.author ? "@" + c.author : null, permalink: `https://www.instagram.com/p/${code}/c/${c.id}/` }));
    const own = ig.here() === code;
    const stubs = own ? stubsIn(document, 'button, [role="button"], svg[aria-label="Load more comments"]').map((b) => (b.tagName === "svg" ? b.closest('[role="button"], button') || b : b)) : [];
    return { comments, expected: ig.expectedOf(code) ?? (meta.engagement && meta.engagement.comments), stubs, own, source: "the page's own data (Instagram's answers to the page)", scroll: false };
  }

  // YouTube: the comment threads the watch page has drawn, each top comment and its opened replies.
  // YouTube shows relative times ("2 days ago"); those are kept as shown.
  function youtube(meta) {
    const vid = (/[?&]v=([\w-]{6,})/.exec(meta.postUrl || "") || [])[1];
    if (!vid || !/[?&]v=/.test(location.search) || new URLSearchParams(location.search).get("v") !== vid) return null;
    const one = (n, parent) => {
      const link = n.querySelector("#published-time-text a, a#published-time-text, .published-time-text a");
      const id = link ? new URL(link.getAttribute("href"), location.href).searchParams.get("lc") : null;
      return id ? { id, parent, author: txt(n.querySelector("#author-text")), text: txt(n.querySelector("#content-text")), score: txt(n.querySelector("#vote-count-middle")),
        timeShown: txt(link), permalink: `https://www.youtube.com/watch?v=${vid}&lc=${id}`, links: hrefs(n.querySelector("#content-text")).map(ytLink) } : null;
    };
    const comments = [];
    for (const th of document.querySelectorAll("ytd-comment-thread-renderer")) {
      const top = one(th.querySelector("#comment") || th, null);
      if (!top) continue;
      comments.push(top);
      for (const r of th.querySelectorAll("ytd-comment-replies-renderer ytd-comment-view-model, ytd-comment-replies-renderer ytd-comment-renderer")) { const c = one(r, top.id); if (c) comments.push(c); }
    }
    const count = txt(document.querySelector("ytd-comments-header-renderer #count, ytd-comments-header-renderer .count-text"));
    const stubs = stubsIn(document, "ytd-comment-replies-renderer #more-replies button, ytd-comment-replies-renderer button");
    return { comments, expected: count ? (/([\d,.]+)/.exec(count) || [])[1] : null, stubs, own: true, source: "the rendered page", scroll: true };
  }
  // YouTube sends outside links through its /redirect page; the address it stands for is its q.
  function ytLink(u) { try { const p = new URL(u); return p.pathname === "/redirect" && p.searchParams.get("q") ? p.searchParams.get("q") : u; } catch { return u; } }

  const BY = { reddit, x, instagram, youtube };
  return Object.freeze({ read: (meta) => (meta && BY[meta.site] ? BY[meta.site](meta) : null), MORE });
})();
