// Save all likes, timed end to end in a real Chromium with the unpacked extension (R&D only; nothing
// here ships). 200 liked posts of mixed sizes on the simulated likes page (tests/likes-fixture.js),
// served over HTTP/2 from 127.0.0.1 for x.com, pbs.twimg.com and video.twimg.com with a fixed
// first-byte delay. Three paths over the same posts and bytes:
//   before   the library capture as it was (one post at a time) on a profile page holding the 200 posts
//   browser  Save all likes, "Save in the browser" (four posts at a time through the page's saver)
//   cli      Save all likes writes the manifest; `cmmns likes fetch` fetches the files (HTTP/2, --jobs)
// Scrolling is driven as fast as the page loads here, so the numbers are save throughput; the paced
// scroll on the real site is a separate ceiling (see project-docs/SAVE-ALL-LIKES.md).
//
//   node scripts/eval/likes-timing.mjs --chromium <chrome.exe> --cert <cert.pem> --key <key.pem> --work <dir> [--ext <before ext>] [--paths before,browser,cli] [--jobs 8]
import { createSecureServer } from "node:http2";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { openTab, untilFiles, sleep } from "./ext-harness.mjs";
import { makePost, article, tweetJson, likesPageHtml, timelineAnswer, mediaBytes } from "../../tests/likes-fixture.js";
import { fetchLikes } from "../../bin/lib/likes.mjs";

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const NEW = resolve(join(import.meta.dirname, "..", "..", "src", "ext")), OLD = resolve(arg("--ext", NEW)), WORK = resolve(arg("--work"));
const LATENCY = Number(arg("--latency", 60)), PORT = 9500 + (process.pid % 200), CERT = readFileSync(arg("--cert"));
const SERVER_PORT = Number(arg("--server-port", 443));
const SIZES = [120e3, 450e3, 900e3, 1.6e6];
const mediaFor = (i, id) => (i % 10 === 9 ? [] : i % 10 >= 7 ? [{ type: "video", mp4: `https://video.twimg.com/ext_tw_video/${id}/pu/vid/1280x720/v${id}s${i % 10 === 7 ? 3e6 : 7e6}.mp4` }]
  : [{ type: "photo", url: `https://pbs.twimg.com/media/L${id}s${SIZES[i % 4]}?format=jpg&name=orig` }]);
const POSTS = Array.from({ length: 200 }, (_, i) => { const id = String(1850000000000000000n + BigInt(i)); return makePost(id, { handle: "likesprofile", text: `Liked post ${i}.`, media: mediaFor(i, id) }); });
const MEDIA = POSTS.reduce((n, p) => n + p.media.length, 0);
const profile = `<!doctype html><html><head><meta charset="utf-8"><title>likesprofile (@likesprofile) / X</title><script>addEventListener("DOMContentLoaded", () => fetch("/i/api/graphql/sim/TweetDetail"));</script></head><body><main id="feed">${POSTS.map(article).join("")}</main></body></html>`;

function answer(req, res) {
  const authority = req.headers.host || req.headers[":authority"], u = new URL(req.url, `https://${authority}`), host = authority.split(":")[0];
  const send = (status, type, body, extra = {}) => setTimeout(() => { res.writeHead(status, { "content-type": type, "access-control-allow-origin": "*", "access-control-expose-headers": "content-range, content-length", ...extra }); res.end(body); }, LATENCY);
  if (host === "x.com" && u.pathname === "/i/history/likes") return send(200, "text/html; charset=utf-8", likesPageHtml("me"));
  if (host === "x.com" && u.pathname === "/likesprofile") return send(200, "text/html; charset=utf-8", profile);
  if (host === "x.com" && u.pathname.endsWith("/TweetDetail")) return send(200, "application/json", JSON.stringify({ data: { entries: POSTS.map((p) => ({ tweet_results: { result: tweetJson(p) } })) } }));
  if (host === "x.com" && u.pathname.endsWith("/Likes")) { const a = timelineAnswer(POSTS, u.searchParams.get("cursor")); return send(a.status, "application/json", JSON.stringify(a.json)); }
  const m = /s(\d+)(?:\.mp4)?$/.exec(u.pathname.split("/").pop());
  if (m || /thumb/.test(u.pathname)) {
    const kind = host === "video.twimg.com" ? "video" : "image", body = mediaBytes(kind, m ? Number(m[1]) : 2000, u.pathname);
    const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range || ""), type = kind === "video" ? "video/mp4" : "image/jpeg";
    if (range) { const a = Number(range[1]), b = Math.min(body.length - 1, range[2] ? Number(range[2]) : body.length - 1); return send(206, type, body.subarray(a, b + 1), { "content-range": `bytes ${a}-${b}/${body.length}`, "content-length": b - a + 1 }); }
    return send(200, type, body, { "content-length": body.length });
  }
  send(404, "text/plain", "");
}

