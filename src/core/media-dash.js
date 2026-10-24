// DASH manifests (MPD, ISO/IEC 23009-1): reads the representations of a static manifest, says
// whether any is protected, and builds each representation's segment list. A ContentProtection
// element anywhere means the media is encrypted, and Daylight Commons does not fetch it.
// Handles SegmentTemplate (with $Number$, $Time$, SegmentTimeline and format tags like
// $Number%05d$), SegmentList and a single BaseURL file. Pure: no network.

import { readXml, xmlAll, xmlChild, xmlChildren } from "./media-xml.js";

const resolve = (u, base) => { try { return new URL(u, base).href; } catch { return null; } };

// ISO 8601 durations such as PT1H2M3.5S, in seconds.
export function isoSeconds(d) {
  const m = /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(String(d || ""));
  if (!m) return null;
  const [, D = 0, H = 0, M = 0, S = 0] = m;
  return Number(D) * 86400 + Number(H) * 3600 + Number(M) * 60 + Number(S);
}

// $Name$ and $Name%0Nd$ substitution, and $$ for a literal dollar sign.
export function dashFill(template, vars) {
  return String(template).replace(/\$(\w*)(?:%0(\d+)d)?\$/g, (m, k, w) => {
    if (!k) return "$";
    if (!(k in vars)) return m;
    const v = String(vars[k]);
    return w ? v.padStart(Number(w), "0") : v;
  });
}

function baseOf(chain, mpdUrl) {
  let base = mpdUrl;
  for (const el of chain) { const b = xmlChild(el, "BaseURL"); if (b && b.text.trim()) base = resolve(b.text.trim(), base); }
  return base;
}

// The nearest of each kind of segment element along the chain, the representation first.
const nearest = (chain, name) => { for (let i = chain.length - 1; i >= 0; i--) { const c = xmlChild(chain[i], name); if (c) return c; } return null; };

function timelineTimes(tl) {
  const out = [];
  let t = 0;
  for (const s of xmlChildren(tl, "S")) {
    if (s.attrs.t != null) t = Number(s.attrs.t);
    const d = Number(s.attrs.d), r = Number(s.attrs.r || 0);
    for (let i = 0; i <= (r < 0 ? 0 : r); i++) { out.push(t); t += d; }
  }
  return out;
}

function templateList(tpl, rep, base, seconds) {
  const vars = { RepresentationID: rep.attrs.id || "", Bandwidth: rep.attrs.bandwidth || "" };
  const list = [];
  if (tpl.attrs.initialization) list.push({ url: resolve(dashFill(tpl.attrs.initialization, vars), base), init: true });
  const start = Number(tpl.attrs.startNumber || 1), media = tpl.attrs.media;
  if (!media) return list;
  const tl = xmlChild(tpl, "SegmentTimeline");
  if (tl) timelineTimes(tl).forEach((t, i) => list.push({ url: resolve(dashFill(media, { ...vars, Time: t, Number: start + i }), base) }));
  else {
    const scale = Number(tpl.attrs.timescale || 1), dur = Number(tpl.attrs.duration || 0);
    const n = dur && seconds ? Math.ceil((seconds * scale) / dur) : 0;
    for (let i = 0; i < Math.min(n, 100000); i++) list.push({ url: resolve(dashFill(media, { ...vars, Number: start + i, Time: i * dur }), base) });
  }
  return list;
}

function segmentList(sl, base) {
  const list = [], init = xmlChild(sl, "Initialization");
  if (init && init.attrs.sourceURL) list.push({ url: resolve(init.attrs.sourceURL, base), init: true });
  for (const s of xmlChildren(sl, "SegmentURL")) if (s.attrs.media) list.push({ url: resolve(s.attrs.media, base) });
  return list;
}

function representation(mpd, period, set, rep, mpdUrl, seconds) {
  const chain = [mpd, period, set, rep], base = baseOf(chain, mpdUrl);
  const tpl = nearest(chain, "SegmentTemplate"), sl = nearest(chain, "SegmentList");
  const segments = tpl ? templateList({ ...tpl, attrs: { ...(xmlChild(set, "SegmentTemplate") || { attrs: {} }).attrs, ...tpl.attrs } }, rep, base, seconds)
    : sl ? segmentList(sl, base) : [{ url: base }];
  const type = rep.attrs.mimeType || set.attrs.mimeType || "", kind = set.attrs.contentType || type.split("/")[0] || null;
  return { id: rep.attrs.id || null, kind, mimeType: type || null, codecs: rep.attrs.codecs || set.attrs.codecs || null,
    bandwidth: Number(rep.attrs.bandwidth) || 0, width: Number(rep.attrs.width || set.attrs.width) || null, height: Number(rep.attrs.height || set.attrs.height) || null,
    language: set.attrs.lang || null, segments };
}

// { kind: "dash", type: "static" | "dynamic", duration, protection, representations } or null.
export function parseMpd(text, mpdUrl) {
  const mpd = readXml(text);
  if (!mpd || mpd.name !== "MPD") return null;
  const seconds = isoSeconds(mpd.attrs.mediaPresentationDuration);
  const protection = xmlAll(mpd, "ContentProtection").map((c) => c.attrs.schemeIdUri || "ContentProtection");
  const representations = [];
  for (const period of xmlChildren(mpd, "Period")) {
    const pSeconds = isoSeconds(period.attrs.duration) || seconds;
    for (const set of xmlChildren(period, "AdaptationSet")) for (const rep of xmlChildren(set, "Representation")) representations.push(representation(mpd, period, set, rep, mpdUrl, pSeconds));
  }
  return { kind: "dash", type: mpd.attrs.type || "static", duration: seconds, protection, representations };
}

// Why a manifest cannot be saved, or null.
export function dashProtection(mpd) {
  if (!mpd || !mpd.protection.length) return null;
  const known = { "urn:mpeg:dash:mp4protection:2011": "Common Encryption", "urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed": "Widevine",
    "urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95": "PlayReady", "urn:uuid:94ce86fb-07ff-4f43-adb8-93d2fa968ca2": "FairPlay" };
  const names = [...new Set(mpd.protection.map((p) => known[String(p).toLowerCase()] || p))];
  return `The stream is protected (${names.join(", ")}).`;
}

// The best representation of a kind ("video" or "audio") at or under maxHeight.
export function pickRepresentation(mpd, kind, { maxHeight = Infinity } = {}) {
  const r = mpd.representations.filter((x) => x.kind === kind).sort((a, b) => b.bandwidth - a.bandwidth);
  return r.find((x) => !x.height || x.height <= maxHeight) || r[r.length - 1] || null;
}
