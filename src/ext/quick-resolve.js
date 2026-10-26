// Finds the media a right-click meant. The browser names the image or video only when the pointer
// was on it; sites such as Instagram and X lay a clear layer over their pictures, so this looks at
// everything stacked under the pointer, inside shadow roots too, and takes the first picture, video,
// canvas or background image. The point is the last right-click this script saw, or, where it was
// injected only on the click, the centre of the element still under the pointer (:hover).
globalThis.PBQuickResolve = globalThis.PBQuickResolve || (() => {
  "use strict";
  const STREAM = /\.(m3u8|mpd)(?:$|[?#])/i;
  let last = null;
  document.addEventListener("contextmenu", (e) => { last = { x: e.clientX, y: e.clientY, at: Date.now() }; }, true);

  const abs = (u) => { try { return new URL(u, location.href).href; } catch { return null; } };
  // Closed shadow roots too: chrome.dom in Chrome, the element's own method in Firefox content scripts.
  const shadowOf = (el) => {
    try {
      if (globalThis.chrome && chrome.dom && chrome.dom.openOrClosedShadowRoot) return chrome.dom.openOrClosedShadowRoot(el);
      if (typeof el.openOrClosedShadowRoot === "function") return el.openOrClosedShadowRoot();
    } catch { /* fall back to an open root */ }
    return el.shadowRoot || null;
  };

  // Every element under (x, y), topmost first, descending into shadow roots.
  function stackAt(x, y, root = document, depth = 0) {
    const out = [];
    for (const el of root.elementsFromPoint(x, y)) {
      const sr = depth < 4 ? shadowOf(el) : null;
      if (sr && sr.elementsFromPoint) for (const inner of stackAt(x, y, sr, depth + 1)) if (!out.includes(inner)) out.push(inner);
      if (!out.includes(el)) out.push(el);
    }
    return out;
  }

  // The newest of: the last right-click, the last pointer position the hover control saw
  // (quick-hover.js), the focused media element (the keyboard shortcut), the element under the pointer.
  function point() {
    const seen = [last, globalThis.PBHover ? PBHover.lastPoint() : null].filter((p) => p && Date.now() - p.at < 60000).sort((a, b) => b.at - a.at)[0];
    if (seen) return seen;
    const f = document.activeElement, m = f && f !== document.body && (isMedia(f) ? f : f.querySelector && f.querySelector("img, video, canvas"));
    if (m) { const r = m.getBoundingClientRect(); if (r.width && r.height) return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
    const hovered = [...document.querySelectorAll(":hover")].pop();
    if (!hovered) return null;
    const r = hovered.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  const bgUrl = (el) => {
    const m = /url\(["']?([^"')]+)["']?\)/.exec(getComputedStyle(el).backgroundImage || "");
    return m ? abs(m[1]) : null;
  };
  const isMedia = (el) => ["IMG", "VIDEO", "AUDIO", "CANVAS"].includes(el.tagName) || (el.tagName === "image" && el.namespaceURI === "http://www.w3.org/2000/svg");

  // The HLS or DASH addresses the page fetched, newest last; those whose address shares a long
  // number with the poster (X names both by the media id) come first.
  function loadedStreams(hint) {
    let names = [];
    try { names = performance.getEntriesByType("resource").map((e) => e.name).filter((u) => STREAM.test(u)); } catch { /* no timing here */ }
    const ids = String(hint || "").match(/\d{8,}/g) || [];
    const list = [...new Set(names)].map((url) => ({ type: /\.m3u8/i.test(url) ? "hls" : "dash", url }));
    const mine = list.filter((s) => ids.some((id) => s.url.includes(id)));
    // The last one is tried first: the whole stream's playlist (shortest address), never a
    // sound-only or single-quality one when the whole is there (X lists /pl/mp4a/ and /pl/avc1/ too).
    const part = (u) => /\/(mp4a|avc1|hvc1|audio|video)\/|_audio|audio_/i.test(u);
    return (mine.length ? mine : list).sort((a, b) => Number(part(b.url)) - Number(part(a.url)) || b.url.length - a.url.length);
  }

  function imageTarget(img) {
    const pic = img.parentElement && img.parentElement.tagName === "PICTURE" ? img.parentElement : null;
    const sources = pic ? [...pic.querySelectorAll("source")].map((s) => ({ srcset: s.srcset, type: s.type || null })) : [];
    const rect = img.getBoundingClientRect();
    const supports = (t) => !/jxl/i.test(t);
    const url = PB.largestSource({ src: img.src, currentSrc: img.currentSrc, srcset: img.srcset, sources, layoutWidth: rect.width, naturalWidth: img.naturalWidth }, { base: location.href, supports });
    const all = [img.src, ...sources.flatMap((s) => PB.parseSrcset(s.srcset).map((c) => c.url))].map(abs).filter(Boolean);
    return { kind: /\.gif(?:$|[?#])/i.test(url || "") ? "gif" : "image", url, gifUrl: all.find((u) => /\.gif(?:$|[?#])/i.test(u)) || null, el: img, alt: img.alt || null };
  }

  function mediaTarget(el) {
    // An empty src would resolve to the page's own address; a player using srcObject has none.
    const sources = [el.currentSrc, el.src, ...[...el.querySelectorAll("source")].map((s) => s.src)].filter(Boolean).map(abs).filter(Boolean);
    const direct = sources.find((u) => /^https?:/i.test(u) && !STREAM.test(u)) || null;
    const listed = sources.filter((u) => STREAM.test(u)).map((url) => ({ type: /\.m3u8/i.test(url) ? "hls" : "dash", url }));
    const blob = sources.some((u) => u.startsWith("blob:"));
    const poster = el.poster ? abs(el.poster) : null;
    const giphy = direct && /(^|\.)giphy\.com$/.test(new URL(direct).hostname) ? direct.replace(/\.mp4(\?|$)/, ".gif$1") : null;
    return { kind: el.tagName === "AUDIO" ? "audio" : "video", url: direct || (blob ? sources.find((u) => u.startsWith("blob:")) : null), el, poster,
      streams: listed.length ? listed : !direct ? loadedStreams(poster) : [], gifUrl: giphy,
      protected: el.mediaKeys ? "The page plays this media through Encrypted Media Extensions (DRM)." : null };
  }

  function targetOf(el) {
    if (el.tagName === "IMG") return imageTarget(el);
    if (el.tagName === "VIDEO" || el.tagName === "AUDIO") return mediaTarget(el);
    if (el.tagName === "CANVAS") return { kind: "image", canvas: true, el };
    if (el.tagName === "image") return { kind: "image", url: abs(el.getAttribute("href") || el.getAttribute("xlink:href")), el };
    const bg = bgUrl(el);
    return bg ? { kind: "image", url: bg, el, background: true } : null;
  }

  // The site's own resolver first (quick-sites.js: X and Reddit know their files), then the stack.
  function fromElement(el) {
    // YouTube video is never downloaded by the extension: a reference to it is saved instead.
    if (el.tagName === "VIDEO" && globalThis.PBYouTube && PBYouTube.isYouTube) return PBYouTube.reference();
    const site = globalThis.PBQuickSites && PBQuickSites.targetFor(el);
    return site || targetOf(el);
  }

  // The target for a right-click, the hover control or the keyboard. info: { srcUrl, linkUrl, at }
  // where `at` is the point the hover control was over.
  function resolve({ srcUrl = null, linkUrl = null, at = null } = {}) {
    const p = at && Number.isFinite(at.x) && Number.isFinite(at.y) ? at : point();
    const stack = p ? stackAt(p.x, p.y) : [];
    if (srcUrl && !/^blob:/.test(srcUrl)) {
      const el = stack.find((e) => isMedia(e) && [e.currentSrc, e.src].includes(srcUrl)) || [...document.querySelectorAll("img, video, audio, source")].find((e) => [e.currentSrc, e.src].includes(srcUrl));
      const host = el && el.tagName === "SOURCE" ? el.parentElement : el;
      if (host) return fromElement(host);
    }
    for (const el of stack) {
      if (el.nodeType !== 1 || el.tagName === "DAYLIGHT-TOAST") continue;
      const t = isMedia(el) ? fromElement(el) : (globalThis.PBQuickSites && PBQuickSites.targetFor(el)) || (bgUrl(el) ? targetOf(el) : null);
      if (t) return t;
    }
    if (linkUrl && PB.mediaKindOf("", linkUrl)) return { kind: PB.mediaKindOf("", linkUrl), url: linkUrl };
    if (srcUrl) return { kind: /\.gif(?:$|[?#])/i.test(srcUrl) ? "gif" : "image", url: srcUrl };
    return null;
  }

  return Object.freeze({ resolve, fromElement, fromElementPlain: targetOf, loadedStreams, stackAt });
})();
