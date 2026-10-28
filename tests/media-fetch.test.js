// `cmmns media fetch`: the yt-dlp arguments and folder for an address, and the sidecar built from
// yt-dlp's description of the video. Nothing here runs yt-dlp or touches the network.
import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { fetchPlan, metaFromInfo, saveRoot } from "../bin/lib/media-fetch.mjs";
import { sidecarMarkdown } from "../src/core/media-meta.js";

test("a YouTube address saves into Downloads/CMMNS/youtube with one video, no playlist", () => {
  const p = fetchPlan("https://www.youtube.com/watch?v=abc123&list=PL1", {}, "/home/a");
  assert.equal(p.dir, join("/home/a", "Downloads", "CMMNS/youtube/"));
  assert.equal(p.site, "youtube");
  assert.ok(p.args.includes("--no-playlist") && p.args.includes("--write-info-json"));
  assert.equal(p.args.at(-1), "https://www.youtube.com/watch?v=abc123&list=PL1");
  assert.equal(fetchPlan("https://vimeo.com/1", { dir: "/x" }).dir, "/x");
  assert.throws(() => fetchPlan("file:///etc/passwd"), /https:/);
});

test("a home with only Downloads/Daylight, from before the rename, keeps saving there", () => {
  const home = mkdtempSync(join(tmpdir(), "cmmns-home-"));
  mkdirSync(join(home, "Downloads", "Daylight"), { recursive: true });
  assert.equal(saveRoot(home), "Daylight");
  assert.equal(fetchPlan("https://www.youtube.com/watch?v=abc", {}, home).dir, join(home, "Downloads", "Daylight/youtube/"));
  mkdirSync(join(home, "Downloads", "CMMNS"));
  assert.equal(saveRoot(home), "CMMNS", "once both exist, the new name wins");
  assert.equal(saveRoot(join(home, "nobody")), "CMMNS", "a new machine starts on CMMNS");
});

test("the sidecar from yt-dlp's info keeps the description, channel, date and chapters", () => {
  const info = { title: "Glaze chemistry, part 2", description: "Silica, alumina, flux.\nThe ratios that matter.", uploader: "Clay Lab", uploader_id: "@claylab",
    upload_date: "20261002", webpage_url: "https://www.youtube.com/watch?v=abc123", chapters: [{ start_time: 0, title: "Intro" }, { start_time: 95, title: "Silica" }] };
  const meta = metaFromInfo(info, "https://youtu.be/abc123", "2026-10-25T00:00:00Z");
  assert.equal(meta.site, "youtube");
  assert.equal(meta.author.handle, "claylab");
  assert.equal(meta.postedAt, "2026-10-02T00:00:00.000Z");
  const md = sidecarMarkdown(meta, "claylab_2026-10-02_glaze.mp4");
  assert.ok(md.includes("> Silica, alumina, flux.\n> The ratios that matter."));
  assert.ok(md.includes("## Chapters\n\n00:00:00 Intro\n00:01:35 Silica"));
});

test("source-protection mode stops a fetch before yt-dlp runs", async () => {
  const { runFetch } = await import("../bin/lib/media-fetch.mjs");
  assert.throws(() => runFetch("https://www.youtube.com/watch?v=abc", {}, { ...process.env, DAYLIGHT_PROTECT: "1", YTDLP: "no-such-yt-dlp" }), /Source-protection mode is on/);
  assert.throws(() => runFetch("https://www.youtube.com/watch?v=abc", {}, { ...process.env, CMMNS_PROTECT: "1", YTDLP: "no-such-yt-dlp" }), /Source-protection mode is on/, "the new name works too");
});
