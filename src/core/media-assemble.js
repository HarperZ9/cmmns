// Puts a streamed video together as one file: an HLS playlist or DASH manifest, its segments in
// order, then one MP4 with sound where the parts are MP4 (media-demux.js). No network code of its
// own: the caller passes get(url, { range, as }) that answers { bytes, type } or, with as "text",
// the text. The extension passes the page's fetch; the command line can pass Node's. An encrypted
// playlist, a DRM manifest or an encrypted file stops it with MediaProtected before more is read.

import { parseM3u8, hlsProtection, pickVariant, audioFor, hlsFetchList, hlsContainer } from "./media-hls.js";
import { parseMpd, dashProtection, pickRepresentation } from "./media-dash.js";
import { fileProtection } from "./media-protect.js";
import { concatBytes } from "./media-bytes.js";
import { remuxMp4 } from "./media-demux.js";

export class MediaProtected extends Error { constructor(reason) { super(reason); this.reason = reason; this.name = "MediaProtected"; } }

const MAX_BYTES = 1024 * 1048576, PARALLEL = 4;

async function segmentsOf(get, list, onProgress) {
  const out = new Array(list.length);
  let next = 0, done = 0, total = 0;
  async function worker() {
    while (next < list.length) {
      const i = next++;
      out[i] = (await get(list[i].url, { range: list[i].range })).bytes;
      if ((total += out[i].length) > MAX_BYTES) throw new Error("The stream is larger than 1 GB, more than one download holds.");
      if (onProgress) onProgress(++done, list.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(PARALLEL, list.length) }, worker));
  return concatBytes(out);
}

async function hlsMedia(get, url, role, onProgress) {
  const pl = parseM3u8(await get(url, { as: "text" }), url);
  if (!pl || pl.kind !== "media") throw new Error("The playlist could not be read.");
  const why = hlsProtection(pl);
  if (why) throw new MediaProtected(why);
  const list = hlsFetchList(pl);
  return { role, bytes: await segmentsOf(get, list, onProgress), container: hlsContainer(pl, list[0] && list[0].url), live: !pl.endList };
}

async function hlsParts(get, url, onProgress) {
  const pl = parseM3u8(await get(url, { as: "text" }), url);
  if (!pl) throw new Error("The address did not answer with an HLS playlist.");
  const why = hlsProtection(pl);
  if (why) throw new MediaProtected(why);
  if (pl.kind === "media") return [await hlsMedia(get, url, "video", onProgress)];
  const variant = pickVariant(pl), audio = audioFor(pl, variant);
  const parts = [await hlsMedia(get, variant.url, "video", onProgress)];
  if (audio) parts.push(await hlsMedia(get, audio.url, "audio", onProgress));
  return parts;
}

async function dashParts(get, url, onProgress) {
  const mpd = parseMpd(await get(url, { as: "text" }), url);
  if (!mpd) throw new Error("The address did not answer with a DASH manifest.");
  const why = dashProtection(mpd);
  if (why) throw new MediaProtected(why);
  const parts = [];
  for (const kind of ["video", "audio"]) {
    const rep = pickRepresentation(mpd, kind);
    if (rep) parts.push({ role: kind, bytes: await segmentsOf(get, rep.segments, onProgress), container: /webm/.test(rep.mimeType || "") ? "webm" : "mp4", live: mpd.type === "dynamic" });
  }
  if (!parts.length) throw new Error("The manifest lists no video or sound.");
  return parts;
}

const mimeOf = (p) => (p.container === "mp4" ? (p.role === "audio" ? "audio/mp4" : "video/mp4") : p.container === "webm" ? `${p.role}/webm` : p.container === "aac" ? "audio/aac" : "video/mp2t");

// One file from the parts: { files: [{ bytes, mime, role }], note }. Two files come back only when
// the codecs cannot be rewrapped or the parts are not MP4; the note says so.
export function combineParts(parts) {
  for (const p of parts) { const why = fileProtection(p.bytes); if (why) throw new MediaProtected(why); }
  const live = parts.some((p) => p.live) ? " This is a live stream: the file holds what it listed when saved." : "";
  const apart = (why) => ({ files: parts.map((p) => ({ bytes: p.bytes, mime: mimeOf(p), role: p.role })), note: ` Saved as separate video and sound files${why ? ": " + why : "."}${live}` });
  if (parts.length === 1) return { files: [{ bytes: parts[0].bytes, mime: mimeOf(parts[0]), role: parts[0].role }], note: live };
  if (!parts.every((p) => p.container === "mp4")) return apart("");
  try { return { files: [{ bytes: remuxMp4(parts.map((p) => p.bytes)), mime: "video/mp4", role: "video" }], note: live }; }
  catch (e) { return apart(e.message); }
}

// Fetches and combines a stream { type: "hls" | "dash", url } with the caller's get().
export async function assembleStream(stream, { get, onProgress } = {}) {
  if (typeof get !== "function") throw new Error("assembleStream needs a get(url, { range, as }) function");
  const parts = await (stream.type === "hls" ? hlsParts : dashParts)(get, stream.url, onProgress);
  return combineParts(parts);
}
