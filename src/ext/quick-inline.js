// A Download button on X and Reddit posts with pictures, videos or GIFs. On X it sits in the post's
// own row of actions (reply, repost, like) and looks like them; on Reddit it sits in the corner of
// the post's media. One click saves every file in the post: all pictures of a gallery, each video
// with its sound. Buttons are added once per post and again as the site redraws or scrolls; they
// stop the click there, so the site never opens the post by accident. Turned off in the settings.
(() => {
  "use strict";
  if (!globalThis.PBQuickSites || !(PBQuickSites.isX || PBQuickSites.isReddit)) return;
  const MARK = "data-dc-dl";
  const ICON = "M12 3.5a1 1 0 0 1 1 1v8.09l2.8-2.8a1 1 0 1 1 1.4 1.42l-4.5 4.5a1 1 0 0 1-1.4 0l-4.5-4.5a1 1 0 0 1 1.4-1.42l2.8 2.8V4.5a1 1 0 0 1 1-1zM5 18.5a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1z";
  const on = () => !globalThis.PBSettings || PBSettings.get().mediaButtons !== false;

  function svg() {
    const ns = "http://www.w3.org/2000/svg", s = document.createElementNS(ns, "svg"), p = document.createElementNS(ns, "path");
    s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true"); s.setAttribute("width", "18.75"); s.setAttribute("height", "18.75");
    p.setAttribute("d", ICON); p.setAttribute("fill", "currentColor"); s.append(p);
    return s;
  }

  async function saveAll(node, btn) {
    const { title, items, gallery } = PBQuickSites.postMedia(node);
    if (!items.length) { PBQuickToast.show("No pictures or videos were found in this post yet. Let it load, then try again.", { tone: "no" }); return; }
    btn.disabled = true;
    let ok = 0, last = "";
    for (const [index, t] of items.entries()) {
      const r = await PBQuickSave.start(t, { title, index, total: items.length, quiet: items.length > 1 });
      if (r.ok) ok++; else last = r.line;
    }
    btn.disabled = false;
    if (items.length > 1) PBQuickToast.show(ok === items.length ? `Saved all ${items.length} files${gallery ? " from the gallery" : ""}.` : `Saved ${ok} of ${items.length} files. ${last}`, { tone: ok === items.length ? "ok" : "no" });
  }

  function button(node, style) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "dc-dl " + style;
    const n = PBQuickSites.isReddit && node.querySelector("gallery-carousel") ? "Download all" : "Download";
    b.setAttribute("aria-label", n + " media"); b.title = n;
    b.append(svg());
    const stop = (e) => { e.stopPropagation(); };
    for (const ev of ["pointerdown", "mousedown", "pointerup", "mouseup"]) b.addEventListener(ev, stop);
    b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); saveAll(node, b).catch((x) => PBQuickToast.show(`Not saved: ${x.message}`, { tone: "no" })); });
    return b;
  }

  // X: a post with media gets the button at the end of its action row.
  function decorateX(article) {
    if (!article.querySelector('[data-testid="tweetPhoto"], [data-testid="videoPlayer"], [data-testid="videoComponent"], video')) return;
    const row = [...article.querySelectorAll('[role="group"]')].find((g) => g.querySelector('[data-testid="reply"], [data-testid="like"], [data-testid="unlike"]'));
    if (!row || row.querySelector(".dc-dl")) return;
    const cell = document.createElement("div");
    cell.className = "dc-dl-cell";
    cell.append(button(article, "dc-dl-x"));
    row.append(cell);
  }

  // Reddit: the corner of the post's media.
  function decorateReddit(post) {
    const box = post.querySelector('[slot="post-media-container"]') || post.querySelector("shreddit-player, shreddit-player-2, gallery-carousel");
    if (!box || box.querySelector(":scope > .dc-dl")) return;
    if (!PBQuickSites.postMedia(post).items.length) return;
    if (getComputedStyle(box).position === "static") box.style.position = "relative";
    box.append(button(post, "dc-dl-r"));
  }

  let queued = false;
  function scan() {
    queued = false;
    if (!on()) { for (const b of document.querySelectorAll(".dc-dl")) (b.closest(".dc-dl-cell") || b).remove(); return; }
    try {
      if (PBQuickSites.isX) for (const a of document.querySelectorAll('article[data-testid="tweet"]')) decorateX(a);
      else for (const p of document.querySelectorAll("shreddit-post")) decorateReddit(p);
    } catch (e) { console.warn("[daylight-commons] could not place a download button", e); }
  }
  const later = () => { if (!queued) { queued = true; requestAnimationFrame(() => setTimeout(scan, 50)); } };
  new MutationObserver(later).observe(document.documentElement, { childList: true, subtree: true });
  if (globalThis.PBSettings) { PBSettings.ready.then(later); PBSettings.onChange(later); }
  later();
  globalThis.PBQuickInline = Object.freeze({ scan, saveAll });
})();
