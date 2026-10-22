// Reads account metadata out of the data X's own web app has already downloaded for the page (its
// GraphQL responses). Radar makes no request of its own for this: src/ext/sniff.js passes copies of
// X's responses to the content script, and this module walks them for User objects.
// X has moved fields between `legacy` and `core` over time, so both places are read.

const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

// "Wed May 02 12:00:00 +0000 2007" -> "2007-05-02"
export function parseXDate(s) {
  const m = String(s || "").match(/^\w{3} (\w{3}) (\d{2}) [\d:]{8} [+-]\d{4} (\d{4})$/);
  if (m && m[1] in MONTHS) return new Date(Date.UTC(+m[3], MONTHS[m[1]], +m[2])).toISOString().slice(0, 10);
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null;
}

const pick = (...vals) => vals.find((v) => v !== undefined && v !== null && v !== "") ?? null;
const n = (v) => (Number.isFinite(v) ? v : null);

// One X User object -> Radar's reading (only the fields that are present).
export function userReading(u) {
  const L = u.legacy || {}, C = u.core || {}, A = u.about_profile || {};
  const handle = pick(C.screen_name, L.screen_name);
  if (!handle) return null;
  const url = (((L.entities || {}).url || {}).urls || [])[0];
  const r = {
    handle,
    display: pick(C.name, L.name),
    joinDate: parseXDate(pick(C.created_at, L.created_at)),
    profileLocation: pick((u.location || {}).location, L.location),
    bio: pick(((u.profile_bio || {}).description), L.description),
    website: pick(url && url.expanded_url, url && url.display_url),
    followersCount: n(L.followers_count),
    followingCount: n(L.friends_count),
    postsCount: n(L.statuses_count),
    verifiedType: pick(L.verified_type, (u.verification || {}).verified_type, u.is_blue_verified || (u.verification || {}).is_blue_verified ? "Blue" : null),
    category: pick((((u.professional || {}).category || [])[0] || {}).name),
    affiliate: pick((((u.affiliates_highlighted_label || {}).label) || {}).description),
    xLabel: pick(u.parody_commentary_fan_label && u.parody_commentary_fan_label !== "None" ? u.parody_commentary_fan_label : null),
    defaultAvatar: L.default_profile_image === true || /default_profile_images/.test(pick((u.avatar || {}).image_url, L.profile_image_url_https) || "") ? true : null,
    listedCount: n(L.listed_count),
    likesCount: n(L.favourites_count),
    mediaCount: n(L.media_count),
    withheldIn: Array.isArray(L.withheld_in_countries) && L.withheld_in_countries.length ? L.withheld_in_countries.join(", ") : null,
    // X's own disclosures about how the account operates. Payment and tip-jar handles are left
    // out on purpose: they identify people, and Radar describes accounts.
    identityVerified: ((u.verification_info || {}).is_identity_verified === true) ? true : null,
    verifiedReason: pick((((((u.verification_info || {}).reason || {}).description) || {}).text)),
    professionalType: pick((u.professional || {}).professional_type),
    squareAvatar: (u.profile_image_shape || (u.avatar || {}).image_shape) === "Square" ? true : null,
    pinnedPost: pick(((L.pinned_tweet_ids_str || [])[0])),
    affiliatesCount: n(((u.business_account || {}).affiliates_count)),
    creatorSubscriptions: n(u.creator_subscriptions_count),
    protected: L.protected === true || (u.privacy || {}).protected === true ? true : null,
    // Present only when X includes its "About this account" block in the response.
    basedIn: pick(A.account_based_in),
    connectedVia: pick(A.source),
    nameChanges: n(Number(A.username_changes && A.username_changes.count)),
    fromPage: true,
  };
  return Object.fromEntries(Object.entries(r).filter(([, v]) => v !== null && v !== undefined));
}

// The "About this account" block anywhere in a response (X's AboutAccountQuery), as Radar's
// fields, or null. location_accurate false means X suspects a VPN or proxy.
export function aboutIn(json) {
  const stack = [json];
  let guard = 0;
  while (stack.length && guard++ < 50000) {
    const v = stack.pop();
    if (!v || typeof v !== "object") continue;
    if (v.about_profile && typeof v.about_profile === "object") {
      const A = v.about_profile;
      const r = {
        basedIn: pick(A.account_based_in),
        connectedVia: pick(A.source),
        nameChanges: n(Number(A.username_changes && A.username_changes.count)),
        proxyNote: A.location_accurate === false ? true : null,
        affiliate: pick(A.affiliate_username),
        aboutRead: true,
      };
      return Object.fromEntries(Object.entries(r).filter(([, x]) => x !== null && x !== undefined));
    }
    for (const k in v) if (v[k] && typeof v[k] === "object") stack.push(v[k]);
  }
  return null;
}

// Walks any JSON value and returns one reading per distinct account found.
export function usersIn(json) {
  const out = new Map(), stack = [json];
  let guard = 0;
  while (stack.length && guard++ < 200000) {
    const v = stack.pop();
    if (!v || typeof v !== "object") continue;
    if (v.__typename === "User" && (v.legacy || v.core)) {
      const r = userReading(v);
      if (r) out.set(r.handle.toLowerCase(), { ...(out.get(r.handle.toLowerCase()) || {}), ...r });
    }
    for (const k in v) if (v[k] && typeof v[k] === "object") stack.push(v[k]);
  }
  return [...out.values()];
}

