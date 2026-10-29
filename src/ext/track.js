// Engagement over time (project-docs/ENGAGEMENT-SERIES.md), on the page. Reads the posts the page's
// own data already carries and hands them to the worker (track-bg.js), which keeps a reading only
// for posts the user saved, and logs every post only when the seen log is on. X: the post data
// sniff.js passes on. YouTube: the player data ytsniff.js passes on. Reddit: the attributes of each
// shreddit-post element. Saves call PBTrack.saved(meta) so the post is tracked. No request is made.
globalThis.PBTrack = globalThis.PBTrack || (() => {
  "use strict";
  const host = location.hostname.replace(/^www\./, "");
  const isX = /^(x|twitter)\.com$/.test(host), isYt = /(^|\.)youtube\.com$/.test(host), isReddit = /(^|\.)reddit\.com$/.test(host);
  const settings = () => (globalThis.PBSettings ? PBSettings.get() : {});
  const wanted = () => { const s = settings(); return !s.paused && !!(s.trackSeries || (s.seenLog && !s.protection)); };
  function send(msg) {
    try { chrome.runtime.sendMessage(msg).catch((e) => console.warn("[cmmns] the engagement series did not get a message", e)); }
    catch (e) { console.warn("[cmmns] the engagement series could not send", e); }
  }
  function report(list) {
    const sightings = (list || []).filter((s) => s && Object.keys(s.counts || {}).length);
    if (sightings.length && wanted()) send({ type: "pb-track-sightings", sightings });
  }
  const read = (what, f) => { try { report(f()); } catch (e) { console.warn(`[cmmns] could not read ${what} for the engagement series`, e); } };

  if (isX) {
    window.addEventListener("message", (e) => {
      if (e.source !== window || !e.data || (e.data.source !== "radar-sniff" && e.data.source !== "radar-sniff-replay")) return;
      if (wanted()) read("X's post data", () => PB.sightingsFromTweets(PB.tweetsIn(e.data.json)));
    });
    // What X loaded before this script started (sniff.js keeps the last few responses).
    window.postMessage({ source: "radar-sniff-replay-ask" }, location.origin);
  }
  if (isYt) window.addEventListener("message", (e) => {
    if (e.source === window && e.data && e.data.source === "radar-yt" && wanted()) read("YouTube's player data", () => [PB.sightingFromYt(e.data.json)]);
  });

  // Reddit draws each post as a shreddit-post element whose attributes carry its id and counts.
  // Read on load and after the page adds posts, each post at most once per 6 hours per page.
  const sent = new Map();
  function scanReddit() {
    if (!wanted()) return;
    const now = Date.now(), out = [];
    for (const p of document.querySelectorAll("shreddit-post[id]")) {
      const attrs = Object.fromEntries(["id", "author", "score", "comment-count", "created-timestamp", "domain"].map((k) => [k, p.getAttribute(k)]));
      const s = PB.sightingFromReddit(attrs), key = s && s.postId;
      if (!s || (sent.has(key) && now - sent.get(key) < PB.SERIES_GAP_MS)) continue;
      sent.set(key, now);
      out.push(s);
    }
    return out;
  }
  if (isReddit) {
    let timer = 0;
    const later = () => { clearTimeout(timer); timer = setTimeout(() => read("Reddit's post attributes", scanReddit), 2000); };
    new MutationObserver(later).observe(document.documentElement, { childList: true, subtree: true });
    later();
  }

  // A save: the post is tracked from now on, when Part 1 is on. Returns meta unchanged.
  function saved(meta) {
    if (meta && meta.postUrl && settings().trackSeries) {
      const { site, postUrl, author, postedAt, savedAt, engagement } = meta;
      send({ type: "pb-track-add", meta: { site, postUrl, author, postedAt, savedAt, engagement } });
    }
    return meta;
  }
  return Object.freeze({ saved });
})();
