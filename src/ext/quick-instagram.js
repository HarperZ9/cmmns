// Instagram posts, whole, from what the page received (src/core/instagram-data.js): the JSON Instagram
// embeds in the page and the answers to its own requests (igsniff.js). A save from any picture or video
// of a post takes every carousel item at its largest size, each video, the alt text, the caption, the
// time, the counts and the comments the page loaded. On a page that shows only a thumbnail and has not
// received the post (the likes page in Your activity), the target names the post to open, and
// full-capture.js opens it in a background tab and saves it from there, as a person opening it would.
globalThis.PBQuickInstagram = globalThis.PBQuickInstagram || (() => {
  "use strict";
  if (!/(^|\.)instagram\.com$/.test(location.hostname)) return null;
  const posts = new Map(), comments = new Map(), read = new WeakSet();
  const here = () => PB.igShortcode(location.pathname);

  // One answer from the page: its posts, and its comments, each filed under the post they belong to:
  // the post Instagram names, else the only post in the same answer, else the post open on the page.
  function take(json) {
    const items = PB.igItemsIn(json);
    for (const it of items) posts.set(it.shortcode, { ...(posts.get(it.shortcode) || {}), ...it });
    const byId = new Map([...posts.values()].map((p) => [p.id, p.shortcode]));
    for (const c of PB.igCommentsIn(json)) {
      const code = (c.mediaId && byId.get(String(c.mediaId).split("_")[0])) || (items.length === 1 ? items[0].shortcode : here());
      if (!code) continue;
      if (!comments.has(code)) comments.set(code, new Map());
      comments.get(code).set(c.id, c);
    }
    while (posts.size > 500) posts.delete(posts.keys().next().value);
    while (comments.size > 100) comments.delete(comments.keys().next().value);
  }
  // The page's own embedded data, read once per script element.
  function readEmbedded() {
    for (const s of document.querySelectorAll('script[type="application/json"]')) {
      if (read.has(s)) continue;
      read.add(s);
      const t = s.textContent || "";
      if (!/image_versions2|carousel_media|video_versions|comment/.test(t)) continue;
      try { take(JSON.parse(t)); } catch (e) { console.warn("[cmmns] could not read Instagram's page data", e); }
    }
  }
  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data || e.data.source !== "radar-ig") return;
    try { take(e.data.json); } catch (err) { console.warn("[cmmns] could not read Instagram's answer", err); }
  });
  window.postMessage({ source: "radar-ig-ask" }, location.origin);

  const LINK = 'a[href*="/p/"], a[href*="/reel/"], a[href*="/reels/"], a[href*="/tv/"]';
  // The post an element belongs to: the post link around it (a grid tile), the post link in its
  // article (the time stamp), else the post open on the page.
  function codeFor(el) {
    const a = el.closest && el.closest(LINK), own = a && PB.igShortcode(a.getAttribute("href"));
    if (own) return own;
    const art = el.closest && el.closest("article"), t = art && [...art.querySelectorAll(LINK)].find((x) => x.querySelector("time")) || null;
    return (t && PB.igShortcode(t.getAttribute("href"))) || here();
  }
  function postFor(code) { readEmbedded(); return posts.get(code) || null; }
  // A CDN address's file name, which a thumbnail and the full picture share.
  const fileKey = (u) => { try { return new URL(u, location.href).pathname.split("/").pop() || null; } catch { return null; } };

  const itemTarget = (m, el, meta) => (m.kind === "video" ? { kind: "video", url: m.url, poster: m.poster, el, meta: { ...meta, alt: m.alt } } : { kind: "image", url: m.url, el, meta: { ...meta, alt: m.alt } });
  // Every file of one post, each with the post's words, as quick-inline's saveAll expects.
  function postMedia(code) {
    const p = postFor(code);
    if (!p) return { title: document.title, items: [] };
    const meta = PB.igPostMeta(p);
    return { title: `${p.handle || "instagram"} ${p.shortcode}`, items: p.media.map((m) => itemTarget(m, null, meta)), gallery: p.media.length > 1 };
  }

  function targetFor(el) {
    if (!el || !(el.tagName === "IMG" || el.tagName === "VIDEO")) return null;
    const code = codeFor(el);
    if (!code) return null;
    const p = postFor(code);
    if (!p || !p.media.length) return openTarget(el, code);
    const k = fileKey(el.currentSrc || el.src || el.poster || "");
    const i = Math.max(0, p.media.findIndex((m) => fileKey(m.url) === k || fileKey(m.poster) === k));
    const t = itemTarget(p.media[i], el, PB.igPostMeta(p));
    return { ...t, title: `${p.handle || "instagram"} ${p.shortcode}`, post: p.media.length > 1 ? postMedia(code) : null };
  }

  // A tile whose post the page has not received: what the tile shows, with the post to open.
  function openTarget(el, code) {
    const a = el.closest && el.closest(LINK), url = a ? new URL(a.getAttribute("href"), location.href).href : `https://www.instagram.com/p/${code}/`;
    if (code === here() && !a) return null;   // the post's own page with no data yet: the plain picture
    const src = el.currentSrc || el.src;
    return { kind: el.tagName === "VIDEO" ? "video" : "image", url: src || null, el, open: url, shortcode: code, title: `instagram ${code}`,
      meta: { site: "instagram", postUrl: url, textComplete: false, alt: el.alt || null } };
  }

  // Waits for a post's data to arrive in the page (a background tab opened for it), up to ms.
  async function whenPost(code, ms = 15000) {
    for (let t = 0; t < ms; t += 250) { const p = postFor(code); if (p && p.media.length) return p; await new Promise((ok) => setTimeout(ok, 250)); }
    return null;
  }

  return Object.freeze({ targetFor, postMedia, postFor, whenPost, here, take,
    commentsOf: (code) => [...((comments.get(code) || new Map()).values())],
    expectedOf: (code) => { const p = posts.get(code); return p ? p.comments : null; } });
})();
