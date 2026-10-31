// Save timing in a real Chromium with the unpacked extension loaded (R&D only; nothing here ships).
// A local HTTPS server (HTTP/2, as X's hosts are) answers for x.com, pbs.twimg.com and video.twimg.com (the browser maps those
// names to 127.0.0.1 and accepts the throwaway certificate), with a fixed first-byte delay per
// response to stand in for a CDN round trip. Three cases, each timed from the save's start until
// every file is complete on disk: 1 picture (one post), 4 files (a gallery: three pictures and a video),
// and 20 files (a library of 20 posts, mixed pictures and videos).
//
//   node scripts/eval/save-timing.mjs --chromium <chrome.exe> --cert <cert.pem> --key <key.pem> --work <dir> [--latency 60] [--runs 3]
import { createSecureServer } from "node:http2";
import { readFileSync } from "node:fs";
import { openTab, untilFiles } from "./ext-harness.mjs";
import { join, resolve } from "node:path";
import { tweetJson, mediaBytes } from "../../tests/likes-fixture.js";

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const EXT = resolve(arg("--ext", join(import.meta.dirname, "..", "..", "src", "ext"))), WORK = resolve(arg("--work"));
const LATENCY = Number(arg("--latency", 60)), RUNS = Number(arg("--runs", 3)), PORT = 9700 + (process.pid % 200);
const SERVER_PORT = Number(arg("--server-port", 443));

// Mixed sizes: small and large pictures, a short video and one past the 32 MB read limit.
const pic = (id, size) => ({ type: "photo", url: `https://pbs.twimg.com/media/T${id}s${size}?format=jpg&name=orig`, size });
const vid = (id, size) => ({ type: "video", mp4: `https://video.twimg.com/ext_tw_video/${id}/pu/vid/1280x720/v${id}s${size}.mp4`, size });
const SIZES = [40e3, 300e3, 1.5e6, 4e6, 800e3];
const post = (id, media) => ({ id: String(id), handle: "timing", text: `Timing post ${id}.`, posted: "2026-10-01T10:00:00.000Z", media });
const CASES = {
  one: [post(1001, [pic(1001, 1.5e6)])],
  four: [post(1002, [pic(10021, 40e3), pic(10022, 300e3), pic(10023, 4e6), vid(10024, 12e6)])],
  twenty: Array.from({ length: 20 }, (_, i) => post(2000 + i, [i === 7 ? vid(2000 + i, 12e6) : i === 15 ? vid(2000 + i, 45e6) : pic(2000 + i, SIZES[i % SIZES.length])])),
};
const article = (p) => `<article><a href="/${p.handle}"><span>${p.handle}</span></a><a href="/${p.handle}/status/${p.id}"><time datetime="${p.posted}"></time></a><div data-testid="tweetText" lang="en">${p.text}</div>`
  + p.media.map((m) => (m.type === "photo" ? `<img alt="" src="${m.url.replace("name=orig", "name=small")}" width="200" height="200">` : `<div data-testid="videoPlayer"><video poster="https://pbs.twimg.com/ext_tw_video_thumb/${m.mp4.match(/v(\d+)s/)[1]}/pu/img/t.jpg"></video></div>`)).join("") + "</article>";