// Post-level metadata X loads with each post but does not show on the page: the app it was posted
// from, X's detected language, views, edits and whether a Community Note is attached.
export function tweetsIn(json) {
  const out = new Map(), stack = [json];
  let guard = 0;
  while (stack.length && guard++ < 200000) {
    const v = stack.pop();
    if (!v || typeof v !== "object") continue;
    if (v.__typename === "Tweet" && v.rest_id && v.legacy) {
      const L = v.legacy, edits = ((v.edit_control || {}).edit_tweet_ids || []).length;
      const r = {
        id: v.rest_id,
        client: v.source ? String(v.source).replace(/<[^>]*>/g, "").trim() || null : null,
        lang: L.lang && L.lang !== "und" && L.lang !== "zxx" ? L.lang : null,
        views: v.views && v.views.count ? Number(v.views.count) : null,
        edits: edits > 1 ? edits - 1 : null,
        note: v.birdwatch_pivot ? pick((v.birdwatch_pivot.subtitle || {}).text, v.birdwatch_pivot.shorttitle, v.birdwatch_pivot.title, "a Community Note is attached") : null,
        noteId: v.birdwatch_pivot ? noteIdOf(v.birdwatch_pivot) : null,
        posted: Number.isFinite(Date.parse(L.created_at)) ? new Date(Date.parse(L.created_at)).toISOString() : null,
        media: mediaOf(L),
        // the trail: who wrote it, what it quotes, reposts or answers, and where its links go
        author: authorOf(v),
        quotedId: L.quoted_status_id_str || pick((((v.quoted_status_result || {}).result) || {}).rest_id) || null,
        repostOf: pick(((((L.retweeted_status_result || {}).result) || {}).rest_id)) || null,
        replyTo: L.in_reply_to_status_id_str || null,
        replyToHandle: L.in_reply_to_screen_name || null,
        links: ((L.entities || {}).urls || []).map((u) => u.expanded_url).filter((u) => u && !/^https?:\/\/(x|twitter)\.com\//.test(u)),
        quotes: n(L.quote_count), reposts: n(L.retweet_count), likes: n(L.favorite_count), replies: n(L.reply_count), bookmarks: n(L.bookmark_count),
      };
      out.set(r.id, Object.fromEntries(Object.entries(r).filter(([, x]) => x !== null && x !== undefined && !(Array.isArray(x) && !x.length))));
    }
    for (const k in v) if (v[k] && typeof v[k] === "object") stack.push(v[k]);
  }
  return [...out.values()];
}

// The author of a Tweet object, from its embedded user (legacy or core fields).
function authorOf(v) {
  const u = ((v.core || {}).user_results || {}).result;
  if (!u) return null;
  return pick((u.core || {}).screen_name, (u.legacy || {}).screen_name);
}

// The note's own id, from the note object or the link to it ("/i/birdwatch/n/<id>"). Note ids are
// snowflakes like post ids, so the id says when the note was written.
function noteIdOf(b) {
  const id = pick(((b.note || {}).rest_id), (String(b.destinationUrl || "").match(/\/birdwatch\/n\/(\d+)/) || [])[1]);
  return id && /^\d{10,20}$/.test(id) ? id : null;
}

// When a Community Note was written, against the post and now: { written, afterPost, age, text }
// in seconds, or null. The page data says when the note was written, not when X began showing it,
// which comes later, once enough raters from different viewpoints agree.
export function noteTiming(tweet, now = Date.now()) {
  if (!tweet || !tweet.noteId) return null;
  const written = snowflakeTime(tweet.noteId), w = Date.parse(written), p = Date.parse(tweet.posted);
  if (!Number.isFinite(w)) return null;
  const afterPost = Number.isFinite(p) ? Math.max(0, Math.round((w - p) / 1000)) : null, age = Math.max(0, Math.round((now - w) / 1000));
  const text = (afterPost != null ? `Note written ${span(afterPost)} after the post, ${span(age)} ago.` : `Note written ${span(age)} ago.`)
    + " The page does not say when X began to show it.";
  return { written, afterPost, age, text };
}

function span(sec) {
  if (sec < 3600) return `${Math.max(1, Math.round(sec / 60))} min`;
  if (sec < 48 * 3600) return `${Math.round(sec / 3600)} h`;
  return `${Math.round(sec / 86400)} days`;
}

// X ids are "snowflakes": the top bits are milliseconds since 2010-11-04. A media id therefore
// says when the image or video was first uploaded, whichever post now shows it.
export function snowflakeTime(id) {
  try { return new Date(Number(BigInt(String(id)) >> 22n) + 1288834974657).toISOString(); } catch { return null; }
}

// Media attached to a post: type, when it was first uploaded, and the earlier post it was taken
// from when X records one ("From @someone" on the page).
function mediaOf(L) {
  const list = ((L.extended_entities || L.entities || {}).media) || [];
  const out = list.filter((m) => m && m.id_str).map((m) => ({
    type: m.type || "photo", url: m.media_url_https || null, uploaded: snowflakeTime(m.id_str),
    fromPost: m.source_status_id_str || null, fromPostTime: m.source_status_id_str ? snowflakeTime(m.source_status_id_str) : null,
  }));
  return out.length ? out : null;
}

// Media uploaded well before the post that shows it: [{ type, uploaded, days, fromPost }].
export const OLD_MEDIA_DAYS = 2;
export function olderMedia(tweet) {
  const t = Date.parse(tweet && tweet.posted);
  if (!Number.isFinite(t)) return [];
  return ((tweet && tweet.media) || []).map((m) => ({ ...m, days: Math.floor((t - Date.parse(m.uploaded)) / 86400000) })).filter((m) => m.days >= OLD_MEDIA_DAYS);
}

// Apps people commonly post from. Anything else (schedulers, automation tools, custom apps) is
// worth showing, because X no longer shows it.
export const COMMON_CLIENTS = /^(?:Twitter|X) (?:for (?:iPhone|Android|iPad|Mac)|Web App)$|^(?:Twitter|X) Web Client$/;
