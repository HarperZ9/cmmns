// Share and campaign parameters taken out of an address before a sidecar stores it
// (project-docs/SIDECAR-FORMAT.md, "Addresses without share tracking"). A share link carries who
// shared it or which campaign sent it: YouTube's si, X's s and t, Instagram's igsh. The address
// still opens the same page without them.
//
// Host rules matter. On redd.it media, s= is the signature that makes the address work, and on
// YouTube t= is the time in the video. So the short names are taken out only on the hosts whose
// share links use them for tracking, and a media address (the file's own origin) is never touched.

// Taken out on every host: campaign tags and click ids.
const ANY_HOST = /^(utm_[a-z_]+|fbclid|gclid|gbraid|wbraid|dclid|msclkid|yclid|twclid|ttclid|mc_cid|mc_eid|_hsenc|_hsmi|igsh|igshid|ref_src|ref_url)$/i;

// Taken out only on the named host and its subdomains.
const BY_HOST = [
  [["x.com", "twitter.com"], ["s", "t"]],
  [["youtube.com", "youtu.be"], ["si", "pp", "feature"]],
  [["music.youtube.com"], ["si"]],
  [["open.spotify.com"], ["si"]],
  [["instagram.com"], ["igsh", "igshid", "img_index_share"]],
  [["reddit.com"], ["share_id", "rdt", "ref", "ref_source", "context_share"]],
  [["tiktok.com"], ["_r", "_t", "is_from_webapp", "sender_device", "is_copy_url", "share_app_id"]],
  [["linkedin.com"], ["trk", "trackingId", "lipi", "rcm"]],
  [["facebook.com"], ["mibextid", "sfnsn"]],
  [["threads.net", "threads.com"], ["xmt", "slof"]],
];

const onHost = (host, names) => names.some((h) => host === h || host.endsWith("." + h));

// The parameter names a host's share links use for tracking, beyond ANY_HOST.
export function hostTrackers(host) {
  const h = String(host || "").toLowerCase();
  const out = new Set();
  for (const [hosts, keys] of BY_HOST) if (onHost(h, hosts)) for (const k of keys) out.add(k);
  return out;
}

// The address without share and campaign parameters. Anything that is not an http(s) address
// comes back as given, as does an address with nothing to take out (byte for byte, so a stored
// address changes only when a parameter was removed). The fragment stays.
export function stripTracking(url) {
  if (url == null || url === "") return url;
  const s = String(url);
  let u;
  try { u = new URL(s); } catch { return s; }
  if (!/^https?:$/.test(u.protocol)) return s;
  const host = hostTrackers(u.hostname);
  const drop = [...u.searchParams.keys()].filter((k) => ANY_HOST.test(k) || host.has(k));
  if (!drop.length) return s;
  for (const k of new Set(drop)) u.searchParams.delete(k);
  if (![...u.searchParams.keys()].length) u.search = "";
  return u.toString();
}

// A YouTube thumbnail address names its video: i.ytimg.com/vi/<id>/hqdefault.jpg. A thumbnail
// saved from a YouTube page that is not a watch page (the home page, a channel, search) has no post
// address, so the sidecar takes the watch address from the thumbnail. Null for anything else.
const YT_THUMB = /^\/(?:vi|vi_webp|an_webp)\/([\w-]{11})\//;
export function watchFromThumb(mediaUrl, pageUrl) {
  let m, p;
  try { m = new URL(String(mediaUrl || "")); p = new URL(String(pageUrl || "")); } catch { return null; }
  if (!/^i\d?\.ytimg\.com$/.test(m.hostname)) return null;
  if (!(p.hostname === "youtube.com" || p.hostname.endsWith(".youtube.com"))) return null;
  const id = YT_THUMB.exec(m.pathname);
  return id ? `https://www.youtube.com/watch?v=${id[1]}` : null;
}
