// The generic save, in the page: works on any page, with no site reader. It reads what the page
// states about itself (title, canonical address, Open Graph, JSON-LD and citation tags), the
// visible text of the selection, of the block under the pointer, or of the page's article or main
// block, and the pictures, videos, sounds and download links inside that block with their
// addresses. src/core/page-capture.js turns that into a daylight.sidecar/1 record with
// adapter "article" or "generic". "Save page" also saves each file the page offers as a plain
// address; a stream, a player's in-memory source or protected media is listed with the reason it
// was not saved. Read on the click only; the only requests are for those plain files.
globalThis.PBPageCapture = globalThis.PBPageCapture || (() => {
  "use strict";
  const SKIP = "nav, header, footer, aside, form, script, style, noscript, template, [role=navigation], [role=banner], [role=contentinfo], [aria-hidden=true], daylight-toast, .dc-dl";
  const ARTICLE = 'article, [itemprop="articleBody"], [role="article"]', MAIN = 'main, [role="main"]';
  const BLOCK = "p, div, li, h1, h2, h3, h4, h5, h6, blockquote, pre, td, th, figcaption, section, article, dt, dd, summary";
  const FILE_LINK = /\.(pdf|mp3|m4a|wav|flac|ogg|oga|opus|mp4|m4v|webm|mov|gif|png|jpe?g|webp|avif|svg|csv|json|zip)(?:$|[?#])/i;
  const TEXT_MAX = 200000, MAX_FILES = 24;
  const abs = (u) => { try { return new URL(u, location.href).href; } catch { return null; } };

  function metas() {
    return [...document.querySelectorAll("meta[property], meta[name], meta[itemprop]")].slice(0, 400)
      .map((m) => ({ key: m.getAttribute("property") || m.getAttribute("name") || m.getAttribute("itemprop"), content: m.getAttribute("content") }));
  }
  const jsonld = () => [...document.querySelectorAll('script[type="application/ld+json"]')].slice(0, 12).map((s) => (s.textContent || "").slice(0, 200000));

  // The block a save reads: the one the pointer or selection sits in, else the page's longest
  // article, else its main block, else the body. Returns [element, "article" | "main" | "body"].
  function blockOf(el) {
    const near = el && el.closest ? el.closest(`${ARTICLE}, ${MAIN}`) : null;
    if (near) return [near, near.matches(ARTICLE) ? "article" : "main"];
    const arts = [...document.querySelectorAll(ARTICLE)].filter((a) => !a.closest(SKIP)).sort((a, b) => (b.textContent || "").length - (a.textContent || "").length);
    if (arts[0] && (arts[0].textContent || "").trim().length > 200) return [arts[0], "article"];
    const main = document.querySelector(MAIN);
    return main ? [main, "main"] : [document.body, "body"];
  }

  // The block's visible text, paragraph by paragraph, without its navigation, forms and scripts.
  function textOf(root) {
    const out = [], walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let last = null, size = 0, cut = false;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const p = n.parentElement, words = n.nodeValue.replace(/\s+/g, " ");
      if (!p || !words.trim() || p.closest(SKIP) || (p.checkVisibility && !p.checkVisibility())) continue;
      const block = p.closest(BLOCK) || root;
      if (block !== last) { out.push(""); last = block; }
      out[out.length - 1] += words;
      size += words.length;
      if (size > TEXT_MAX) { cut = true; break; }
    }
    return { text: out.map((s) => s.trim()).filter(Boolean).join("\n\n") || null, cut };
  }

  // Pictures, videos, sounds and file links inside the block, each as a download target.
  function mediaOf(root, within = null) {
    const seen = new Set(), out = [];
    const add = (t, alt, w, h) => {
      const url = t && (t.url || (t.streams && t.streams[0] && t.streams[0].url)) || null, key = url || t.el;
      if (!t || seen.has(key)) return;
      seen.add(key);
      out.push({ target: t, item: { kind: t.kind, url: url || t.poster || location.href, alt: alt || null, width: w || null, height: h || null, protected: t.protected || null, stream: !t.url && !!(t.streams || []).length, noUrl: !url } });
    };
    for (const el of root.querySelectorAll("img, video, audio")) {
      if (el.closest(SKIP) || (within && !within(el))) continue;
      const r = el.getBoundingClientRect();
      if (el.tagName === "IMG" && (Math.max(r.width, el.naturalWidth || 0) < 64 || /^data:/i.test(el.currentSrc || el.src || ""))) continue;
      add(PBQuickResolve.fromElementPlain(el), el.alt || el.getAttribute("aria-label"), el.naturalWidth || el.videoWidth, el.naturalHeight || el.videoHeight);
    }
    for (const a of root.querySelectorAll("a[href]")) {
      const url = abs(a.getAttribute("href"));
      if (!url || !/^https?:/i.test(url) || a.closest(SKIP) || (within && !within(a)) || !(a.hasAttribute("download") || FILE_LINK.test(url))) continue;
      add({ kind: PB.mediaKindOf("", url) || "file", url, link: true }, (a.textContent || "").trim().slice(0, 200), null, null);
    }
    return out.slice(0, 60);
  }

  const linksOf = (root) => [...new Set([...root.querySelectorAll("a[href]")].filter((a) => !a.closest(SKIP)).map((a) => abs(a.getAttribute("href"))).filter((u) => u && /^https?:/i.test(u)))].slice(0, 200);

  // What the page side read, for PB.pageRaw. { at, selection, el }: the point, the selected words.
  function read({ at = null, selection = null, el = null } = {}) {
    const sel = String(selection || "").trim();
    const under = el || (at && PBQuickResolve.stackAt(at.x, at.y)[0]) || (sel && getSelection().rangeCount ? getSelection().getRangeAt(0).commonAncestorContainer : null);
    const [root, from] = blockOf(under && under.nodeType === 3 ? under.parentElement : under);
    // A selection lists only the media inside it; when the click cleared it, the words alone.
    const range = sel && getSelection().rangeCount && !getSelection().isCollapsed ? getSelection().getRangeAt(0) : null;
    const body = sel ? { text: sel, cut: false } : textOf(root), found = sel && !range ? [] : mediaOf(root, range ? (n) => range.intersectsNode(n) : null);
    const canon = document.querySelector('link[rel="canonical"]');
    return { targets: found.map((f) => f.target), summary: { url: location.href, host: location.hostname, title: document.title || null, text: body.text, textCut: body.cut, textFrom: sel ? "selection" : from, selection: !!sel,
      metas: metas(), jsonld: jsonld(), canonical: canon ? abs(canon.getAttribute("href")) : null, lang: document.documentElement.getAttribute("lang"), media: found.map((f) => f.item), links: linksOf(root) } };
  }

  // The raw record alone (a note: the text, the page's metadata and the media's addresses).
  function raw(info) {
    const r = read(info);
    for (const m of r.summary.media) m.file = "not saved (not asked for; Save page saves the files the page offers)";
    const out = PB.pageRaw(r.summary);
    return out.text || out.items.length ? out : null;
  }

  // "Save page": each plain file first, then one note that lists every file and what became of it.
  async function files(r, p) {
    const base = PB.pageRaw(r.summary), names = [];
    let n = 0;
    for (const [i, t] of r.targets.entries()) {
      const item = r.summary.media[i], offer = PB.mediaOffer(item);
      if (!offer.plain) { item.file = `not saved (${offer.reason})`; continue; }
      if (p.protection) { item.file = "not saved (source protection is on, so no file was asked for)"; continue; }
      if (++n > MAX_FILES) { item.file = `not saved (over the ${MAX_FILES} files one page save takes)`; continue; }
      PBQuickToast.show(`Saving the page's files: ${n}`, { stay: 0 });
      const got = await PBQuickSave.start({ ...t, meta: { ...base, kind: "media", alt: item.alt } }, { quiet: true, oneSidecar: true, title: base.title, index: i, total: r.targets.length });
      const name = (got.names || [])[0] || (got.already && (/as (.+?)\.?$/.exec(got.line || "") || [])[1]) || null;
      item.file = got.ok && name ? name : got.already ? "saved earlier" : `not saved (${got.line || "the download did not start"})`;
      if (got.ok && (got.names || []).length) names.push(...got.names);
    }
    return names;
  }

  async function save(info = {}) {
    const r = read(info);
    let p;
    try { const k = PB.SETTINGS_KEY; p = PB.normalizeSettings((await chrome.storage.local.get(k))[k]); } catch { p = PB.normalizeSettings(null); }
    const names = info.selection ? [] : await files(r, p);
    if (info.selection) for (const m of r.summary.media) m.file = "not saved (a selection keeps the words and the addresses of its media)";
    const record = PB.pageRaw(r.summary);
    return record.text || record.items.length ? { raw: record, names } : null;
  }

  return Object.freeze({ read, raw, save, blockOf, textOf, mediaOf });
})();
