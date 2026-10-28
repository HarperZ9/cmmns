// The hover Download control. When the pointer rests for 300 ms on a picture, GIF, video or canvas
// at least 120 by 120 CSS pixels, the control (quick-hover-ui.js) appears in its top-right corner.
// The media is found by looking at everything stacked under the pointer, inside shadow roots, so a
// clear layer over a picture or a player that keeps its own clicks does not hide it. A click hands
// the point to the worker (quick-save-bg.js), which runs the same download as the right-click menu.
// Nothing is read or sent until that click. Not drawn where the X and Reddit Download button shows.
globalThis.PBHover = globalThis.PBHover || (() => {
  "use strict";
  const MIN = 120, DELAY = 300, NEAR = 24, MISS_MS = 120, KEY = "pb.settings";
  const host = location.hostname.replace(/^www\./, "");
  let settings = {}, last = null, timer = 0, shown = null, raf = 0;

  const off = () => settings.hoverDownload === false || (settings.hoverOffSites || []).includes(host);
  try {
    chrome.storage.local.get(KEY).then((g) => { settings = g[KEY] || {}; }, () => {});
    chrome.storage.onChanged.addListener((ch, area) => { if (area === "local" && ch[KEY]) { settings = ch[KEY].newValue || {}; if (off()) hide(); } });
  } catch { /* no storage in this frame: defaults apply */ }

  const shadowOf = (el) => {
    try {
      if (globalThis.chrome && chrome.dom && chrome.dom.openOrClosedShadowRoot) return chrome.dom.openOrClosedShadowRoot(el);
      if (typeof el.openOrClosedShadowRoot === "function") return el.openOrClosedShadowRoot();
    } catch { /* an open root or none */ }
    return el.shadowRoot || null;
  };
  function stackAt(x, y, root = document, depth = 0) {
    const out = [];
    for (const el of root.elementsFromPoint(x, y)) {
      const sr = depth < 4 ? shadowOf(el) : null;
      if (sr && sr.elementsFromPoint) for (const inner of stackAt(x, y, sr, depth + 1)) if (!out.includes(inner)) out.push(inner);
      if (!out.includes(el)) out.push(el);
    }
    return out;
  }

  const KIND = { IMG: "picture", VIDEO: "video", CANVAS: "drawing", AUDIO: "sound" };
  const bigEnough = (r) => r.width >= MIN && r.height >= MIN;
  const extOf = (u) => ((/\.([a-z0-9]{3,4})(?:$|[?#])/i.exec(u || "") || [])[1] || "").toUpperCase();
  const bgOf = (el) => { const m = /url\(["']?([^"')]+)["']?\)/.exec(getComputedStyle(el).backgroundImage || ""); return m ? m[1] : null; };

  // YouTube: references and links only; video download only where the build carries the command
  // line hand-off (yt-handoff.js, left out of store packages).
  const YT_MENU = () => [["study", "Study"], ["ytlink", "Copy link at this time"], ["caption", "Copy with caption"], ...(globalThis.PBYtHandoff ? [PBYtHandoff.MENU] : []),
    null, ["never", "Never on this site"], ["off", "Turn off hover download"]];

  // The X and Reddit button already covers posts there.
  function inlineCovers(el) {
    if (!/^(x|twitter)\.com$|(^|\.)reddit\.com$/.test(host) || settings.mediaButtons === false) return false;
    for (let n = el; n; n = n.parentElement || (n.getRootNode && n.getRootNode().host) || null) {
      if (n.tagName === "ARTICLE" || n.tagName === "SHREDDIT-POST") return !!n.querySelector(".dc-dl");
    }
    return false;
  }

  // The media under (x, y): { el, rect, label } or null.
  function mediaAt(x, y) {
    for (const el of stackAt(x, y)) {
      if (el.nodeType !== 1 || PBHoverUi.isHost(el)) continue;
      const tag = el.tagName, media = KIND[tag] && tag !== "AUDIO";
      const bg = !media && el.children.length < 4 && bgOf(el);
      if (!media && !bg) continue;
      const rect = el.getBoundingClientRect();
      if (!bigEnough(rect)) continue;
      if (inlineCovers(el)) return null;
      const src = tag === "IMG" ? el.currentSrc || el.src : tag === "VIDEO" ? el.currentSrc || el.src : bg;
      const kind = media ? KIND[tag] : "picture", ext = tag === "CANVAS" ? "PNG" : extOf(src);
      if (tag === "VIDEO" && /(^|\.)youtube\.com$/.test(host)) return { el, rect, src: null, label: "Save a reference to this video", menu: YT_MENU() };
      return { el, rect, src, label: `Download ${ext ? ext + " " : ""}${kind}` };
    }
    return null;
  }

  function act(action) {
    if (!shown) return;
    // A page opened before an update keeps this old script: it cannot reach the extension any more.
    if (!(globalThis.chrome && chrome.runtime && chrome.runtime.id)) { PBHoverUi.show(shown.el ? shown.el.getBoundingClientRect() : { left: shown.at.x, right: shown.at.x + 70, top: shown.at.y, bottom: shown.at.y + 40 }, "CMMNS was updated: reload this page", () => {}, [null]); return; }
    const s = shown, p = s.at;
    // A selection's actions carry its words: the click may have cleared it by the time they run.
    if (s.kind === "selection" && action === "download") action = "text-note";
    const selection = s.kind === "selection" ? s.text : null;
    if (selection || action === "never" || action === "off") hide();
    // Every failure is said beside the control: the worker's reason, or that it could not be reached.
    const fail = (why) => { console.warn("[cmmns] the download control:", why); PBHoverUi.note(`Not saved: ${why}`); };
    chrome.runtime.sendMessage({ type: "pb-hover-action", action, at: { x: p.x, y: p.y }, selection, src: s.src && /^https?:/.test(s.src) ? s.src : null })
      .then((r) => { if (r && r.error) fail(r.error); }, (e) => fail(/context invalidated/i.test(String(e && e.message)) ? "CMMNS was updated: reload this page" : `CMMNS could not be reached (${e && e.message})`));
  }

  function hide() { clearTimeout(timer); anchor = null; shown = null; if (globalThis.PBHoverUi) PBHoverUi.hide(); }

  // The media last found under the pointer. While the topmost element stays the same and the point is
  // still inside that media, it is the same media. A miss holds only within 4 px of where it was
  // found and for MISS_MS: one clear layer can cover a caption and a picture alike, and a picture can
  // grow under it as it loads.
  let lastTop = null, lastMedia = null, lastAt = 0, lastX = 0, lastY = 0;
  const inside = (r, x, y) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  function mediaUnder(x, y) {
    const top = document.elementFromPoint(x, y), now = Date.now();
    const same = top === lastTop && (lastMedia ? inside(lastMedia.el.getBoundingClientRect(), x, y) : now - lastAt < MISS_MS && Math.abs(x - lastX) <= 4 && Math.abs(y - lastY) <= 4);
    if (same) return lastMedia;
    lastTop = top; lastMedia = mediaAt(x, y); lastAt = now; lastX = x; lastY = y;
    return lastMedia;
  }

  // The control shows once the pointer has rested within NEAR px of one point for DELAY ms. The small
  // moves of a hand on a mouse or trackpad do not start the wait again; a move further away does.
  let anchor = null;
  function consider(x, y) {
    if (shown && (shown.kind === "selection" || PBHoverUi.covers(x, y) || PBHoverUi.menuOpen())) return;
    const m = off() ? null : mediaUnder(x, y);
    if (shown && m && m.el === shown.el) { shown.at = { x, y, at: Date.now() }; return; }
    if (shown && !m) { hide(); return; }
    if (!m) { clearTimeout(timer); anchor = null; return; }
    if (anchor && anchor.el === m.el && Math.abs(anchor.x - x) <= NEAR && Math.abs(anchor.y - y) <= NEAR) return;
    clearTimeout(timer);
    anchor = { el: m.el, x, y };
    timer = setTimeout(() => {
      const a = anchor;
      anchor = null;
      if (!a || !last || Math.abs(last.x - a.x) > NEAR || Math.abs(last.y - a.y) > NEAR) return;   // the pointer moved on
      shown = { ...m, at: { x: last.x, y: last.y, at: Date.now() } };
      PBHoverUi.show(m.el.getBoundingClientRect(), m.label, act, m.menu || null);
    }, DELAY);
  }

  addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    last = { x: e.clientX, y: e.clientY, at: Date.now() };
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; try { consider(last.x, last.y); } catch (err) { console.warn("[cmmns] hover control", err); } });
  }, { capture: true, passive: true });
  // The control follows its media on scroll and resize, and leaves with the page.
  const follow = () => { lastTop = null; if (shown && shown.kind === "selection") { hide(); return; } if (shown) { const r = shown.el.getBoundingClientRect(); if (!r.width || r.bottom < 0 || r.top > innerHeight) hide(); else PBHoverUi.place(r); } };
  addEventListener("scroll", follow, { capture: true, passive: true });
  addEventListener("resize", follow, { passive: true });
  addEventListener("blur", () => { if (!PBHoverUi.menuOpen()) hide(); });

  // Selected text anywhere (articles, forums, comments): "Save selection" beside its end.
  const SEL_MENU = [["text-study", "Study"], ["text-caption", "Copy with caption"], ["text-card", "Save as card"], null, ["never", "Never on this site"], ["off", "Turn off hover download"]];
  function selectionShown() {
    if (off()) return;
    const sel = getSelection(), text = sel ? sel.toString().trim() : "";
    const inField = document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName) || (document.activeElement && document.activeElement.isContentEditable);
    if (text.length < 3 || inField || !sel.rangeCount) { if (shown && shown.kind === "selection") hide(); return; }
    const rects = [...sel.getRangeAt(0).getClientRects()].filter((r) => r.width || r.height), r = rects[rects.length - 1];
    if (!r) return;
    const box = { left: r.right - 4, right: r.right + 70, top: r.bottom + 2, bottom: r.bottom + 40, width: 74, height: 38 };
    shown = { kind: "selection", text: text.slice(0, 20000), el: null, at: { x: r.right, y: r.bottom, at: Date.now() } };
    PBHoverUi.show(box, "Save selection as a note", act, SEL_MENU);
  }
  document.addEventListener("mouseup", (e) => { if (e.button === 0) setTimeout(selectionShown, 10); }, true);
  document.addEventListener("keyup", (e) => { if (e.shiftKey || e.key === "Shift") selectionShown(); }, true);
  document.addEventListener("selectionchange", () => { if (shown && shown.kind === "selection" && !getSelection().toString().trim()) hide(); });
  document.addEventListener("pointerleave", () => { if (!PBHoverUi.menuOpen()) hide(); });

  return Object.freeze({ lastPoint: () => last, hide, mediaAt });
})();