const page = (posts, title) => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><script>addEventListener("DOMContentLoaded", () => fetch("/i/api/graphql/sim/TweetDetail?ids=${posts.map((p) => p.id).join(",")}"));</script></head><body><main id="feed">${posts.map(article).join("")}</main></body></html>`;
const ALL = Object.values(CASES).flat();
const PAGES = { "/timing/status/1001": page(CASES.one, "timing on X"), "/timing/status/1002": page(CASES.four, "timing on X"), "/timing": page(CASES.twenty, "timing (@timing) / X") };

function answer(req, res) {
  const authority = req.headers.host || req.headers[":authority"], u = new URL(req.url, `https://${authority}`), host = authority.split(":")[0];
  const send = (status, type, body, extra = {}) => setTimeout(() => { res.writeHead(status, { "content-type": type, "access-control-allow-origin": "*", "access-control-expose-headers": "content-range, content-length", "accept-ranges": "bytes", ...extra }); res.end(body); }, LATENCY);
  if (host === "x.com" && PAGES[u.pathname]) return send(200, "text/html; charset=utf-8", PAGES[u.pathname]);
  if (host === "x.com" && u.pathname.startsWith("/i/api/graphql/")) {
    const ids = (u.searchParams.get("ids") || "").split(","), posts = ALL.filter((p) => ids.includes(p.id));
    return send(200, "application/json", JSON.stringify({ data: { threaded_conversation_with_injections_v2: { instructions: [{ entries: posts.map((p) => ({ content: { itemContent: { tweet_results: { result: tweetJson(p) } } } })) }] } } }));
  }
  const m = /s(\d+)(?:\.mp4)?$/.exec(u.pathname.split("/").pop().replace(/\?.*/, ""));
  if ((host === "pbs.twimg.com" || host === "video.twimg.com") && (m || /thumb/.test(u.pathname))) {
    const kind = host === "video.twimg.com" ? "video" : "image", body = mediaBytes(kind, m ? Number(m[1]) : 2000, u.pathname);
    const type = kind === "video" ? "video/mp4" : "image/jpeg", range = /bytes=(\d+)-(\d*)/.exec(req.headers.range || "");
    if (range) { const a = Number(range[1]), b = Math.min(body.length - 1, range[2] ? Number(range[2]) : body.length - 1); return send(206, type, body.subarray(a, b + 1), { "content-range": `bytes ${a}-${b}/${body.length}`, "content-length": b - a + 1 }); }
    return send(200, type, body, { "content-length": body.length });
  }
  send(404, "text/plain", "");
}

const START = {
  one: `(async () => { const t = PBQuickSites.postMedia(document.querySelector("article")).items[0]; const r = await PBQuickSave.start(t, { quiet: true }); return r.ok; })()`,
  four: `(async () => { const { title, items } = PBQuickSites.postMedia(document.querySelector("article")); const rs = await Promise.all(items.map((t, index) => PBQuickSave.start(t, { title, index, total: items.length, quiet: true, oneSidecar: true }))); await PBQuickSave.postSidecar(rs.find((r) => r.meta).meta, rs.flatMap((r) => r.names || [])); return rs.filter((r) => r.ok).length; })()`,
  twenty: `(async () => { await PBLibrary.start(PB.libraryOf(location.href)); while (PBLibrary.status().saved + PBLibrary.status().skipped < 20) await new Promise((r) => setTimeout(r, 10)); await PBLibrary.stop("timing"); return PBLibrary.status().saved; })()`,
};
const URLS = { one: "https://x.com/timing/status/1001", four: "https://x.com/timing/status/1002", twenty: "https://x.com/timing" };
const EXPECT = { one: 2, four: 5, twenty: 42 };   // files plus sidecars (and index.jsonl and LIBRARY.md)

async function once(which, run) {
  const t = await openTab({ chromium: arg("--chromium"), ext: EXT, work: WORK, stamp: `${which}-${run}-${process.pid}`, url: URLS[which], port: PORT, serverPort: SERVER_PORT });
  try {
    const t0 = Date.now();
    const result = await t.js(START[which]);
    const resolved = Date.now() - t0;
    const files = await untilFiles(t.dl, EXPECT[which]);
    return { which, run, resolved, onDisk: Date.now() - t0, files: files.length, bytes: files.reduce((s, f) => s + f.size, 0), result };
  } finally { await t.close(); }
}

const server = createSecureServer({ cert: readFileSync(arg("--cert")), key: readFileSync(arg("--key")), allowHTTP1: true }, answer).listen(SERVER_PORT);
const rows = [];
try {
  for (const which of (arg("--cases", "one,four,twenty")).split(",")) for (let run = 1; run <= RUNS; run++) { const r = await once(which, run); rows.push(r); console.log(JSON.stringify(r)); }
} finally { server.close(); }
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
for (const which of new Set(rows.map((r) => r.which))) { const rs = rows.filter((r) => r.which === which); console.log(`${which}: median on disk ${med(rs.map((r) => r.onDisk))} ms (runs ${rs.map((r) => r.onDisk).join(", ")}), files ${rs[0].files}`); }
