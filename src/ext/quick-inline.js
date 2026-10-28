// A Download button on X and Reddit posts with pictures, videos or GIFs. On X it sits in the post's
// own row of actions (reply, repost, like) and looks like them; on Reddit it sits in the corner of
// the post's media. One click saves every file in the post: all pictures of a gallery, each video
// with its sound; on a post's own page, the author's thread below it too. Buttons are added once
// per post and again as the site redraws or scrolls; they stop the click there, so the site never
// opens the post by accident. Turned off in the settings.
(() => {
  "use strict";
  if (!globalThis.PBQuickSites || !(PBQuickSites.isX || PBQuickSites.isReddit)) return;
  const MARK = "data-dc-dl";
  // Buttons left by a script from before an update can no longer save; this script draws its own.
  for (const old of document.querySelectorAll(".dc-dl")) (old.closest(".dc-dl-cell") || old).remove();
  const STUDY = "M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v15.2a.6.6 0 0 1-.92.5L12 17.3l-5.58 3.4a.6.6 0 0 1-.92-.5V5A1.5 1.5 0 0 1 7 3.5zm.5 2v12.9l4.5-2.74 4.5 2.74V5.5h-9z";
  const ICON = "M12 3.5a1 1 0 0 1 1 1v8.09l2.8-2.8a1 1 0 1 1 1.4 1.42l-4.5 4.5a1 1 0 0 1-1.4 0l-4.5-4.5a1 1 0 0 1 1.4-1.42l2.8 2.8V4.5a1 1 0 0 1 1-1zM5 18.5a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1z";
  const on = () => !globalThis.PBSettings || PBSettings.get().mediaButtons !== false;

  function svg(d = ICON) {
    const ns = "http://www.w3.org/2000/svg", s = document.createElementNS(ns, "svg"), p = document.createElementNS(ns, "path");
    s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true"); s.setAttribute("width", "18.75"); s.setAttribute("height", "18.75");
    p.setAttribute("d", d); p.setAttribute("fill", "currentColor"); s.append(p);
    return s;
  }

  async function saveAll(node, btn, study = false) {
    const { title, items, gallery, thread } = PBQuickSites.postMedia(node);
    // A text post (or a thread of them): one note with the whole text, every part in order.
    if (!items.length) {
      const raw = PBQuickSites.postMetaOf(node);
      if (raw && (raw.text || raw.title)) { btn.disabled = true; await PBQuickText.run(study ? "study" : "note", { raw: { ...raw, kind: "text" } }); btn.disabled = false; return; }
      PBQuickToast.show("Nothing to save in this post yet. Let it load, then try again.", { tone: "no" });
      return;
    }
    btn.disabled = true;
    let ok = 0, last = "", already = 0, meta = null;
    const names = [], many = items.length > 1;
    for (const [index, t] of items.entries()) {
      const r = await PBQuickSave.start(t, { title, index, total: items.length, quiet: many, oneSidecar: many, study });
      if (r.ok) ok++; else last = r.line;
      if (r.already) already++;
      if (r.names) names.push(...r.names);
      meta = meta || r.meta || null;
    }
    // One sidecar for the whole post, listing every file in order.
    if (many && meta) await PBQuickSave.postSidecar(meta, names).catch((e) => console.warn("[cmmns] could not write the post's sidecar", e));
    btn.disabled = false;
    const was = already ? ` ${already} ${already === 1 ? "was" : "were"} already saved.` : "";
    if (many) PBQuickToast.show(ok === items.length ? `Saved all ${items.length} files${gallery ? " from the gallery" : thread ? " from the thread" : ""}.${was}` : `Saved ${ok} of ${items.length} files. ${last}`, { tone: ok === items.length ? "ok" : "no" });
  }

  // Download, or Study (the same save, kept apart for study later) when study is true.
  function button(node, style, study = false) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "dc-dl " + style + (study ? " dc-study" : "");
    const text = !PBQuickSites.postMedia(node).items.length;
    const n = study ? "Study" : text ? "Save as note" : PBQuickSites.isReddit && node.querySelector("gallery-carousel") ? "Download all" : "Download";
    b.setAttribute("aria-label", study ? "Save this post for study" : text ? "Save this post's text as a note" : n + " media"); b.title = n;
    b.append(svg(study ? STUDY : ICON));
    const stop = (e) => { e.stopPropagation(); };
    for (const ev of ["pointerdown", "mousedown", "pointerup", "mouseup"]) b.addEventListener(ev, stop);
    b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); saveAll(node, b, study).catch((x) => PBQuickToast.show(`Not saved: ${x.message}`, { tone: "no" })); });
    return b;
  }

  // X: a post with media gets the button at the end of its action row. Signed out, X draws posts
  // with no action row, so the button goes in the corner of the post's first picture or video.
  const xMedia = (article) => [...article.querySelectorAll('img[src*="pbs.twimg.com/media/"], img[src*="pbs.twimg.com/tweet_video_thumb/"], video')]
    .filter((m) => m.closest("article") === article);
  function decorateX(article) {
    const media = xMedia(article);
    if (article.querySelector(".dc-dl")) return;
    if (!media.length && !article.querySelector('[data-testid="tweetText"], div[lang], div.whitespace-pre-wrap')) return;
    const row = [...article.querySelectorAll('[role="group"]')].find((g) => g.querySelector('[data-testid="reply"], [data-testid="like"], [data-testid="unlike"]'));
    if (row) {
      const cell = document.createElement("div");
      cell.className = "dc-dl-cell";
      cell.append(button(article, "dc-dl-x"), button(article, "dc-dl-x", true));
      row.append(cell);
      return;
    }
    if (!media.length) { corner(article, article, " dc-bottom"); return; }   // a text post, signed out: its lower corner
    const box = overlayOf(media[0]);
    if (box) corner(box, article);
  }

  // Where the corner button goes: X lays a clear link over each picture, so the button goes inside
  // that layer to stay clickable; otherwise beside the media. Decided once the media is on screen.
  function overlayOf(m) {
    const r = m.getBoundingClientRect();
    if (r.width < 40 || r.height < 40 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return null;
    const x = Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1), y = Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1);
    const top = document.elementFromPoint(x, y);
    if (top && top !== m && !top.contains(m) && top.closest("article") === m.closest("article")) {
      const t = top.getBoundingClientRect();
      if (t.width >= r.width * 0.8 && t.height >= r.height * 0.8 && getComputedStyle(top).position !== "static") return top;
    }
    return m.parentElement;
  }

  function corner(box, node, where = "") {
    if (!box || box.querySelector(":scope > .dc-dl")) return;
    if (getComputedStyle(box).position === "static") box.style.position = "relative";
    box.append(button(node, "dc-dl-r" + where), button(node, "dc-dl-r" + where, true));
  }

  // Reddit: the corner of the post's media.
  function decorateReddit(post) {
    const media = post.querySelector('[slot="post-media-container"]') || post.querySelector("shreddit-player, shreddit-player-2, gallery-carousel");
    const box = media && PBQuickSites.postMedia(post).items.length ? media : post.querySelector('[slot="text-body"]');
    if (!box || box.querySelector(":scope > .dc-dl")) return;
    corner(box, post, box === media ? "" : " dc-bottom");
  }

  let queued = false;
  function scan() {
    queued = false;
    if (!on()) { for (const b of document.querySelectorAll(".dc-dl")) (b.closest(".dc-dl-cell") || b).remove(); return; }
    try {
      if (PBQuickSites.isX) for (const a of document.querySelectorAll("article")) decorateX(a);
      else for (const p of document.querySelectorAll("shreddit-post")) decorateReddit(p);
    } catch (e) { console.warn("[cmmns] could not place a download button", e); }
  }
  const later = () => { if (!queued) { queued = true; requestAnimationFrame(() => setTimeout(scan, 50)); } };
  new MutationObserver(later).observe(document.documentElement, { childList: true, subtree: true });
  if (globalThis.PBSettings) { PBSettings.ready.then(later); PBSettings.onChange(later); }
  later();
  globalThis.PBQuickInline = Object.freeze({ scan, saveAll });
})();
