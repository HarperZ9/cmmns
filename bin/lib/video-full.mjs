// `cmmns media fetch <url> --full`: the whole video save as one bundle folder, through a yt-dlp the
// user installed. The folder ("<save root>/<site>/<handle>_<date>_<words>_<id>/") holds the media
// file (unless --no-video), the captions as WebVTT and as a timestamped and a plain transcript, the
// chapters and metadata (<id>.video.json), the comment tree with replies and like counts
// (<id>.thread.json), the daylight.sidecar/1 note, SOURCE.txt and SHA256SUMS. The media file is a
// local research copy: nothing here uploads, shares or publishes it.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, readdirSync, rmSync, mkdirSync, renameSync, openSync, readSync, closeSync } from "node:fs";
import { homedir } from "node:os";
import { join, basename, dirname } from "node:path";
import { sidecarMarkdown, metaName } from "../../src/core/media-meta.js";
import { captureThread, threadFileJson, THREAD_CAP_MAX } from "../../src/core/capture-thread.js";
import { vttSegments, timedTranscript, plainTranscript } from "../../src/core/video-transcript.js";
import { videoRecord, ytDlpComments, sourceText, sha256Sums } from "../../src/core/video-bundle.js";
import { findYtDlp, fetchPlan, metaFromInfo } from "./media-fetch.mjs";
import { globalProtection } from "./case-protect.mjs";

export const FULL_COMMENTS_DEFAULT = 600;

// The yt-dlp arguments for one bundle, into a staging folder. Pure, so it is tested offline.
export function fullPlan(url, flags = {}, home = homedir()) {
  const base = fetchPlan(url, flags, home);
  const max = Math.min(THREAD_CAP_MAX, Math.max(0, Number(flags.comments ?? FULL_COMMENTS_DEFAULT) || 0));
  const stage = join(base.dir, `.cmmns-partial-${Date.now().toString(36)}`);
  const args = ["--ignore-config", "--no-playlist", "--no-overwrites", "--write-info-json", "--write-subs", "--write-auto-subs", "--sub-langs", flags.langs || "en,en-orig", "--sub-format", "vtt",
    ...(max ? ["--write-comments", "--extractor-args", `youtube:max_comments=${max},all,all,all;comment_sort=top`] : []),
    ...(flags["no-video"] ? ["--skip-download"] : ["--merge-output-format", "mp4"]), "-o", join(stage, "%(id)s.%(ext)s"), "--", url];
  return { ...base, stage, args, max, video: !flags["no-video"] };
}

// The caption file to read: a manual track before a machine one, the original language before a
// translation. files: names in the folder; info: yt-dlp's info.
export function pickCaptions(files, info, id) {
  const vtts = files.filter((f) => f.startsWith(id + ".") && f.endsWith(".vtt"));
  const lang = (f) => f.slice(id.length + 1, -4);
  const manual = Object.keys((info && info.subtitles) || {});
  const order = [...vtts.filter((f) => manual.includes(lang(f))), ...vtts.filter((f) => lang(f).endsWith("-orig")), ...vtts];
  const file = order[0] || null;
  return file ? { file, lang: lang(file), kind: manual.includes(lang(file)) ? "manual" : "auto" } : null;
}

// The record yt-dlp's info gives, without its format lists and signed stream addresses.
function recordOf(info, url, caps, segments, media, savedAt) {
  const d = /^(\d{4})(\d{2})(\d{2})$/.exec(String(info.upload_date || ""));
  return videoRecord({ site: fetchPlan(url).site, id: info.id, url: info.webpage_url || url, title: info.title, channel: info.channel || info.uploader, channelUrl: info.channel_url || info.uploader_url,
    handle: String(info.uploader_id || "").replace(/^@/, "") || null, published: d ? `${d[1]}-${d[2]}-${d[3]}` : null, duration: info.duration, views: info.view_count, likes: info.like_count,
    comments: info.comment_count, description: info.description, tags: info.tags, chapters: (info.chapters || []).map((c) => ({ start: c.start_time, title: c.title })),
    captions: caps ? { lang: caps.lang, kind: caps.kind, from: "yt-dlp WebVTT" } : null, segments, media, source: "yt-dlp", tool: "CMMNS command line", savedAt });
}

// sha256 of a file read in 4 MB steps, so a long video is never held in memory at once.
export function fileSha256(path) {
  const h = createHash("sha256"), fd = openSync(path, "r"), buf = Buffer.alloc(4 << 20);
  try { for (let n; (n = readSync(fd, buf, 0, buf.length, null)) > 0;) h.update(buf.subarray(0, n)); } finally { closeSync(fd); }
  return h.digest("hex");
}

