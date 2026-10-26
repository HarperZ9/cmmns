// `daylight media fetch <url>`: saves a video from a page address with a yt-dlp the user installed
// (YTDLP names another binary), into the same folder tree as the extension (Downloads/Daylight/<site>/,
// or --dir), with the same daylight.sidecar/1 note beside it, built from yt-dlp's own description of
// the video. yt-dlp refuses DRM-protected video, and so does this. The extension never downloads
// YouTube video itself; on YouTube its unpacked build copies this command for the user to run.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join, basename } from "node:path";
import { postMeta, sidecarMarkdown, sidecarJson, saveFolder } from "../../src/core/media-meta.js";

// The yt-dlp to run and its version, or null when there is none.
export function findYtDlp(env = process.env) {
  const bin = env.YTDLP || "yt-dlp";
  const r = spawnSync(bin, ["--version"], { encoding: "utf8" });
  if (r.error || r.status !== 0) return null;
  return { bin, version: (r.stdout || "").trim() };
}

const siteOf = (url) => {
  try { const h = new URL(url).hostname.replace(/^(www|m)\./, ""); return /(^|\.)youtube\.com$|^youtu\.be$/.test(h) ? "youtube" : h; } catch { return "media"; }
};

// The folder and the yt-dlp arguments for one address. Pure, so it is tested without a network.
export function fetchPlan(url, flags = {}, home = homedir()) {
  if (!/^https?:\/\//i.test(String(url || ""))) throw new Error("Give the page's address, starting with https://.");
  const dir = typeof flags.dir === "string" ? flags.dir : join(home, "Downloads", saveFolder("Daylight", siteOf(url)));
  const out = join(dir, "%(uploader_id,channel_id,uploader)s_%(upload_date>%Y-%m-%d)s_%(title).60B.%(ext)s");
  const args = ["--no-playlist", "--no-overwrites", "--write-info-json", "--restrict-filenames", "--merge-output-format", "mp4", "-o", out, "--print", "after_move:filepath", url];
  return { dir, args, site: siteOf(url) };
}

// The sidecar record from yt-dlp's info file. Only what the page and yt-dlp describe; no viewer data.
export function metaFromInfo(info, url, now = new Date().toISOString()) {
  const d = /^(\d{4})(\d{2})(\d{2})$/.exec(String(info.upload_date || ""));
  const chapters = (info.chapters || []).map((c) => `${new Date((c.start_time || 0) * 1000).toISOString().slice(11, 19)} ${c.title}`);
  return postMeta({ site: siteOf(url), title: info.title || null, text: info.description || null, authorName: info.uploader || info.channel || null,
    handle: String(info.uploader_id || "").replace(/^@/, "") || null, postUrl: info.webpage_url || url, mediaUrl: info.webpage_url || url,
    postedAt: d ? `${d[1]}-${d[2]}-${d[3]}T00:00:00Z` : null, notes: chapters.length ? [{ label: "Chapters", text: chapters.join("\n") }] : [] }, now);
}

// Runs one fetch. Returns { file, sidecar, line }. Throws with what to do next.
export function runFetch(url, flags = {}, env = process.env) {
  const plan = fetchPlan(url, flags);
  const y = findYtDlp(env);
  if (!y) throw new Error("yt-dlp was not found. Install it (github.com/yt-dlp/yt-dlp) or set YTDLP to its path, then run this again.");
  const r = spawnSync(y.bin, plan.args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  const file = (r.stdout || "").trim().split(/\r?\n/).filter(Boolean).pop();
  if (r.status !== 0 || !file || !existsSync(file)) throw new Error("yt-dlp could not save this video. Its message is above; protected (DRM) video cannot be saved.");
  const infoPath = file.replace(/\.[^.]+$/, ".info.json");
  const info = existsSync(infoPath) ? JSON.parse(readFileSync(infoPath, "utf8")) : {};
  const meta = metaFromInfo(info, url), stem = file.replace(/\.[^.]+$/, "");
  writeFileSync(stem + ".md", sidecarMarkdown(meta, basename(file)));
  if (flags.json) writeFileSync(stem + ".json", sidecarJson(meta, basename(file)));
  if (!flags["keep-info"] && existsSync(infoPath)) rmSync(infoPath);
  return { file, sidecar: stem + ".md", line: `Saved ${file}\nNote beside it: ${basename(stem)}.md (made with yt-dlp ${y.version})\n` };
}

// Every file a fetch left in a folder, for tests and the help text.
export const listed = (dir) => (existsSync(dir) ? readdirSync(dir) : []);
