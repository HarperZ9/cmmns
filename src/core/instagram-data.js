// Instagram's own record of a post, from the data the page already received: the JSON Instagram embeds
// in its pages (script type="application/json") and the answers to the page's own requests, which
// src/ext/igsniff.js passes on. A post (media item) carries its caption, its time, every carousel item
// at each size Instagram offers, its videos, the alt text Instagram wrote or the author gave, and its
// counts; comments arrive in their own answers. Read as Instagram sends it; nothing here makes a request.
// The shapes are the ones Instagram's web app used when this was written; a field it stops sending
// leaves that part empty, never guessed.

const iso = (sec) => (Number.isFinite(Number(sec)) && Number(sec) > 0 ? new Date(Number(sec) * (Number(sec) < 1e11 ? 1000 : 1)).toISOString() : null);
const num = (v) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const name = (u) => (u && typeof u === "object" && typeof u.username === "string" ? u.username : null);

// The largest of a list of { url, width, height }.
export function igBest(list) {
  const ok = (list || []).filter((c) => c && typeof c.url === "string" && /^https:/.test(c.url));
  return ok.sort((a, b) => (b.width || 0) * (b.height || 0) - (a.width || 0) * (a.height || 0))[0] || null;
}

function mediaOf(m) {
  const pic = igBest(((m.image_versions2 || {}).candidates) || []), vid = igBest(m.video_versions || []);
  const alt = typeof m.accessibility_caption === "string" && m.accessibility_caption.trim() ? m.accessibility_caption : null;
  const base = { id: m.pk != null ? String(m.pk) : m.id ? String(m.id) : null, alt, width: num((vid || pic || {}).width) || num(m.original_width), height: num((vid || pic || {}).height) || num(m.original_height) };
  return vid ? { ...base, kind: "video", url: vid.url, poster: pic ? pic.url : null } : pic ? { ...base, kind: "image", url: pic.url, poster: null } : null;
}

const isItem = (v) => v && typeof v.code === "string" && /^[\w-]{5,40}$/.test(v.code) && (v.image_versions2 || v.carousel_media || v.video_versions) && (v.taken_at != null || v.user || v.owner);

// One post's record. media: every item in order (a carousel's children, else the post itself).
export function igItem(v) {
  const user = v.user || v.owner || {}, cap = v.caption && typeof v.caption === "object" ? v.caption : null;
  const kids = Array.isArray(v.carousel_media) && v.carousel_media.length ? v.carousel_media : [v];
  const reel = v.product_type === "clips" || (v.media_type === 2 && v.product_type !== "feed");
  return {
    shortcode: v.code, id: v.pk != null ? String(v.pk) : v.id ? String(v.id).split("_")[0] : null,
    url: `https://www.instagram.com/${reel ? "reel" : "p"}/${v.code}/`,
    handle: name(user), authorName: typeof user.full_name === "string" && user.full_name ? user.full_name : null,
    caption: cap && typeof cap.text === "string" ? cap.text : typeof v.caption === "string" ? v.caption : null,
    edited: v.caption_is_edited === true || (cap && cap.is_edited === true) ? true : null,
    postedAt: iso(v.taken_at), likes: num(v.like_count), comments: num(v.comment_count), plays: num(v.play_count ?? v.ig_play_count ?? v.view_count),
    location: v.location && typeof v.location.name === "string" ? v.location.name : null,
    coauthors: (v.coauthor_producers || []).map(name).filter(Boolean), tagged: (((v.usertags || {}).in) || []).map((t) => name(t && t.user)).filter(Boolean),
    productType: typeof v.product_type === "string" ? v.product_type : null, media: kids.map(mediaOf).filter(Boolean),
  };
}

// Every post in one answer, by shortcode. A post seen in pieces keeps each piece's fields.
export function igItemsIn(json, max = 200000) {
  const out = new Map(), stack = [json];
  for (let n = 0; stack.length && n < max; n++) {
    const v = stack.pop();
    if (!v || typeof v !== "object") continue;
    if (!Array.isArray(v) && isItem(v)) {
      const it = igItem(v), had = out.get(it.shortcode);
      out.set(it.shortcode, had ? { ...had, ...Object.fromEntries(Object.entries(it).filter(([, x]) => x != null && !(Array.isArray(x) && !x.length))) } : it);
      continue;   // a post's own comments are read by igCommentsIn
    }
    for (const k in v) if (v[k] && typeof v[k] === "object") stack.push(v[k]);
  }
  return [...out.values()];
}

const isComment = (v) => v && typeof v.text === "string" && name(v.user) && (v.pk != null || v.id != null) && (v.created_at != null || v.created_at_utc != null);

// Every comment in one answer: objects with words, an author and a time, found under a key that
// names comments (comments, preview_comments, child_comments, a comments connection's edges). A
// reply's parent is its parent_comment_id, else the comment it sits under. mediaId when Instagram
// says which post it belongs to.
export function igCommentsIn(json, max = 200000) {
  const out = new Map(), stack = [[json, false, null, null]];
  for (let n = 0; stack.length && n < max; n++) {
    const [v, under, parent, media] = stack.pop();
    if (!v || typeof v !== "object") continue;
    let here = parent, mid = media;
    if (!Array.isArray(v) && v.media_id != null && !isComment(v)) mid = String(v.media_id);
    if (!Array.isArray(v) && under && isComment(v)) {
      const id = String(v.pk ?? v.id);
      out.set(id, { id, parent: v.parent_comment_id != null ? String(v.parent_comment_id) : parent, author: v.user.username, text: v.text,
        score: num(v.comment_like_count), postedAt: iso(v.created_at ?? v.created_at_utc), replies: num(v.child_comment_count), mediaId: v.media_id != null ? String(v.media_id) : mid });
      here = id;
    }
    // Pushed last key first, so comments come out in the order Instagram listed them.
    for (const k of Object.keys(v).reverse()) {
      if (!v[k] || typeof v[k] !== "object") continue;
      const c = under || (/comment/i.test(k) && !/count|disabled|enabled|setting/i.test(k));
      // Inside a comment, only its replies are other comments; its user and such are not.
      if (here !== parent && !/child_comments|replies|comments/i.test(k)) continue;
      stack.push([v[k], c, here, mid]);
    }
  }
  return [...out.values()];
}

// The raw record postMeta (src/core/media-meta.js) reads, for one post.
export function igPostMeta(it) {
  const fields = Object.fromEntries(Object.entries({ product_type: it.productType, location: it.location, coauthors: it.coauthors.length ? it.coauthors : null, tagged: it.tagged.length ? it.tagged : null, edited: it.edited })
    .filter(([, v]) => v != null));
  const engagement = Object.fromEntries(Object.entries({ likes: it.likes, comments: it.comments, plays: it.plays }).filter(([, v]) => v != null));
  return { site: "instagram", text: it.caption, handle: it.handle, authorName: it.authorName, postUrl: it.url, postedAt: it.postedAt, edited: it.edited, location: it.location,
    engagement: Object.keys(engagement).length ? engagement : null, fields, items: it.media.map((m, i) => ({ index: i + 1, kind: m.kind, url: m.url, alt: m.alt, width: m.width, height: m.height })) };
}

// The shortcode in an Instagram address ("/p/<code>/", "/reel/<code>/", "/tv/<code>/").
export const igShortcode = (path) => (/\/(?:p|reel|reels|tv)\/([\w-]{5,40})(?:[/?#]|$)/.exec(String(path || "")) || [])[1] || null;
