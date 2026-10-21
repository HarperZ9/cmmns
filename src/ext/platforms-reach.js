// Adapters for Threads, Mastodon and TikTok comments, in the shape platforms.js uses. Loaded before
// platforms.js, which adds PBMoreSites to its list. Markup notes and dates: project-docs/LIVE-CHECKS.md.
(() => {
  "use strict";
  const text = (el) => (el ? el.innerText.trim() : "");
  const hashId = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return "h" + h.toString(36); };
  const fx = (name) => document.documentElement.dataset.pbFixture === name;
  const COUNT = /^(?:\d[\d.,]*\s*[KkMm]?|·|•)$/;

  // Threads (threads.com, formerly threads.net; checked live 2026-10-21, logged out): each post is
  // a [data-pressable-container] box holding a time inside its permalink (/@user/post/<code>). On a
  // post's page the first box is the post and the rest are replies.
  const THREADS = {
    id: "threads", name: "Threads", hasLocation: false, rootFirst: true,
    match: () => /(^|\.)threads\.(?:net|com)$/.test(location.hostname) || fx("threads"),
    onThread: () => /^\/@[\w.]+\/post\/[\w-]+/.test(location.pathname) || fx("threads"),
    onFeed: () => !/^\/(?:settings|activity|direct)/.test(location.pathname),
    items: () => [...document.querySelectorAll("[data-pressable-container]")].filter((n) => n.querySelector('a[href*="/post/"] time')),
    read(node) {
      const when = node.querySelector('a[href*="/post/"] time'), link = when.closest("a");
      const m = (link.getAttribute("href") || "").match(/^\/@([\w.]+)\/post\/([\w-]+)/);
      if (!m) return null;
      // The body: the longest text span outside links and buttons that is not a count.
      const spans = [...node.querySelectorAll('span[dir="auto"]')].filter((s) => !s.closest("a, [role=button]") && !s.querySelector('span[dir="auto"]'))
        .map((s) => [s, text(s)]).filter(([, t]) => t && !COUNT.test(t) && t !== m[1]);
      const [body] = spans.sort((a, b) => b[1].length - a[1].length)[0] || [null];
      const t = text(body);
      return { id: m[2], author: m[1], posted: when.getAttribute("datetime") || null, profile: `https://www.threads.com/@${m[1]}`, text: t, node,
        anchor: body || link, domains: PB.domainsIn(t) };
    },
  };

  // Mastodon, on any server the user turned Radar on for (src/ext/instances.js). The web app
  // renders posts as ".status" (4.x) or "._comp_status__root" (5.0), checked live 2026-10-21 on
  // fosstodon.org (4.x) and mastodon.social (5.0). In both, the time sits in the permalink
  // /@acct/<id>, which gives the author and the id.
  const PERMA = /^\/@([^/@\s]+(?:@[^/\s]+)?)\/(\d+)$/;
  const mastoHost = () => location.hostname;
  const MASTODON = {
    id: "mastodon", name: "Mastodon", hasLocation: false, rootFirst: true,
    match: () => !!document.getElementById("mastodon") || fx("mastodon"),
    onThread: () => /^\/(?:deck\/)?@[^/]+\/\d+/.test(location.pathname) || /^\/(?:web\/)?statuses\/\d+/.test(location.pathname) || fx("mastodon"),
    onFeed: () => !/^\/(?:settings|admin|auth|conversations|notifications)/.test(location.pathname),
    items: () => [...new Set([...document.querySelectorAll("a[href] > time[datetime]")].map((t) => t.parentElement)
      .filter((a) => PERMA.test(a.getAttribute("href") || "")).map((a) => a.closest(".status, [class*='_comp_status__root'], article")).filter(Boolean))],
    read(node) {
      const a = [...node.querySelectorAll("a[href] > time[datetime]")].map((t) => t.parentElement).find((x) => PERMA.test(x.getAttribute("href") || ""));
      if (!a) return null;
      const [, acct, id] = a.getAttribute("href").match(PERMA);
      const body = node.querySelector("[class*='content__text'], .status__content__text, .status__content, .e-content");
      const t = text(body);
      return { id, author: acct, posted: a.querySelector("time").getAttribute("datetime") || null, profile: `${location.origin}/@${acct}`, text: t, node,
        anchor: body || a, domains: PB.domainsIn(t) };
    },
    reading: (acct) => (globalThis.PBMeta ? PBMeta.get("mastodon@" + mastoHost(), acct) : null),
  };

  // TikTok web comments. The comment markup carries data-e2e attributes ("comment-level-1" for a
  // comment, "comment-username-1" for its author); written from TikTok's public markup and not yet
  // checked live (project-docs/LIVE-CHECKS.md). Post times come from the comment list the app loaded.
  const TIKTOK = {
    id: "tiktok", name: "TikTok", hasLocation: false,
    match: () => /(^|\.)tiktok\.com$/.test(location.hostname) || fx("tiktok"),
    onThread: () => /^\/@[\w.-]+\/(?:video|photo)\/\d+/.test(location.pathname) || fx("tiktok"),
    items: () => [...document.querySelectorAll('[data-e2e="comment-level-1"], [data-e2e="comment-level-2"]')]
      .map((t) => t.closest('[class*="CommentItem"], [class*="CommentObject"], li, [class*="DivCommentContentContainer"]') || t.parentElement),
    read(node) {
      const user = node.querySelector('[data-e2e^="comment-username"] a[href^="/@"], a[href^="/@"]');
      const body = node.querySelector('[data-e2e="comment-level-1"], [data-e2e="comment-level-2"]');
      if (!user || !body) return null;
      const author = user.getAttribute("href").replace(/^\/@/, "").replace(/[/?#].*$/, "");
      const t = text(body);
      const p = globalThis.PBMeta ? PBMeta.findPost((x) => x.author === author && x.text && x.text.trim() === t) : null;
      return { id: (p && p.id) || hashId(author + "|" + t), author, posted: p && p.posted, profile: `https://www.tiktok.com/@${author}`, text: t, node,
        anchor: body, domains: PB.domainsIn(t) };
    },
  };

  globalThis.PBMoreSites = Object.freeze([THREADS, MASTODON, TIKTOK]);
  // Tests reach the adapters through this name; the extension does not use it.
  globalThis.PBReachSites = { THREADS, MASTODON, TIKTOK };
})();
