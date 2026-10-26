// Which file a download takes, and whether it may be taken at all. The largest picture a <picture>
// or srcset offers, the full-size address on hosts that serve a reduced copy by default, and the
// plan for one target: a plain address, bytes the page holds, a stream to assemble, a GIF to make,
// or a refusal. Protected media is refused with the toolkit's own sentence and is never fetched.

import { PROTECTED_LINE } from "./media-protect.js";

// srcset as [{ url, w, x, h }], parsed as the HTML standard does: an address runs to the first
// space, so commas inside it (image CDNs use "w_100,h_100") stay in the address; a trailing comma
// ends a candidate with no descriptor.
export function parseSrcset(srcset) {
  const s = String(srcset || ""), out = [];
  let i = 0;
  while (i < s.length) {
    while (i < s.length && /[\s,]/.test(s[i])) i++;
    if (i >= s.length) break;
    let url = "";
    while (i < s.length && !/\s/.test(s[i])) url += s[i++];
    let desc = "";
    if (/,+$/.test(url)) url = url.replace(/,+$/, "");
    else {
      let depth = 0;
      while (i < s.length && (s[i] !== "," || depth)) { if (s[i] === "(") depth++; if (s[i] === ")") depth = Math.max(0, depth - 1); desc += s[i++]; }
    }
    const c = { url, w: null, x: null, h: null };
    for (const d of desc.trim().split(/\s+/).filter(Boolean)) {
      const m = /^(\d+(?:\.\d+)?)([wxh])$/i.exec(d);
      if (m) c[m[2].toLowerCase()] = Number(m[1]);
    }
    if (url) out.push(c);
  }
  return out;
}

// The address of the largest candidate. el: { src, currentSrc, srcset, sources: [{ srcset, type }],
// layoutWidth }. A width descriptor counts as its width; a density descriptor as density times the
// laid-out width. Sources whose type the browser cannot show (supports(type) false) are skipped.
export function largestSource(el, { base = undefined, supports = () => true } = {}) {
  const width = Number(el.layoutWidth) || 1;
  const list = [];
  for (const s of [...(el.sources || []), { srcset: el.srcset, type: null }]) {
    if (!s || !s.srcset || (s.type && !supports(s.type))) continue;
    for (const c of parseSrcset(s.srcset)) list.push({ url: c.url, score: c.w || (c.x || 1) * width });
  }
  for (const u of [el.currentSrc, el.src]) if (u) list.push({ url: u, score: Number(el.naturalWidth) || width, plain: true });
  if (!list.length) return null;
  list.sort((a, b) => b.score - a.score || Number(!!b.plain) - Number(!!a.plain));
  try { return new URL(list[0].url, base).href; } catch { return list[0].url; }
}

// The full-size addresses to try, best first, on hosts that serve a smaller copy by default; the
// address itself comes last. X: pbs.twimg.com/media/<id> keeps the original only at name=orig in
// the original format, which the page does not say (it asks for WebP), so JPEG and PNG originals
// are tried, then the largest WebP (name=4096x4096). Reddit: preview.redd.it/<file> (resized and
// signed) to i.redd.it/<file>, the original upload. Imgur: <id>_lq.mp4, the low-quality preview its
// pages play first, to <id>.mp4.
export function sizeLadder(url) {
  let u;
  try { u = new URL(url); } catch { return [url]; }
  if (u.hostname === "pbs.twimg.com" && u.pathname.startsWith("/media/")) {
    const m = /^(\/media\/[\w-]+)(?:\.(\w+))?(?::\w+)?$/.exec(u.pathname);
    if (!m) return [url];
    const said = (u.searchParams.get("format") || m[2] || "jpg").toLowerCase(), base = `https://pbs.twimg.com${m[1]}?format=`;
    const formats = [...new Set([said === "webp" ? null : said, "jpg", "png"].filter(Boolean))];
    return [...new Set([...formats.map((f) => `${base}${f}&name=orig`), `${base}${said}&name=4096x4096`, url])];
  }
  if (u.hostname === "i.imgur.com" && /^\/\w+_lq\.mp4$/.test(u.pathname)) return [`https://i.imgur.com${u.pathname.replace("_lq.mp4", ".mp4")}`, url];
  if (u.hostname === "preview.redd.it" && /^\/[\w-]+\.(jpe?g|png|gif|webp)$/i.test(u.pathname)) return [`https://i.redd.it${u.pathname}`, url];
  return [url];
}
export const fullSizeUrl = (url) => sizeLadder(url)[0];

// The plan for one target. target: { kind, url, streams, protected, canvas, gifUrl, blob }.
// { action, ... } where action is
//   "refuse"   protected media: { reason, line, reference: true } (a reference may be saved)
//   "url"      a plain address the browser downloads: { url }
//   "bytes"    data: or blob: content the page holds: { url }
//   "canvas"   pixels drawn on a canvas, saved as PNG
//   "stream"   an HLS or DASH stream to assemble: { stream }
//   "gif"      a GIF to make on this device: { from: "video" | "image" | "stream", url?, stream? }
//   "none"     nothing that can be read: { reason }
export function downloadPlan(t, { asGif = false } = {}) {
  if (!t) return { action: "none", reason: "Nothing was found under the pointer." };
  if (t.protected) return { action: "refuse", reason: t.protected, line: PROTECTED_LINE, reference: true };
  const web = (u) => /^https?:/i.test(String(u || ""));
  const stream = t.streams && t.streams.length ? t.streams[t.streams.length - 1] : null;
  if (asGif) {
    if (t.gifUrl) return { action: "url", url: t.gifUrl };
    if (t.kind === "gif" && (web(t.url) || /^(data|blob):/.test(t.url || ""))) return { action: web(t.url) ? "url" : "bytes", url: t.url };
    if (t.url && (t.kind === "video" || t.kind === "image")) return { action: "gif", from: t.kind, url: t.url };
    if (stream) return { action: "gif", from: "stream", stream };
    return { action: "none", reason: "This media has no file Daylight Commons can read to make a GIF." };
  }
  if (t.canvas) return { action: "canvas" };
  if (web(t.url)) { const [url, ...alternatives] = sizeLadder(t.url); return { action: "url", url, alternatives: [...alternatives, ...(t.alternatives || [])] }; }
  if (t.url && /^data:/i.test(t.url)) return { action: "bytes", url: t.url };
  if (t.url && /^blob:/i.test(t.url) && t.kind !== "video" && t.kind !== "audio") return { action: "bytes", url: t.url };
  if (stream) return { action: "stream", stream };
  return { action: "none", reason: "The page builds this media in memory from a stream Daylight Commons cannot find, so it cannot be saved as one file." };
}

export const REFERENCE_LABEL = "Protected source. Reference only, not for redistribution.";

// A reference to protected media: what the page shows in the clear about it, never the media.
// { page, title, savedAt, label, images: [addresses], previews: [addresses], reason }.
export function referenceOf({ page, title, poster = null, images = [], previews = [], reason = null }, now = new Date().toISOString()) {
  const clean = (list) => [...new Set(list.filter((u) => /^https?:/i.test(String(u || ""))))].slice(0, 12);
  return { page: page || null, title: title ? String(title).slice(0, 300) : null, savedAt: now, label: REFERENCE_LABEL,
    images: clean([poster, ...images]), previews: clean(previews), reason: reason || null };
}