const bytesUnder = (d) => { let n = 0; const w = (x) => { for (const e of readdirSync(x, { withFileTypes: true })) { const p = join(x, e.name); if (e.isDirectory()) w(p); else if (!/\.(md|jsonl)$/.test(e.name)) n += statSync(p).size; } }; w(d); return n; };
const SCROLL = `(async () => { for (let i = 0; i < 4000 && !(PBLikes.status().found >= 200); i++) { scrollTo(0, document.documentElement.scrollHeight); window.dispatchEvent(new Event("scroll")); await new Promise((r) => setTimeout(r, 50)); } return PBLikes.status().found; })()`;

const RUN = {
  async before(t) {
    await t.js(`(async () => { await PBLibrary.start(PB.libraryOf(location.href)); while (PBLibrary.status().saved + PBLibrary.status().skipped < 200) await new Promise((r) => setTimeout(r, 20)); await PBLibrary.stop("timing"); return 1; })()`);
    await untilFiles(t.dl, MEDIA + 200 + 2, 600000);
  },
  async browser(t) {
    await t.js(`PBLikes.start("browser").then(() => 1)`);
    await t.js(SCROLL);
    await t.js(`(async () => { while (PBLikes.pending() || PBLikes.status().saved + PBLikes.status().failed < PBLikes.status().listed) await new Promise((r) => setTimeout(r, 20)); await PBLikes.stop("timing"); return 1; })()`);
    await untilFiles(t.dl, MEDIA + 200 + 1, 600000);
  },
  async cli(t) {
    await t.js(`PBLikes.start("manifest").then(() => 1)`);
    await t.js(SCROLL);
    await t.js(`PBLikes.stop("timing").then(() => 1)`);
    await untilFiles(t.dl, 1, 60000);
    t.discovered = Date.now();
    // The command line asks the media hosts by name; on another port here, the manifest says so.
    if (SERVER_PORT !== 443) { const dir = join(t.dl, "CMMNS", "library", "x-likes"); for (const n of readdirSync(dir)) writeFileSync(join(dir, n), readFileSync(join(dir, n), "utf8").replace(/https:\/\/(pbs|video)\.twimg\.com\//g,`https://$1.twimg.com:${SERVER_PORT}/`)); }
    const r = await fetchLikes(["fetch", "--dir", join(t.dl, "CMMNS"), "--jobs", arg("--jobs", "8")], { env: { CMMNS_PROTECT: "0" }, log: () => {}, tls: { ca: CERT, lookup: (h, o, cb) => (o && o.all ? cb(null, [{ address: "127.0.0.1", family: 4 }]) : cb(null, "127.0.0.1", 4)) } });
    t.stages = r.stages;
  },
};

const server = createSecureServer({ cert: CERT, key: readFileSync(arg("--key")), allowHTTP1: true }, answer).listen(SERVER_PORT);
try {
  for (const path of arg("--paths", "before,browser,cli").split(",").filter((p) => RUN[p])) {
    const t = await openTab({ chromium: arg("--chromium"), ext: path === "before" ? OLD : NEW, work: WORK, stamp: `likes-${path}-${process.pid}`, url: path === "before" ? "https://x.com/likesprofile" : "https://x.com/i/history/likes", port: PORT, serverPort: SERVER_PORT });
    try {
      const t0 = Date.now();
      await RUN[path](t);
      const secs = (Date.now() - t0) / 1000, mb = bytesUnder(t.dl) / 1048576;
      const stages = t.stages || (path === "browser" ? await t.js("PBLikes.stages()") : null);
      console.log(JSON.stringify({ path, posts: 200, files: MEDIA, seconds: +secs.toFixed(2), likesPerMinute: Math.round(200 / (secs / 60)), mbPerSecond: +(mb / secs).toFixed(1), mb: +mb.toFixed(1),
        ...(t.discovered ? { discoverSeconds: +((t.discovered - t0) / 1000).toFixed(2) } : {}), stages }));
    } finally { await t.close(); await sleep(500); }
  }
  if (arg("--hold")) await sleep(Number(arg("--hold")) * 1000);   // keeps the server up for a manual look
} finally { server.close(); }