// Writes every file of the bundle from what yt-dlp left in `dir`. Returns the list written. Pure of
// the network: the tests run it on a folder they made.
export function writeBundle(dir, info, url, { savedAt = new Date().toISOString(), keepInfo = false, version = "" } = {}) {
  const id = String(info.id || "video"), files = readdirSync(dir);
  const media = files.find((f) => f.startsWith(id + ".") && !/\.(vtt|json|part|ytdl)$/.test(f)) || null;
  const caps = pickCaptions(files, info, id);
  const segs = caps ? vttSegments(readFileSync(join(dir, caps.file), "utf8")) : [];
  const put = (name, text) => { writeFileSync(join(dir, name), text); return name; };
  const written = [];
  if (segs.length) written.push(put(`${id}.transcript.txt`, timedTranscript(segs)), put(`${id}.transcript.plain.txt`, plainTranscript(segs)));
  const thread = captureThread({ site: "youtube", post: { url: info.webpage_url || url, id }, comments: ytDlpComments(info), expected: info.comment_count ?? null,
    cap: Math.max(1, (info.comments || []).length), source: "yt-dlp (the site's comment data)", savedAt });
  written.push(put(`${id}.thread.json`, threadFileJson(thread)));
  written.push(put(`${id}.video.json`, JSON.stringify(recordOf(info, url, caps, segs.length, media, savedAt), null, 2) + "\n"));
  const meta = { ...metaFromInfo(info, url, savedAt), threadCapture: thread, threadFile: `${id}.thread.json` };
  written.push(put(`${id}.md`, sidecarMarkdown(meta, media || `${id}.video.json`)));
  if (!keepInfo) for (const f of readdirSync(dir)) if (f.endsWith(".info.json")) rmSync(join(dir, f));
  const listed = readdirSync(dir).filter((f) => f !== "SOURCE.txt" && f !== "SHA256SUMS").sort();
  put("SOURCE.txt", sourceText({ url: info.webpage_url || url, title: info.title, channel: info.channel || info.uploader, savedAt,
    how: `yt-dlp${version ? " " + version : ""} through cmmns media fetch --full: ${caps ? `${caps.kind} captions (${caps.lang})` : "no captions"}, ${(info.comments || []).length} comments with replies, sorted by top`, files: listed, media }));
  put("SHA256SUMS", sha256Sums([...listed, "SOURCE.txt"].map((name) => ({ name, sha256: fileSha256(join(dir, name)) }))));
  return { id, media, captions: caps, written: [...written, "SOURCE.txt", "SHA256SUMS"], comments: (info.comments || []).length };
}

// Runs one full fetch. Returns { dir, line }. Throws with what to do next.
export function runFull(url, flags = {}, env = process.env) {
  const plan = fullPlan(url, flags);
  if (globalProtection(env)) throw new Error("Source-protection mode is on (cmmns protect status), so nothing is downloaded: the request would tell the host.");
  const y = findYtDlp(env);
  if (!y) throw new Error("yt-dlp was not found. Install it (github.com/yt-dlp/yt-dlp) or set YTDLP to its path, then run this again.");
  mkdirSync(plan.stage, { recursive: true });
  const r = spawnSync(y.bin, plan.args, { encoding: "utf8", stdio: ["ignore", "inherit", "inherit"] });
  const infoFile = readdirSync(plan.stage).find((f) => f.endsWith(".info.json"));
  if (r.status !== 0 || !infoFile) throw new Error(`yt-dlp could not read this video. Its message is above; the partial files are in ${plan.stage}.`);
  const info = JSON.parse(readFileSync(join(plan.stage, infoFile), "utf8"));
  const done = writeBundle(plan.stage, info, url, { keepInfo: !!flags["keep-info"], version: y.version });
  const name = metaName(metaFromInfo(info, url), "x").replace(/\.x$/, "");
  const dir = join(dirname(plan.stage), name);
  if (existsSync(dir)) throw new Error(`${dir} already exists; the new bundle is in ${plan.stage}.`);
  renameSync(plan.stage, dir);
  return { dir, ...done, line: `Saved the bundle ${basename(dir)} in ${dirname(dir)}\n${done.written.length} files${done.media ? `, with the media file ${done.media}` : ", no media file"}; ${done.comments} comments; captions ${done.captions ? done.captions.kind + " " + done.captions.lang : "none"}.\n` };
}
