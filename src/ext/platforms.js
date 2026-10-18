// One adapter per site. Each knows how to find the replies the site has rendered, read their
// author and text, and where to put the badge. Only X shows an account location ("About this
// account"); on the others Radar shows coordination signs and the thread report only.
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

  // The fixture harness (tests/fixtures/thread.html) behaves as an X post page.
  const FIXTURE = { ...X, id: "fixture", match: () => document.documentElement.dataset.pbFixture === "status", onThread: () => true };

  const ALL = [FIXTURE, X, REDDIT, YOUTUBE];
  globalThis.PBSites = Object.freeze({ current: () => ALL.find((s) => s.match()) || null });
})();
