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
