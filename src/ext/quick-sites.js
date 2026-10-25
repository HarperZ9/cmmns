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
    } catch (err) { console.warn("[daylight-commons] could not read X's media list", err); }
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
  function xThread(article, ref, t) {
    const out = [];
    for (let cur = ref.id, i = 0; i < 25; i++) {
      const next = [...xPosts.values()].find((p) => p.replyTo === cur && p.author && p.author === (t.author || ref.handle));
      if (!next) break;
      out.push(next.text); cur = next.id;
    }
    if (out.length) return out.filter(Boolean);
    for (let a = article.nextElementSibling || nextArticle(article); a; a = nextArticle(a)) {
      const r = xPostId(a);
      if (!r || r.handle.toLowerCase() !== ref.handle.toLowerCase()) break;
      out.push(txt(own(a, TEXT)[0]));
    }
    return out.filter(Boolean);
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
    const parent = t.replyTo ? { text: (xPosts.get(t.replyTo) || {}).text || null, url: xUrl(t.replyToHandle, t.replyTo), author: t.replyToHandle || null } : null;
    const time = article.querySelector("time");
    return { site: "x", text: t.text || txt(langs[0]), authorName: name, handle: ref.handle, postUrl: xUrl(ref.handle, ref.id),
      postedAt: t.posted || (time && time.dateTime) || PB.snowflakeTime(ref.id), quoted, parent, thread: xThread(article, ref, t) };
  }
  const withMeta = (item, meta, alt) => (item ? { ...item, meta: meta ? { ...meta, alt: alt || null } : null } : item);

  // Every picture and video in one X post, with a title for the file names.
  function xPost(article) {
    const ref = xPostId(article), known = ref && xPosts.get(ref.id);
    const title = ref ? `${ref.handle} ${ref.id}` : document.title;
    const videos = [...article.querySelectorAll("video")].filter((v) => v.closest("article") === article);
    const meta = xMeta(article), pics = own(article, 'img[src*="pbs.twimg.com/media/"]');
    if (known && known.media) {
      let v = 0, p = 0;
      const items = known.media.map((m) => (m.type === "photo" ? withMeta({ kind: "image", url: m.url }, meta, (pics[p++] || {}).alt) : withMeta(xVideo(videos[v++] || null, m), meta, null))).filter(Boolean);
      if (items.length) return { title, items };
    }
    const imgs = pics.map((i) => withMeta(xTarget(i), meta, i.alt)).filter(Boolean);
    return { title, items: [...imgs, ...videos.map((x) => withMeta(xTarget(x), meta, null)).filter(Boolean)] };
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
    return { site: "reddit", title: a("post-title"), text: txt(post.querySelector('[slot="text-body"]')), handle: a("author") ? "u/" + a("author") : null,
      subreddit: a("subreddit-prefixed-name"), postUrl: link ? new URL(link, location.href).href : location.href, postedAt: a("created-timestamp") };
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
  });
})();
