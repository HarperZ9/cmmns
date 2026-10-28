// HLS playlists (RFC 8216): reads a master or media playlist into plain data, says whether the
// stream is encrypted, and lists the segment addresses to fetch. CMMNS saves only
// unencrypted streams: any EXT-X-KEY or EXT-X-SESSION-KEY with a METHOD other than NONE means the
// stream is protected, and it is never fetched. Pure: no network.

const resolve = (u, base) => { try { return new URL(u, base).href; } catch { return null; } };

// Attribute lists: KEY=VALUE pairs, values quoted or bare, commas inside quotes kept.
export function hlsAttrs(s) {
  const out = {};
  for (const m of String(s || "").matchAll(/([A-Z0-9-]+)=("[^"]*"|[^,]*)/g)) out[m[1]] = m[2].startsWith("\"") ? m[2].slice(1, -1) : m[2];
  return out;
}

const byterange = (v) => { const m = /^(\d+)(?:@(\d+))?$/.exec(String(v || "")); return m ? { length: Number(m[1]), offset: m[2] != null ? Number(m[2]) : null } : null; };

function masterLine(out, tag, attrs, next, base) {
  if (tag === "EXT-X-STREAM-INF" && next) {
    const [w, h] = String(attrs.RESOLUTION || "").split("x").map(Number);
    out.variants.push({ url: resolve(next, base), bandwidth: Number(attrs.BANDWIDTH) || 0, width: w || null, height: h || null, codecs: attrs.CODECS || null, audio: attrs.AUDIO || null });
    return true;
  }
  if (tag === "EXT-X-MEDIA" && attrs.URI) out.renditions.push({ type: attrs.TYPE || null, group: attrs["GROUP-ID"] || null, name: attrs.NAME || null, language: attrs.LANGUAGE || null, url: resolve(attrs.URI, base), isDefault: attrs.DEFAULT === "YES" });
  if (tag === "EXT-X-SESSION-KEY") out.keys.push({ method: attrs.METHOD || null, keyformat: attrs.KEYFORMAT || null, session: true });
  return false;
}

function mediaLine(out, st, tag, value, attrs, base) {
  if (tag === "EXTINF") st.duration = parseFloat(value) || 0;
  else if (tag === "EXT-X-BYTERANGE") st.range = byterange(value);
  else if (tag === "EXT-X-KEY") out.keys.push({ method: attrs.METHOD || null, keyformat: attrs.KEYFORMAT || null, session: false });
  else if (tag === "EXT-X-MAP") out.map = { url: resolve(attrs.URI, base), range: byterange(attrs.BYTERANGE) };
  else if (tag === "EXT-X-ENDLIST") out.endList = true;
  else if (tag === "EXT-X-PLAYLIST-TYPE") out.playlistType = value;
}

// { kind: "master", variants, renditions, keys } or { kind: "media", segments, map, keys, endList,
// duration }, or null when the text is not a playlist.
export function parseM3u8(text, base) {
  const lines = String(text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines[0] !== "#EXTM3U") return null;
  const master = lines.some((l) => l.startsWith("#EXT-X-STREAM-INF"));
  const out = master ? { kind: "master", variants: [], renditions: [], keys: [] } : { kind: "media", segments: [], map: null, keys: [], endList: false, playlistType: null, duration: 0 };
  const st = { duration: 0, range: null };
  let lastEnd = 0;
  for (let i = 1; i < lines.length; i++) {
    const l = lines[i];
    if (!l.startsWith("#")) {
      if (master) continue;
      const range = st.range ? { length: st.range.length, offset: st.range.offset != null ? st.range.offset : lastEnd } : null;
      if (range) lastEnd = range.offset + range.length;
      out.segments.push({ url: resolve(l, base), duration: st.duration, range });
      out.duration += st.duration;
      st.duration = 0; st.range = null;
      continue;
    }
    if (!l.startsWith("#EXT")) continue;
    const c = l.indexOf(":"), tag = (c > 0 ? l.slice(1, c) : l.slice(1)), value = c > 0 ? l.slice(c + 1) : "";
    const attrs = hlsAttrs(value);
    if (master) { if (masterLine(out, tag, attrs, lines[i + 1] && !lines[i + 1].startsWith("#") ? lines[i + 1] : null, base)) i++; }
    else mediaLine(out, st, tag, value, attrs, base);
  }
  if (!master) out.duration = Math.round(out.duration * 1000) / 1000;
  return out;
}

// Why a playlist cannot be saved, or null. Any key other than METHOD=NONE is encryption: AES-128,
// SAMPLE-AES and SAMPLE-AES-CTR alike, with or without a DRM key format.
export function hlsProtection(playlist) {
  if (!playlist) return null;
  const k = (playlist.keys || []).find((x) => x.method && x.method.toUpperCase() !== "NONE");
  if (!k) return null;
  const drm = k.keyformat && k.keyformat !== "identity" ? ` with the ${k.keyformat} key system` : "";
  return `The stream is encrypted (${k.method}${drm}).`;
}

// The variant to save: the highest bandwidth at or under maxHeight (default any), else the lowest.
export function pickVariant(master, { maxHeight = Infinity } = {}) {
  const v = [...(master.variants || [])].filter((x) => x.url).sort((a, b) => b.bandwidth - a.bandwidth);
  return v.find((x) => !x.height || x.height <= maxHeight) || v[v.length - 1] || null;
}

// The audio rendition a variant names, if it has its own playlist.
export function audioFor(master, variant) {
  const r = (master.renditions || []).filter((x) => x.type === "AUDIO" && x.url && (!variant || !variant.audio || x.group === variant.audio));
  return r.find((x) => x.isDefault) || r[0] || null;
}

// The fetch list for a media playlist: [{ url, range }], the init segment first when there is one.
// Only a finished playlist (EXT-X-ENDLIST) is complete; a live one gives what it lists now.
export function hlsFetchList(media) {
  const list = [];
  if (media.map && media.map.url) list.push({ url: media.map.url, range: media.map.range });
  for (const s of media.segments) if (s.url) list.push({ url: s.url, range: s.range });
  return list;
}

// The file type of an assembled stream: fragmented MP4 when there is an init map, else MPEG-TS.
export const hlsContainer = (media, firstUrl = "") => (media.map ? "mp4" : /\.aac(?:$|\?)/i.test(firstUrl) ? "aac" : "ts");
