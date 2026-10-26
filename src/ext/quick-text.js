// Text worth keeping without any picture: a text-only post on X or Reddit, or a selection on any page.
// "Save as note" writes a daylight.sidecar/1 note with kind "text" and no file: the whole text (or the
// selection), who wrote it, where and when, the quoted or parent post, the author's thread, link
// cards, hashtags and a poll as shown. "Save as card" also renders the words as a picture in the
// house type (src/core/media-card.js), marked as a Daylight rendering. Study files either under
// Daylight/study/. Copy with caption puts the words and the link on the clipboard. Read from the page
// only, on the click.
globalThis.PBQuickText = globalThis.PBQuickText || (() => {
  "use strict";
  const toast = (t, o) => PBQuickToast.show(t, o);
  const metaTag = (...names) => { for (const n of names) { const m = document.querySelector(`meta[property="${n}"], meta[name="${n}"]`); if (m && m.content) return m.content; } return null; };

  // The selection's words with the page's own description of itself.
  function selectionMeta(text) {
    const site = location.hostname.replace(/^www\./, "");
    return { site, kind: "text", selection: true, title: document.title || null, text, pageUrl: location.href,
      authorName: metaTag("author", "article:author", "twitter:creator"), postedAt: metaTag("article:published_time", "date", "datePublished") };
  }

  // The post under a point (or the element given), as a text note's raw record.
  function postMeta(el) {
    const node = globalThis.PBQuickSites && PBQuickSites.postOf(el);
    const m = node && PBQuickSites.postMetaOf(node);
    return m && (m.text || m.title) ? { ...m, kind: "text" } : null;
  }

  // What a text action works on: the selection when there is one, else the post under the point.
  function source({ at = null, selection = null } = {}) {
    const sel = String(selection || (getSelection && getSelection().toString()) || "").trim();
    if (sel.length >= 3) return selectionMeta(sel);
    const p = at || (globalThis.PBHover && PBHover.lastPoint());
    const el = p ? (PBQuickResolve.stackAt(p.x, p.y)[0] || null) : document.activeElement;
    return postMeta(el);
  }

  const nameFor = (meta, ext) => (meta.author.handle ? PB.metaName(meta, ext) : PB.downloadName({ title: meta.selection ? `${meta.title || meta.site} selection` : meta.title || meta.site, ext }));

  // Saves raw as a note (and, with card, as a picture too). opts: { study, card }.
  async function save(raw, { study = false, card = false } = {}) {
    const meta = PB.postMeta({ ...raw, study }), name = nameFor(meta, "md");
    await PBQuickSave.saveText(new TextEncoder().encode(PB.sidecarMarkdown(meta, [])), "text/markdown", name, meta.site, study);
    let line = `Saved ${study ? "for study" : "the text"}: ${name}`;
    if (card) {
      const png = nameFor(meta, "png");
      const r = await chrome.runtime.sendMessage({ type: "pb-card", meta, filename: png, site: meta.site, study });
      if (!r || r.error) throw new Error(r && r.error ? r.error : "The card could not be made.");
      line += ` and ${png}`;
    }
    if (study) PBQuickSave.noteAfterText(meta, name); else toast(line, { tone: "ok" });
    return { ok: true, line, name, meta };
  }

  async function caption(raw) {
    const meta = PB.postMeta(raw), text = PB.captionText(meta, meta.postUrl || meta.pageUrl);
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement("textarea"); ta.value = text; ta.style.cssText = "position:fixed;left:-9999px"; document.documentElement.append(ta); ta.select(); document.execCommand("copy"); ta.remove();
    }
    toast("Copied the words and the link.", { tone: "ok" });
    return { ok: true, text };
  }

  // From the right-click menu, the hover control and the post buttons. action: note | study | card | caption.
  async function run(action, info = {}) {
    const raw = info.raw || source(info);
    if (!raw) { toast("Select some text, or point at a post, then try again.", { tone: "no" }); return { ok: false }; }
    try {
      if (action === "caption") return await caption(raw);
      return await save(raw, { study: action === "study", card: action === "card" });
    } catch (e) {
      console.warn("[daylight-commons] could not save the text", e);
      toast(`Not saved: ${e.message}`, { tone: "no" });
      return { ok: false, line: e.message };
    }
  }

  return Object.freeze({ run, source, selectionMeta, postMeta });
})();
