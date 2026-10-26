// `daylight media fetch`: the yt-dlp arguments and folder for an address, and the sidecar built from
// yt-dlp's description of the video. Nothing here runs yt-dlp or touches the network.
import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { fetchPlan, metaFromInfo } from "../bin/lib/media-fetch.mjs";
import { sidecarMarkdown } from "../src/core/media-meta.js";

test("a YouTube address saves into Downloads/Daylight/youtube with one video, no playlist", () => {
  const p = fetchPlan("https://www.youtube.com/watch?v=abc123&list=PL1", {}, "/home/a");
  assert.equal(p.dir, join("/home/a", "Downloads", "Daylight/youtube/"));
  assert.equal(p.site, "youtube");
  assert.ok(p.args.includes("--no-playlist") && p.args.includes("--write-info-json"));
  assert.equal(p.args.at(-1), "https://www.youtube.com/watch?v=abc123&list=PL1");
  assert.equal(fetchPlan("https://vimeo.com/1", { dir: "/x" }).dir, "/x");
  assert.throws(() => fetchPlan("file:///etc/passwd"), /https:/);
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
