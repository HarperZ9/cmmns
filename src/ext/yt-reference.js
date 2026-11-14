// YouTube: "Save reference" and "Copy link at this time". CMMNS does not download YouTube
// video in any store build. A reference keeps what the watch page shows in the clear: title,
// channel, the address at the current time, description, chapters, the transcript when its panel
// is open, and the thumbnail, saved as the thumbnail image with a daylight.sidecar/1 note beside it.
// Read from the page only; nothing is fetched for it except the thumbnail the page already shows.
globalThis.PBYouTube = globalThis.PBYouTube || (() => {
  "use strict";
  const isYouTube = /(^|\.)youtube\.com$/.test(location.hostname);
  const txt = (el) => (el && el.innerText ? el.innerText.replace(/\n{3,}/g, "\n\n").trim() || null : null);
  const q = (s) => document.querySelector(s);

  // The video's own record from the page data ytsniff.js passes on (videoDetails): the whole
  // description, which the page shows cut short behind "...more". Kept for the last few videos.
  const details = new Map();
  function remember(json) {
    const stack = [json];
    for (let n = 0; stack.length && n < 50000; n++) {
      const v = stack.pop();
      if (!v || typeof v !== "object") continue;
      const d = v.videoDetails;
      if (d && d.videoId) {
        const micro = (v.microformat && v.microformat.playerMicroformatRenderer) || {}, was = details.get(d.videoId) || {};
        const tracks = v.captions ? PB.captionTracks(v.captions) : [];
        details.delete(d.videoId);
        details.set(d.videoId, { title: d.title || was.title || null, author: d.author || was.author || null, description: d.shortDescription || was.description || null,
          published: micro.publishDate || micro.uploadDate || was.published || null, captions: tracks.length ? tracks : was.captions || [], captionsRead: !!v.captions || !!was.captionsRead });
        while (details.size > 20) details.delete(details.keys().next().value);
      }
      for (const k in v) if (v[k] && typeof v[k] === "object") stack.push(v[k]);
    }
  }
  if (isYouTube) {
    window.addEventListener("message", (e) => { if (e.source === window && e.data && e.data.source === "radar-yt") { try { remember(e.data.json); } catch { /* the page's own data, read as it is */ } } });
    // Asked at the start, and again each time YouTube swaps the video without a reload (its own
    // navigation events, and the player loading new media), so the record is the current video's.
    const ask = () => window.postMessage({ source: "radar-yt-ask" }, location.origin);
    ask();
    const on = (ev, fn, capture) => { if (document.addEventListener) document.addEventListener(ev, fn, capture); };
    for (const ev of ["yt-navigate-finish", "yt-page-data-updated"]) on(ev, () => setTimeout(ask, 50), false);
    on("loadeddata", ask, true);
  }

  // The description as the page draws it ends with its own "more" control when it is cut short.
  const MORE = /(?:\.\.\.|…)\s*more\s*$/i;
  const MEDIA_FILE = "not saved (YouTube plays this video as a segmented stream, with no plain file address; this reference keeps the thumbnail, the description, the chapters and the caption list)";

  function videoId() {
    try { const u = new URL(location.href); return u.searchParams.get("v") || (/^\/(shorts|live)\/([\w-]{6,})/.exec(u.pathname) || [])[2] || null; } catch { return null; }
  }
  const nowSeconds = () => { const v = q("video.html5-main-video, #movie_player video, video"); return v && Number.isFinite(v.currentTime) ? Math.floor(v.currentTime) : 0; };

  // The watch address at the current time (t=), without playlist or tracking parameters.
  function linkAtTime() {
    const id = videoId();
    if (!id) return location.href;
    const t = nowSeconds();
    return `https://www.youtube.com/watch?v=${id}${t ? `&t=${t}s` : ""}`;
  }

  // YouTube swaps videos without reloading the page, and the previous video's chapter list can stay
  // in it. Each chapter links to its own video, so keep only the ones that link to this video;
  // markers with no link are read only when none carries one.
  const markerVideo = (r) => { const a = r.querySelector("a[href*='v=']"); return (a && (/[?&]v=([\w-]{6,})/.exec(a.getAttribute("href") || "") || [])[1]) || null; };
  function chapters() {
    const id = videoId(), all = [...document.querySelectorAll("ytd-macro-markers-list-item-renderer")];
    const mine = all.some(markerVideo) ? all.filter((r) => markerVideo(r) === id) : all;
    return mine.map((r) => {
      const time = txt(r.querySelector("#time")), title = txt(r.querySelector("h4, #details h4, .macro-markers"));
      return time && title ? `${time} ${title}` : null;
    }).filter(Boolean).filter((x, i, all) => all.indexOf(x) === i);
  }
  function transcript() {
    return [...document.querySelectorAll("ytd-transcript-segment-renderer")].map((s) => {
      const time = txt(s.querySelector(".segment-timestamp")), words = txt(s.querySelector(".segment-text"));
      return words ? `${time ? time + " " : ""}${words}` : null;
    }).filter(Boolean);
  }

  // The raw record for postMeta (src/core/media-meta.js) and the thumbnail target for the download.
  function reference() {
    const id = videoId();
    const owner = q("ytd-watch-metadata ytd-channel-name a, #owner ytd-channel-name a, ytd-video-owner-renderer a.yt-simple-endpoint");
    const handle = owner ? (/\/(@[\w.-]+)/.exec(owner.getAttribute("href") || "") || [])[1] || null : null;
    const known = id ? details.get(id) : null;
    const shown = txt(q("ytd-watch-metadata #description-inline-expander, #description-inline-expander, ytd-text-inline-expander #snippet"));
    const desc = (known && known.description) || (shown ? shown.replace(MORE, "…").trim() : shown);
    // The page's date tags are written once, for the video the page first loaded: used only for that video.
    const tagged = (q('meta[itemprop="identifier"], meta[itemprop="videoId"]') || {}).content || null;
    const date = (known && known.published) || (tagged === id ? (q('meta[itemprop="datePublished"], meta[itemprop="uploadDate"]') || {}).content || null : null);
    const tracks = (known && known.captions) || [];
    const notes = [];
    const ch = chapters(), tr = transcript();
    if (ch.length) notes.push({ label: "Chapters", text: ch.join("\n") });
    if (tr.length) notes.push({ label: "Transcript (as the page showed it)", text: tr.join("\n") });
    if (tracks.length) notes.push({ label: "Caption tracks the page lists", text: PB.captionTrackLines(tracks).join("\n") });
    else if (known && known.captionsRead === false) notes.push({ label: "Caption tracks the page lists", text: "The page's data lists no caption track for this video." });
    const title = txt(q("ytd-watch-metadata h1, h1.ytd-video-primary-info-renderer")) || document.title.replace(/ - YouTube$/, "");
    const meta = { site: "youtube", title: (known && known.title) || title, text: desc, authorName: (known && known.author) || (owner ? txt(owner) : null), handle: handle ? handle.slice(1) : null,
      postUrl: linkAtTime(), postedAt: date, notes, textComplete: !!(known && known.description) || !MORE.test(shown || ""), mediaFile: MEDIA_FILE };
    const thumb = id ? `https://i.ytimg.com/vi/${id}/maxresdefault.jpg` : null;
    return { kind: "image", url: thumb, alternatives: id ? [`https://i.ytimg.com/vi/${id}/hqdefault.jpg`] : [], meta, title };
  }

  async function saveReference() {
    if (!videoId()) { PBQuickToast.show("Open a video's own page to save a reference to it.", { tone: "no" }); return { ok: false }; }
    return PBQuickSave.start(reference(), { title: reference().title });
  }

  async function copyLink() {
    const link = linkAtTime();
    try { await navigator.clipboard.writeText(link); PBQuickToast.show("Copied the video's address at this time.", { tone: "ok" }); return { ok: true, text: link }; }
    catch (e) { PBQuickToast.show(`Not copied: ${e.message}`, { tone: "no" }); return { ok: false }; }
  }

  return Object.freeze({ isYouTube, reference, saveReference, copyLink, linkAtTime, videoId, chapters });
})();
