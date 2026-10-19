// Reads metadata out of the data YouTube's own web app has already downloaded for the page
// (ytInitialData, ytInitialPlayerResponse and its /youtubei/v1 responses), passed on by
// src/ext/ytsniff.js. Radar makes no request of its own. YouTube renames these structures often,
// so every field is optional and the walkers look for both the old and new comment shapes.

const txt = (v) => (!v ? null : typeof v === "string" ? v : v.simpleText || v.content || (Array.isArray(v.runs) ? v.runs.map((r) => r.text).join("") : null));
const clean = (s) => (s ? String(s).replace(/\s+/g, " ").trim() : null);
const compact = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== false && v !== ""));

function walk(json, visit, limit = 300000) {
  const stack = [json];
  let guard = 0;
  while (stack.length && guard++ < limit) {
    const v = stack.pop();
    if (!v || typeof v !== "object") continue;
    visit(v);
    for (const k in v) if (v[k] && typeof v[k] === "object") stack.push(v[k]);
  }
}

// All visible text inside a renderer, joined, for info panels whose layout varies.
function allText(node, cap = 400) {
  const parts = [];
  walk(node, (v) => { const t = v.simpleText || (Array.isArray(v.runs) ? v.runs.map((r) => r.text).join("") : null) || (typeof v.content === "string" ? v.content : null); if (t) parts.push(t); }, 2000);
  const s = clean([...new Set(parts)].join(" · "));
  return s ? s.slice(0, cap) : null;
}

// The video page: channel, subscribers, verification, context and funding panels, paid promotion.
export function ytVideoInfo(json) {
  const out = {};
  const panels = [];
  walk(json, (v) => {
    const o = v.videoOwnerRenderer;
    if (o) {
      out.channel = out.channel || clean(txt(o.title));
      out.subscribers = out.subscribers || clean(txt(o.subscriberCountText));
      out.channelUrl = out.channelUrl || ((((o.navigationEndpoint || {}).browseEndpoint) || {}).canonicalBaseUrl) || null;
      out.channelId = out.channelId || ((((o.navigationEndpoint || {}).browseEndpoint) || {}).browseId) || null;
      const badges = (o.badges || []).map((b) => (b.metadataBadgeRenderer || {}).tooltip || (b.metadataBadgeRenderer || {}).style).filter(Boolean);
      if (badges.length) out.channelBadges = [...new Set(badges)].join(", ");
    }
    for (const k of ["infoPanelContainerRenderer", "infoPanelContentRenderer", "clarificationRenderer", "emergencyOnebox"]) {
      if (v[k]) { const t = allText(v[k]); if (t && !panels.includes(t)) panels.push(t); }
    }
    // The uploader's own disclosure, shown by YouTube as "Altered or synthetic content".
    const said = typeof v.simpleText === "string" ? v.simpleText : typeof v.content === "string" ? v.content : null;
    if (said && /altered or synthetic content/i.test(said)) out.synthetic = clean(said).slice(0, 200);
    const paid = v.paidContentOverlay && v.paidContentOverlay.paidContentOverlayRenderer;
    if (paid) out.paidPromotion = clean(txt(paid.text)) || "Includes paid promotion";
    const cv = v.currentVideoEndpoint && v.currentVideoEndpoint.watchEndpoint;
    if (cv && cv.videoId) out.videoId = out.videoId || cv.videoId;
    const d = v.videoDetails;
    if (d && d.videoId) {
      out.videoId = d.videoId;
      out.views = d.viewCount ? Number(d.viewCount) : out.views;
      out.channel = out.channel || clean(d.author);
      out.channelId = out.channelId || d.channelId || null;
      if (d.isLiveContent) out.live = true;
    }
    const m = v.playerMicroformatRenderer;
    if (m) {
      out.published = out.published || m.publishDate || null;
      out.category = out.category || m.category || null;
      if (m.isFamilySafe === false) out.ageRestricted = true;
      if (Array.isArray(m.availableCountries) && m.availableCountries.length && m.availableCountries.length < 50) out.availableIn = m.availableCountries.length + " countries";
    }
  });
  if (panels.length) out.contextPanels = panels;
  const funded = panels.find((p) => /funded in whole or in part|public broadcast|government/i.test(p));
  if (funded) out.funding = funded;
  return Object.keys(out).length ? compact(out) : null;
}

// Comment authors: handle (lower case, no @) -> what YouTube loaded about them and the comment.
export function ytCommentAuthors(json) {
  const out = new Map();
  const put = (handle, r) => {
    const h = String(handle || "").replace(/^@/, "").trim().toLowerCase();
    if (h) out.set(h, { ...(out.get(h) || {}), ...compact(r) });
  };
  walk(json, (v) => {
    const e = v.commentEntityPayload;
    if (e && e.author) {
      const a = e.author, p = e.properties || {}, t = e.toolbar || {};
      const pub = clean(p.publishedTime);
      put(a.displayName, {
        channelId: a.channelId, verified: !!a.isVerified, creator: !!a.isCreator, artist: !!a.isArtist,
        member: a.sponsorBadgeA11y ? clean(a.sponsorBadgeA11y) : (a.sponsorBadgeUrl ? "channel member" : null),
        likes: clean(t.likeCountNotliked || t.likeCountA11y), replies: clean(t.replyCount),
        published: pub ? pub.replace(/\s*\(edited\)/, "") : null, edited: /\(edited\)/.test(pub || ""),
      });
    }
    const c = v.commentRenderer;
    if (c && c.authorText) {
      const pub = clean(txt(c.publishedTimeText));
      put(txt(c.authorText), {
        channelId: ((c.authorEndpoint || {}).browseEndpoint || {}).browseId,
        verified: !!(c.authorCommentBadge && /verified/i.test(JSON.stringify(c.authorCommentBadge))),
        creator: !!c.authorIsChannelOwner,
        member: c.sponsorCommentBadge ? clean(((c.sponsorCommentBadge.sponsorCommentBadgeRenderer || {}).tooltip)) || "channel member" : null,
        likes: clean(txt(c.voteCount)), replies: c.replyCount != null ? String(c.replyCount) : null,
        published: pub ? pub.replace(/\s*\(edited\)/, "") : null, edited: /\(edited\)/.test(pub || ""),
      });
    }
  });
  return out;
}
