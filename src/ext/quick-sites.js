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
    if (e.source !== window || !e.data || e.data.source !== "radar-sniff") return;
    try {
      for (const t of PB.tweetsIn(e.data.json)) {
        if (!t.media) continue;
        xPosts.set(t.id, { media: t.media, author: t.author || null });
        for (const m of t.media) { const k = thumbKey(m.url); if (k) xByThumb.set(k, m); }
      }
      while (xPosts.size > 3000) xPosts.delete(xPosts.keys().next().value);
      while (xByThumb.size > 6000) xByThumb.delete(xByThumb.keys().next().value);
    } catch (err) { console.warn("[daylight-commons] could not read X's media list", err); }
  });

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
    return t && ref ? { ...t, title: `${ref.handle} ${ref.id}` } : t;
  }

  const xPostId = (article) => {
    const a = [...article.querySelectorAll('a[href*="/status/"]')].find((x) => x.querySelector("time")) || article.querySelector('a[href*="/status/"]');
    const m = a && /\/([^/]+)\/status\/(\d+)/.exec(a.getAttribute("href"));
    return m ? { handle: m[1], id: m[2] } : null;
  };

  // Every picture and video in one X post, with a title for the file names.
  function xPost(article) {
    const ref = xPostId(article), known = ref && xPosts.get(ref.id);
    const title = ref ? `${ref.handle} ${ref.id}` : document.title;
    const videos = [...article.querySelectorAll("video")];
    if (known) {
      let v = 0;
      const items = known.media.map((m) => (m.type === "photo" ? { kind: "image", url: PB.fullSizeUrl(m.url) } : xVideo(videos[v++] || null, m))).filter(Boolean);
      if (items.length) return { title, items };
    }
    const imgs = [...article.querySelectorAll('[data-testid="tweetPhoto"] img')].map((i) => xTarget(i)).filter(Boolean);
    return { title, items: [...imgs, ...videos.map((x) => xTarget(x)).filter(Boolean)] };
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

  function redditTarget(el) {
    const player = closestAcross(el, "shreddit-player, shreddit-player-2");
    const t = player ? redditVideo(player) : el.tagName === "IMG" ? redditImg(el) : null;
    const post = t && closestAcross(el, "shreddit-post");
    return t && post && post.getAttribute("post-title") ? { ...t, title: post.getAttribute("post-title") } : t;
  }

  // Every picture or video in one Reddit post; a gallery gives every picture in order.
  function redditPost(post) {
    const title = post.getAttribute("post-title") || document.title;
    const players = [...post.querySelectorAll("shreddit-player, shreddit-player-2")];
    if (players.length) return { title, items: players.map(redditVideo) };
    const gallery = post.querySelector("gallery-carousel");
    const imgs = gallery ? [...gallery.querySelectorAll("li img, figure img")] : [...post.querySelectorAll('[slot="post-media-container"] img, img.media-lightbox-img, img[src*="i.redd.it"], img[src*="preview.redd.it"]')];
    const seen = new Set();
    const items = imgs.map(redditImg).filter((t) => t && !seen.has(t.url) && seen.add(t.url));
    return { title, items, gallery: !!gallery };
  }

  return Object.freeze({
    isX, isReddit,
    targetFor: (el) => (isX ? xTargetTitled(el) : isReddit ? redditTarget(el) : null),
    postMedia: (node) => (isX ? xPost(node) : isReddit ? redditPost(node) : { title: document.title, items: [] }),
  });
})();
