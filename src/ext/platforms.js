// One adapter per site. Each knows how to find the replies the site has rendered, read their
// author and text, and where to put the badge. X labels where accounts are based on every
// reply; Instagram and Facebook show it only when the viewer opens an account's About or
// Page transparency view (src/ext/meta.js), and Radar then remembers it. `reading(author)` gives
// a site's account reading; `rootFirst` means the first item is the post replied to.
// Selectors are written from each site's public markup and need a live check
// (project-docs/LIVE-CHECKS.md); a site redesign can break them.
(() => {
  "use strict";
  const text = (el) => (el ? el.innerText.trim() : "");
  // A short stable id for sites that do not expose one on the comment.
  const hashId = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return "h" + h.toString(36); };

  const X = {
    profileOf: (h) => `https://x.com/${h}`,
    id: "x", name: "X", hasLocation: true,
    match: () => /(^|\.)(x|twitter)\.com$/.test(location.hostname),
    onThread: () => /^\/[A-Za-z0-9_]{1,15}\/status\/\d+/.test(location.pathname),
    // Timelines, profiles, likes, lists and search: any other page that shows posts.
    onFeed: () => !/^\/(?:settings|messages|i\/(?:flow|keyboard_shortcuts|display))/.test(location.pathname),
    items: () => [...document.querySelectorAll('article[data-testid="tweet"]')],
    read(node) {
      const nameBox = node.querySelector('[data-testid="User-Name"]');
      const link = nameBox && [...nameBox.querySelectorAll('a[href^="/"]')].map((a) => a.getAttribute("href")).find((h) => /^\/[A-Za-z0-9_]{1,15}$/.test(h));
      const time = node.querySelector('a[href*="/status/"] time');
      const idm = time && time.parentElement.getAttribute("href").match(/\/status\/(\d+)/);
      if (!link || !idm) return null;
      const display = text(nameBox.querySelector("a span")) || null;
      return { id: idm[1], author: link.slice(1), display, posted: time.getAttribute("datetime"), url: "https://x.com" + time.parentElement.getAttribute("href"),
        text: text(node.querySelector('[data-testid="tweetText"]')), node, anchor: nameBox,
        // X's own paid-placement label, and link domains shown in the post or its card
        paid: [...node.querySelectorAll("span")].some((sp) => /^(Ad|Promoted)$/.test(sp.textContent.trim())),
        domains: PB.domainsIn(node.innerText),
        // shown by X beside the reply: the language it was written in, and account labels
        writtenIn: ((node.innerText.match(/Translated from (\w+)/) || [])[1]) || null,
        pageLabel: ((node.innerText.match(/\b(Parody|Commentary|Fan|Automated) account\b/) || [])[1]) || null,
        // replies X itself filed under its "Probable spam" heading
        xSpam: (() => { const hd = [...document.querySelectorAll("h2, span")].find((x) => x.textContent.trim() === "Probable spam"); return !!(hd && (hd.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)); })() };
    },
  };

  const REDDIT = {
    id: "reddit", name: "Reddit", hasLocation: false,
    match: () => /(^|\.)reddit\.com$/.test(location.hostname),
    onThread: () => /\/comments\//.test(location.pathname),
    items: () => [...document.querySelectorAll("shreddit-comment")],
    read(node) {
      const author = node.getAttribute("author");
      if (!author || author === "[deleted]") return null;
      const body = node.querySelector('[slot="comment"]');
      return { id: node.getAttribute("thingid") || hashId(author + text(body)), author, posted: node.getAttribute("created") || null,
        profile: `https://www.reddit.com/user/${encodeURIComponent(author)}`, text: text(body), node, anchor: body };
    },
  };

  const YOUTUBE = {
    id: "youtube", name: "YouTube", hasLocation: false,
    match: () => /(^|\.)youtube\.com$/.test(location.hostname),
    onThread: () => location.pathname === "/watch" || location.pathname.startsWith("/shorts/"),
    items: () => [...document.querySelectorAll("ytd-comment-view-model, ytd-comment-renderer")],
    read(node) {
      const author = text(node.querySelector("#author-text")).replace(/^@/, "");
      const body = node.querySelector("#content-text");
      if (!author || !body) return null;
      const link = node.querySelector("#author-text");
      return { id: hashId(author + "|" + text(body)), author, profile: link && link.href ? link.href : null, text: text(body), node, anchor: body };
    },
  };
  REDDIT.reading = (a) => (globalThis.PBReddit ? PBReddit.get(a) : null);
  REDDIT.want = (authors, cb) => globalThis.PBReddit && PBReddit.want(authors, cb);
  const fx = (name) => document.documentElement.dataset.pbFixture === name;
  const meta = (site) => (a) => (globalThis.PBMeta ? PBMeta.get(site, a) : null);
  // Elements of `sel` inside node that belong to it, not to a reply nested in it.
  const own = (node, sel, box) => [...node.querySelectorAll(sel)].filter((e) => e.closest(box) === node);

  // Comments are role="article" elements labelled "Comment by ..." or "Reply by ..." (checked live
  // 2026-10-21); other languages are caught by the comment permalink inside them.
  const FACEBOOK = {
    id: "facebook", name: "Facebook", hasLocation: false,
    match: () => /(^|\.)facebook\.com$/.test(location.hostname) || fx("facebook"),
    onThread: () => /\/(?:posts|permalink|videos|reel|photos?|watch)\b|story\.php|permalink\.php|photo\.php/.test(location.pathname) || /[?&](?:story_fbid|fbid|v)=/.test(location.search) || fx("facebook"),
    onFeed: () => true,
    items: () => [...document.querySelectorAll('[role="article"]')].filter((n) => /^(?:Comment|Reply) by /.test(n.getAttribute("aria-label") || "") || n.querySelector('a[href*="comment_id="]')),
    read(node) {
      const link = own(node, "a[href]", '[role="article"]').find((a) => a.innerText.trim() && PB.fbKey(a.href));
      if (!link) return null;
      const author = PB.fbKey(link.href);
      const perma = own(node, 'a[href*="comment_id="]', '[role="article"]').map((a) => a.href).find((h) => /[?&](?:reply_)?comment_id=\d+/.test(h));
      const cid = perma && ((perma.match(/[?&]reply_comment_id=(\d+)/) || perma.match(/[?&]comment_id=(\d+)/) || [])[1]);
      const body = own(node, 'div[dir="auto"]', '[role="article"]');
      const t = body.map(text).filter(Boolean).join("\n");
      return { id: cid || hashId(author + "|" + t), author, display: text(link), profile: PB.fbProfile(author), text: t, node, anchor: body[0] || link, domains: PB.domainsIn(t) };
    },
    reading: meta("facebook"),
  };

  // Instagram marks nothing as a comment. Each comment has a permalink (/<owner>/p/<code>/c/<id>/)
  // around its <time>; the comment is the largest box holding exactly one such permalink.
  const IG_TIME = 'a[href*="/c/"] time';
  function igBox(a) {
    let n = a;
    while (n.parentElement && n.parentElement !== document.body && n.parentElement.querySelectorAll(IG_TIME).length === 1) n = n.parentElement;
    return n;
  }
  const INSTAGRAM = {
    id: "instagram", name: "Instagram", hasLocation: false,
    match: () => /(^|\.)instagram\.com$/.test(location.hostname) || fx("instagram"),
    onThread: () => /\/(?:p|reel|reels|tv)\/[^/]+/.test(location.pathname) || fx("instagram"),
    items: () => [...new Set([...document.querySelectorAll(IG_TIME)].map((t) => igBox(t.closest("a"))))],
    read(node) {
      const user = [...node.querySelectorAll("a[href]")].find((a) => /^\/[A-Za-z0-9._]{1,30}\/$/.test(a.getAttribute("href")) && a.innerText.trim());
      const tl = node.querySelector(IG_TIME);
      if (!user || !tl) return null;
      const author = user.getAttribute("href").slice(1, -1), when = tl.closest("a");
      // The body: the first text span outside links and buttons that is not the name or the time.
      const body = [...node.querySelectorAll('span[dir="auto"]')].find((s) => !s.closest("a, [role=button]") && !s.querySelector('span[dir="auto"]') && s.innerText.trim() && s.innerText.trim() !== when.innerText.trim() && s.innerText.trim() !== author);
      const id = (when.getAttribute("href").match(/\/c\/(\d+)/) || [])[1];
      const t = text(body);
      return { id: id || hashId(author + "|" + t), author, posted: tl.getAttribute("datetime") || null, profile: `https://www.instagram.com/${author}/`, text: t, node, anchor: body || user, domains: PB.domainsIn(t) };
    },
    reading: meta("instagram"),
  };

  // Bluesky's web app tags each post with data-testid="postThreadItem-by-<handle>" in a thread and
  // "feedItem-by-<handle>" in feeds (checked live 2026-10-21).
  const BLUESKY = {
    id: "bluesky", name: "Bluesky", hasLocation: false, rootFirst: true,
    match: () => /(^|\.)bsky\.app$/.test(location.hostname) || fx("bluesky"),
    onThread: () => /^\/profile\/[^/]+\/post\/[^/]+/.test(location.pathname) || fx("bluesky"),
    onFeed: () => !/^\/(?:settings|messages|notifications)/.test(location.pathname),
    items: () => [...document.querySelectorAll('[data-testid^="postThreadItem-by-"], [data-testid^="feedItem-by-"]')],
    read(node) {
      const author = node.getAttribute("data-testid").replace(/^(?:postThreadItem|feedItem)-by-/, "");
      const body = node.querySelector("[data-word-wrap]");
      const href = [...node.querySelectorAll('a[href*="/post/"]')].map((a) => a.getAttribute("href")).find((h) => h.toLowerCase().startsWith(`/profile/${author.toLowerCase()}/post/`));
      const id = href ? href.split("/post/")[1].split(/[/?#]/)[0] : hashId(author + "|" + text(body));
      const p = globalThis.PBMeta ? PBMeta.post(id) : null;
      if (!author) return null;
      return { id, author, posted: p && p.posted, profile: `https://bsky.app/profile/${author}`, text: text(body), node, anchor: body || node, domains: PB.domainsIn(text(body)) };
    },
    reading: meta("bluesky"),
  };

  // The fixture harness (tests/fixtures/thread.html) behaves as an X post page.
  const FIXTURE = { ...X, id: "fixture", match: () => document.documentElement.dataset.pbFixture === "status", onThread: () => true };

  // Threads, Mastodon and TikTok live in platforms-reach.js, loaded first.
  const ALL = [FIXTURE, X, REDDIT, YOUTUBE, FACEBOOK, INSTAGRAM, BLUESKY, ...(globalThis.PBMoreSites || [])];
  globalThis.PBSites = Object.freeze({ current: () => ALL.find((s) => s.match()) || null });
})();
