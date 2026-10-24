// The ffmpeg arguments for `daylight media convert` and `daylight media compress`, as a pure function
// so tests can check them without ffmpeg. Similar formats only: still images among PNG, JPEG, WebP and
// AVIF; GIF to MP4 or WebM; video to WebM or MP4; audio to Opus in WebM or Ogg.

export const IMAGE = ["png", "jpg", "jpeg", "webp", "avif", "bmp", "tif", "tiff"];
export const VIDEO = ["mp4", "webm", "mov", "m4v", "mkv", "ts", "avi"];
export const AUDIO = ["mp3", "m4a", "aac", "ogg", "opus", "wav", "flac", "weba"];
export const TARGETS = { image: ["png", "jpg", "webp", "avif"], gif: ["mp4", "webm", "webp", "png"], video: ["webm", "mp4"], audio: ["webm", "ogg", "opus"] };

export function kindOfExt(ext) {
  const e = String(ext || "").toLowerCase().replace(/^\./, "");
  if (e === "gif") return "gif";
  if (IMAGE.includes(e)) return "image";
  if (VIDEO.includes(e)) return "video";
  if (AUDIO.includes(e)) return "audio";
  return null;
}

// "2M", "500k", "96000" as bits per second.
export function bits(v, dflt) {
  if (v == null || v === true || v === "") return dflt;
  const m = /^(\d+(?:\.\d+)?)\s*([kKmM]?)$/.exec(String(v));
  if (!m) throw new Error(`Not a bitrate: ${v}. Use a number such as 2M, 800k or 96000.`);
  return Math.round(Number(m[1]) * (m[2].toLowerCase() === "m" ? 1e6 : m[2].toLowerCase() === "k" ? 1e3 : 1));
}

const quality01 = (q, d) => { const n = q == null || q === true ? d : Number(q); if (!(n > 0 && n <= 1)) throw new Error("--quality takes a number above 0 and up to 1, such as 0.8."); return n; };
const evenScale = (maxHeight) => (maxHeight ? `scale=-2:'min(ih,${maxHeight})'` : "scale=trunc(iw/2)*2:trunc(ih/2)*2");

function imageArgs(to, { quality, maxSide }) {
  const vf = maxSide ? ["-vf", `scale=w=${maxSide}:h=${maxSide}:force_original_aspect_ratio=decrease`] : [];
  if (to === "png") return [...vf, "-frames:v", "1", "-c:v", "png"];
  if (to === "jpg") return [...vf, "-frames:v", "1", "-q:v", String(Math.max(2, Math.min(31, Math.round(31 - quality * 29))))];
  if (to === "webp") return [...vf, "-frames:v", "1", "-c:v", "libwebp", "-quality", String(Math.round(quality * 100))];
  return [...vf, "-frames:v", "1", "-c:v", "libaom-av1", "-still-picture", "1", "-crf", String(Math.round(63 - quality * 50))];
}

function videoArgs(to, { bitrate, audioBitrate, maxHeight, fps, gif }) {
  const v = to === "mp4" ? ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-b:v", String(bitrate)] : ["-c:v", "libvpx-vp9", "-b:v", String(bitrate), "-row-mt", "1"];
  const a = gif ? ["-an"] : to === "mp4" ? ["-c:a", "aac", "-b:a", String(audioBitrate)] : ["-c:a", "libopus", "-b:a", String(audioBitrate)];
  return ["-vf", evenScale(maxHeight), ...(fps ? ["-r", String(fps)] : []), ...v, ...a, ...(to === "mp4" ? ["-movflags", "+faststart"] : [])];
}

// { op, kind, to, args, params }. op is "convert" or "compress"; for compress `to` defaults to the
// input's own format. Throws with a plain sentence for a pair that is not similar.
export function ffmpegPlan(op, inExt, flags = {}) {
  const kind = kindOfExt(inExt);
  if (!kind) throw new Error(`Daylight Commons converts images, GIFs, video and audio; .${inExt} is none of these.`);
  const own = String(inExt).toLowerCase().replace(/^jpeg$/, "jpg");
  let to = String(flags.to || (op === "compress" ? own : "")).toLowerCase().replace(/^jpeg$/, "jpg");
  if (!to) throw new Error(`Say what to convert into with --to: ${TARGETS[kind].join(", ")}.`);
  if (op === "compress" && kind === "video" && !TARGETS.video.includes(to)) to = "mp4";
  if (op === "compress" && kind === "audio" && !TARGETS.audio.includes(to)) to = "ogg";
  if (op === "compress" && kind === "gif") to = flags.to ? to : "mp4";
  if (!TARGETS[kind].includes(to)) throw new Error(`A ${kind} converts to ${TARGETS[kind].join(", ")}, not ${to}.`);
  const p = { quality: quality01(flags.quality, op === "compress" ? 0.7 : 0.85), maxSide: Number(flags["max-side"]) || 0, maxHeight: Number(flags["max-height"]) || 0,
    fps: Number(flags.fps) || 0, bitrate: bits(flags.bitrate, op === "compress" ? 1000000 : 2000000), audioBitrate: bits(flags["audio-bitrate"], op === "compress" ? 64000 : 96000) };
  let args;
  if (kind === "image" || (kind === "gif" && ["webp", "png"].includes(to))) args = imageArgs(to, p);
  else if (kind === "audio") args = ["-vn", "-c:a", "libopus", "-b:a", String(p.audioBitrate)];
  else args = videoArgs(to, { ...p, gif: kind === "gif" });
  const params = kind === "image" ? { to, quality: p.quality, maxSide: p.maxSide || null } : kind === "audio" ? { to, audioBitrate: p.audioBitrate }
    : { to, bitrate: p.bitrate, maxHeight: p.maxHeight || null, fps: p.fps || null, ...(kind === "video" ? { audioBitrate: p.audioBitrate } : {}) };
  return { op, kind, to, args, params };
}
