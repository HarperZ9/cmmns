// What X and Reddit actually serve behind what they show. X plays videos and "GIFs" from memory;
// its own post data (the same responses sniff.js already passes on) lists each one's MP4 files, so
// the one with the highest bitrate is taken, and its HLS playlist when no MP4 is listed. X pictures
// are taken at full size. Reddit's player names a ready MP4 with sound when there is one, and
// otherwise its DASH manifest, whose separate video and sound become one MP4 (quick-stream.js).
globalThis.PBQuickSites = globalThis.PBQuickSites || (() => {
  "use strict";
  const host = location.hostname.replace(/^www\./, "");
  const isX = /^(x|twitter)\.com$/.test(host), isReddit = /(^|\.)reddit\.com$/.test(host);
  const xPosts = new Map(), xByThumb = new Map();
  const thumbKey = (u) => { try { const p = new URL(u, location.href); return p.hostname === "pbs.twimg.com" ? p.pathname.replace(/\.\w+$/, "") : null; } catch { return null; } };

  if (isX) window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data || (e.data.source !== "radar-sniff" && e.data.source !== "radar-sniff-replay")) return;
    try {
      for (const t of PB.tweetsIn(e.data.json)) {
        xPosts.set(t.id, { ...(xPosts.get(t.id) || {}), ...t });
        for (const m of t.media || []) { const k = thumbKey(m.url); if (k) xByThumb.set(k, m); }
      }
      while (xPosts.size > 3000) xPosts.delete(xPosts.keys().next().value);
      while (xByThumb.size > 6000) xByThumb.delete(xByThumb.keys().next().value);
    } catch (err) { console.warn("[cmmns] could not read X's media list", err); }
  });

  // What X loaded before this script started (sniff.js keeps the last few responses).
  if (isX) window.postMessage({ source: "radar-sniff-replay-ask" }, location.origin);

  function xVideo(video, m) {
    const poster = video ? video.poster : m && m.url;
    if (m && m.mp4) return { kind: "video", url: m.mp4, poster, gif: m.type === "animated_gif", el: video };
    const generic = video ? PBQuickResolve.fromElementPlain(video) : null;
    if (m && m.hls) return { ...(generic || { kind: "video", el: video, poster }), url: null, streams: [{ type: "hls", url: m.hls }] };
    return generic;
  }

  function xTarget(el) {
    if (el.tagName === "IMG" && /pbs\.twimg\.com\/media\//.test(el.currentSrc || el.src)) return { kind: "image", url: PB.fullSizeUrl(el.currentSrc || el.src), el };
    const video = el.tagName === "VIDEO" ? el : el.closest && el.closest('[data-testid="videoPlayer"], [data-testid="videoComponent"]') && el.closest('[data-testid="videoPlayer"], [data-testid="videoComponent"]').querySelector("video");
    if (!video) return null;
    return xVideo(video, xByThumb.get(thumbKey(video.poster)));
  }
  function xTargetTitled(el) {
    const t = xTarget(el), article = t && el.closest && el.closest("article"), ref = article && xPostId(article);
    return t && ref ? withMeta({ ...t, title: `${ref.handle} ${ref.id}` }, xMeta(article), el.tagName === "IMG" ? el.alt : null) : t;
  }

  const xPostId = (article) => {
    const here = (/\/status\/(\d+)/.exec(location.pathname) || [])[1], links = [...article.querySelectorAll('a[href*="/status/"]')];
    const a = (here && links.find((x) => new RegExp(`/status/${here}(?:$|[/?#])`).test(x.getAttribute("href")))) || links.find((x) => x.querySelector("time")) || links[0];
    const m = a && /\/([^/]+)\/status\/(\d+)/.exec(a.getAttribute("href"));
    return m ? { handle: m[1], id: m[2] } : null;
  };

  const txt = (el) => (el && el.innerText ? el.innerText.replace(/\n{3,}/g, "\n\n").trim() || null : null);
  // A post's text: data-testid and lang when signed in; signed out, X draws it in a pre-wrap block.
  const TEXT = '[data-testid="tweetText"], div[lang], div.whitespace-pre-wrap';
  const xUrl = (handle, id) => `https://x.com/${handle || "i"}/status/${id}`;
  // Matches inside this post only (not a nested quoted post's article), outermost first.
  const own = (article, sel) => [...article.querySelectorAll(sel)].filter((x, _, all) => x.closest("article") === article && !all.some((o) => o !== x && o.contains(x)));

  // The author's own continuation: replies by the same account that the page already loaded.
  // The author's own continuation, only where X's data proves it: each part answers the one before
  // (replyTo) and has the same author. Posts that only sit next to each other on the page are never
  // joined: on a profile or timeline they are unrelated posts (fixed in 3.6.1). { ids, texts, complete }:
  // complete is true for a proved chain, "unknown" when the page may hold one this could not prove.
  function xThreadOf(article, ref, t) {
    const { ids, texts } = PB.threadChain(xPosts.values(), ref.id, t.author || ref.handle);
    if (ids.length) return { ids, texts, complete: true };
    const onStatus = new RegExp(`/status/${ref.id}(?:$|[/?#])`).test(location.pathname), after = nextArticle(article), r = after && xPostId(after);
    return { ids: [], texts: [], complete: onStatus && r && r.handle.toLowerCase() === ref.handle.toLowerCase() ? "unknown" : null };
  }
  const xThread = (article, ref, t) => xThreadOf(article, ref, t).texts;
  function previousArticle(a) {
    const all = [...document.querySelectorAll("article")], i = all.indexOf(a);
    return i > 0 ? all[i - 1] : null;
  }
  function nextArticle(a) {
    const all = [...document.querySelectorAll("article")], i = all.indexOf(a);
    return i >= 0 ? all[i + 1] || null : null;
  }

  // What the post data and the page show about one X post, for the sidecar and the file name.
  function xMeta(article) {
    const ref = xPostId(article);
    if (!ref) return null;
    const t = xPosts.get(ref.id) || {}, langs = own(article, TEXT);
    const name = own(article, `a[href="/${ref.handle}"]`).map((a) => a.innerText.trim()).find((s) => s && !s.startsWith("@")) || null;
    const qm = own(article, 'a[href*="/status/"]').map((a) => /\/([^/]+)\/status\/(\d+)/.exec(a.getAttribute("href"))).find((m) => m && m[2] !== ref.id);
    const q = t.quotedId && xPosts.get(t.quotedId);
    const quoted = q ? { text: q.text, url: xUrl(q.author, t.quotedId), author: q.author } : langs[1] && qm ? { text: txt(langs[1]), url: xUrl(qm[1], qm[2]), author: qm[1] } : null;
    // The post it answers: from X's data, or, on the post's own page, the post drawn just above it.
    const above = !t.replyTo && new RegExp(`/status/${ref.id}(?:$|[/?#])`).test(location.pathname) ? previousArticle(article) : null, ar = above && xPostId(above);
    const parent = t.replyTo ? { text: (xPosts.get(t.replyTo) || {}).text || null, url: xUrl(t.replyToHandle, t.replyTo), author: t.replyToHandle || null }
      : ar ? { text: txt(own(above, TEXT)[0]), url: xUrl(ar.handle, ar.id), author: ar.handle } : null;
    const time = article.querySelector("time");
    // The whole text: X's long-post field when the page loaded it; else what the post shows, marked
    // incomplete when X cut it short behind "Show more".
    const full = t.fullText || (t.text && t.text.length < 2000 ? t.text : null), shown = txt(langs[0]);
    const more = own(article, '[data-testid="tweet-text-show-more-link"]').length > 0 || own(article, "button, a, span[role=button]").some((e) => /^show more$/i.test(e.textContent.trim()));
    return { site: "x", text: full || (shown && t.text && t.text.length > shown.length ? t.text : shown || t.text || null), textComplete: !!full || !more, authorName: name, handle: ref.handle, postUrl: xUrl(ref.handle, ref.id),
      postedAt: t.posted || (time && time.dateTime) || PB.snowflakeTime(ref.id), quoted, parent, thread: xThread(article, ref, t), threadComplete: xThreadOf(article, ref, t).complete, engagement: xEngagement(article, t), ...xExtras(article),
      links: t.links || [], fields: xFields(t) };
  }
  // What X's own post data says beyond the words, as X records it: language, posting app, how many
  // earlier versions, a Community Note, X's paid-partnership mark, a repost's original. Kept by a
  // library (library.js) in its index; X's claims about the post, never ground truth.
  function xFields(t) {
    const f = { lang: t.lang, client: t.client, edits: t.edits, community_note: t.note, community_note_id: t.noteId, paid_partnership: t.paidPartnership, repost_of: t.repostOf, views: t.views };
    return Object.fromEntries(Object.entries(f).filter(([, v]) => v != null));
  }

  // Replies, reposts, quotes, likes, bookmarks and views as the page or X's data shows them at save time.
  function xEngagement(article, t) {
    const fromData = { replies: t.replies, reposts: t.reposts, quotes: t.quotes, likes: t.likes, bookmarks: t.bookmarks, views: t.views };
    const out = {};
    for (const [k, v] of Object.entries(fromData)) if (v != null) out[k] = v;
    const label = (id) => { const b = own(article, `[data-testid="${id}"]`)[0]; const m = b && /^([\d.,]+[KMB]?)\s/i.exec(b.getAttribute("aria-label") || ""); return m ? m[1] : null; };
    for (const [k, id] of [["replies", "reply"], ["reposts", "retweet"], ["likes", "like"], ["bookmarks", "bookmark"]]) if (out[k] == null) { const v = label(id); if (v) out[k] = v; }
    if (out.views == null) { const a = own(article, 'a[href$="/analytics"]')[0]; const m = a && /^([\d.,]+[KMB]?)\s/i.exec(a.getAttribute("aria-label") || ""); if (m) out.views = m[1]; }
    return Object.keys(out).length ? out : null;
  }

  // Link cards and polls as X draws them in the post (signed in; signed out X shows neither).
  function xExtras(article) {
    const cards = own(article, '[data-testid="card.wrapper"]').map((c) => {
      const a = c.querySelector("a[href]");
      const title = [...c.querySelectorAll("span")].map((s) => s.textContent.trim()).filter((s) => s.length > 3 && !/^From /.test(s)).sort((x, y) => y.length - x.length)[0] || null;
      return a ? { url: a.href, title } : null;
    }).filter(Boolean);
    const pollBox = own(article, '[data-testid="cardPoll"]')[0];
    let poll = null;
    if (pollBox) {
      const lines = pollBox.innerText.split("\n").map((l) => l.trim()).filter(Boolean), options = [];
      // Results read "label, then its share" or "share, then its label"; the first two lines say which.
      const PCT = /^\d+(\.\d+)?%$/, after = PCT.test(lines[1] || "");
      for (let i = 0; i < lines.length; i++) {
        if (/votes?|left|final results/i.test(lines[i]) || PCT.test(lines[i])) continue;
        const r = after ? lines[i + 1] : lines[i - 1];
        options.push({ label: lines[i], result: PCT.test(r || "") ? r : null });
      }
      const foot = lines.filter((l) => /votes?|left|final results/i.test(l));
      poll = { options, total: foot.find((l) => /votes?/i.test(l)) || null, status: foot.find((l) => /left|final/i.test(l)) || null };
    }
    return { cards, poll };
  }
  const withMeta = (item, meta, alt) => (item ? { ...item, meta: meta ? { ...meta, alt: alt || null } : null } : item);

  // Every picture and video in one X post, with a title for the file names.
  // The media of one post's own article, each with the given words.
  function xMediaOf(article, meta) {
    const ref = xPostId(article), known = ref && xPosts.get(ref.id);
    const videos = [...article.querySelectorAll("video")].filter((v) => v.closest("article") === article);
    const pics = own(article, 'img[src*="pbs.twimg.com/media/"]');
    if (known && known.media) {
      let v = 0, p = 0;
      const items = known.media.map((m) => (m.type === "photo" ? withMeta({ kind: "image", url: m.url }, meta, (pics[p++] || {}).alt) : withMeta(xVideo(videos[v++] || null, m), meta, null))).filter(Boolean);
      if (items.length) return items;
    }
    return [...pics.map((i) => withMeta(xTarget(i), meta, i.alt)), ...videos.map((x) => withMeta(xTarget(x), meta, null))].filter(Boolean);
  }

  // Every picture and video in one X post. On the post's own page, the author's thread below it
  // (their replies the page has loaded, in order) comes too, all under the first post's words.
  function xPost(article) {
    const ref = xPostId(article), meta = xMeta(article);
    const title = ref ? `${ref.handle} ${ref.id}` : document.title;
    const items = xMediaOf(article, meta);
    // The thread's media only where its chain is proved (xThreadOf), from the articles the page drew.
    const chain = ref ? xThreadOf(article, ref, xPosts.get(ref.id) || {}).ids : [];
    for (const id of chain) {
      const a = [...document.querySelectorAll("article")].find((x) => { const r = xPostId(x); return r && r.id === id; });
      if (a) items.push(...xMediaOf(a, meta));
    }
    return { title, items, thread: items.length > xMediaOf(article, meta).length };
  }

  // The host chain from an element out through any shadow roots.
  function closestAcross(el, selector) {
    for (let n = el; n; n = n.parentElement || (n.getRootNode && n.getRootNode().host) || null) if (n.matches && n.matches(selector)) return n;
    return null;
  }

  function redditVideo(player) {
    let best = null;
    try {
      const pm = JSON.parse(player.getAttribute("packaged-media-json") || "null");
      const perms = (((pm || {}).playbackMp4s || {}).permutations || []).filter((p) => p.source && p.source.url);
      best = perms.sort((a, b) => (b.source.dimensions || {}).width - (a.source.dimensions || {}).width)[0] || null;
    } catch { /* no packaged file */ }
    const video = player.querySelector("video") || (player.shadowRoot && player.shadowRoot.querySelector("video"));
    const poster = player.getAttribute("poster") || (video && video.poster) || null;
    if (best) return { kind: "video", url: best.source.url, poster, el: video || player };
    const src = player.getAttribute("src") || "";
    const id = (/v\.redd\.it\/([\w-]+)/.exec(src) || [])[1];
    const streams = [];
    if (/\.m3u8/.test(src)) streams.push({ type: "hls", url: src });
    if (id) streams.push({ type: "dash", url: `https://v.redd.it/${id}/DASHPlaylist.mpd` });
    return { kind: "video", url: null, streams, poster, el: video || player, protected: video && video.mediaKeys ? "The page plays this media through Encrypted Media Extensions (DRM)." : null };
  }

  const redditImg = (img) => {
    const u = PB.largestSource({ src: img.getAttribute("src") || img.dataset.lazySrc, srcset: img.getAttribute("srcset") || img.dataset.lazySrcset || "", layoutWidth: img.width }, { base: location.href });
    return u && /redd\.it\//.test(u) ? { kind: /\.gif(?:$|[?#])/i.test(u) ? "gif" : "image", url: PB.fullSizeUrl(u), el: img } : null;
  };

  // Title, self-text, author, subreddit and time, from the post's own attributes and text.
  function redditMeta(post) {
    const a = (k) => post.getAttribute(k) || null, link = a("permalink");
    const flair = post.querySelector("shreddit-post-flair, flair-tag, [slot='post-flair']");
    return { site: "reddit", title: a("post-title"), text: txt(post.querySelector('[slot="text-body"]')), handle: a("author") ? "u/" + a("author") : null,
      subreddit: a("subreddit-prefixed-name"), postUrl: link ? new URL(link, location.href).href : location.href, postedAt: a("created-timestamp"),
      flair: flair ? txt(flair) : null, links: redditLink(post), fields: redditFields(post),
      engagement: (() => { const e = {}; for (const [k, at] of [["score", "score"], ["comments", "comment-count"]]) if (a(at) != null) e[k] = a(at); return Object.keys(e).length ? e : null; })() };
  }

  // A link post's target, and what the post's own attributes say about it.
  function redditLink(post) {
    const h = post.getAttribute("content-href");
    try { return h && !/(^|\.)reddit\.com$/.test(new URL(h, location.href).hostname) ? [new URL(h, location.href).href] : []; } catch { return []; }
  }
  function redditFields(post) {
    const f = { post_type: post.getAttribute("post-type"), domain: post.getAttribute("domain"), nsfw: post.hasAttribute("nsfw") || null, spoiler: post.hasAttribute("spoiler") || null };
    return Object.fromEntries(Object.entries(f).filter(([, v]) => v != null && v !== ""));
  }

  function redditTarget(el) {
    const player = closestAcross(el, "shreddit-player, shreddit-player-2");
    const t = player ? redditVideo(player) : el.tagName === "IMG" ? redditImg(el) : null;
    const post = t && closestAcross(el, "shreddit-post");
    return t && post ? withMeta({ ...t, title: post.getAttribute("post-title") || null }, redditMeta(post), el.tagName === "IMG" ? el.alt : null) : t;
  }

  // Every picture or video in one Reddit post; a gallery gives every picture in order.
  function redditPost(post) {
    const title = post.getAttribute("post-title") || document.title;
    const players = [...post.querySelectorAll("shreddit-player, shreddit-player-2")];
    const meta = redditMeta(post);
    if (players.length) return { title, items: players.map((p) => withMeta(redditVideo(p), meta, null)) };
    const gallery = post.querySelector("gallery-carousel");
    const imgs = gallery ? [...gallery.querySelectorAll("li img, figure img")] : [...post.querySelectorAll('[slot="post-media-container"] img, img.media-lightbox-img, img[src*="i.redd.it"], img[src*="preview.redd.it"]')];
    const seen = new Set();
    const items = imgs.map((i) => withMeta(redditImg(i), meta, i.alt)).filter((t) => t && !seen.has(t.url) && seen.add(t.url));
    return { title, items, gallery: !!gallery };
  }

  return Object.freeze({
    isX, isReddit,
    targetFor: (el) => (isX ? xTargetTitled(el) : isReddit ? redditTarget(el) : null),
    postMedia: (node) => (isX ? xPost(node) : isReddit ? redditPost(node) : { title: document.title, items: [] }),
    // The post an element sits in, and that post's words, for a note of a text post.
    postOf: (el) => (el ? closestAcross(el, isX ? "article" : isReddit ? "shreddit-post" : "article") : null),
    postMetaOf: (node) => (isX ? xMeta(node) : isReddit ? redditMeta(node) : null),
  });
})();
