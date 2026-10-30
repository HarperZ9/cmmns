// A simulated X for page tests and the save-timing harness: posts drawn as X draws them (article,
// a status link with its time, the text, the pictures), and X's own GraphQL responses for each page of
// the timeline, which the page fetches as it is scrolled, so sniff.js and xdata see what they see on X.
// The likes page loads 20 posts at a time when the reader nears the end, and drops posts far above the
// window as X does. failAfter makes the timeline answer 429 after that many posts and draw X's error
// line with a Retry button. Media bytes are generated: a JPEG or MP4 header and filler of a set size.
import { randomBytes } from "node:crypto";

export const PAGE_SIZE = 20;

// A post: { id, handle, text, posted, media: [{ type: "photo"|"video", url, mp4?, size }] }.
export function makePost(id, { handle = "painter", text = `Post ${id}.`, posted = null, media = null } = {}) {
  const day = String((Number(id) % 27) + 1).padStart(2, "0");
  return { id: String(id), handle, text, posted: posted || `2026-0${(Number(id) % 9) + 1}-${day}T10:00:00.000Z`,
    media: media || [{ type: "photo", url: `https://pbs.twimg.com/media/L${id}?format=jpg&name=orig`, size: 30000 }] };
}

// X's Tweet object for a post, the shape tweetsIn (src/core/xdata.js) reads.
export function tweetJson(p) {
  const media = p.media.map((m, i) => ({ id_str: `${p.id}${i}`, type: m.type === "video" ? "video" : "photo", media_url_https: m.type === "video" ? `https://pbs.twimg.com/ext_tw_video_thumb/${p.id}/pu/img/t.jpg` : m.url.replace(/\?.*$/, ".jpg"),
    ...(m.type === "video" ? { video_info: { variants: [{ content_type: "video/mp4", bitrate: 2176000, url: m.mp4 }] } } : {}) }));
  return { __typename: "Tweet", rest_id: p.id, source: "<a href=\"https://x.com\">Web App</a>",
    core: { user_results: { result: { __typename: "User", core: { screen_name: p.handle }, legacy: { screen_name: p.handle } } } },
    legacy: { created_at: new Date(p.posted).toUTCString().replace("GMT", "+0000"), full_text: p.text, lang: "en", favorite_count: 3, entities: { urls: [] }, ...(media.length ? { extended_entities: { media } } : {}) } };
}

// One page of the Likes timeline as X sends it: entries of tweet results and a bottom cursor.
export const likesJson = (posts, next) => ({ data: { user: { result: { timeline: { timeline: { instructions: [{ type: "TimelineAddEntries", entries: [
  ...posts.map((p) => ({ entryId: `tweet-${p.id}`, content: { itemContent: { tweet_results: { result: tweetJson(p) } } } })),
  ...(next != null ? [{ entryId: `cursor-bottom-${next}`, content: { value: String(next), cursorType: "Bottom" } }] : [])] }] } } } } } });

// The post as X draws it. A video is drawn as X's player with a poster; its file is in the JSON.
export function article(p) {
  const pics = p.media.filter((m) => m.type === "photo").map((m) => `<img alt="" src="${m.url.replace("name=orig", "name=small")}" width="200" height="200">`).join("");
  const vids = p.media.filter((m) => m.type === "video").map(() => `<div data-testid="videoPlayer"><video poster="https://pbs.twimg.com/ext_tw_video_thumb/${p.id}/pu/img/t.jpg"></video></div>`).join("");
  return `<article data-id="${p.id}"><a href="/${p.handle}"><span>${p.handle}</span></a><a href="/${p.handle}/status/${p.id}"><time datetime="${p.posted}"></time></a>`
    + `<div data-testid="tweetText" lang="en">${p.text}</div>${pics}${vids}</article>`;
}

// The page script: draws each timeline page from X's JSON (fetched through the page's own fetch, which
// sniff.js wraps), loads the next page near the end, keeps at most 60 posts drawn, and draws X's error
// state when the timeline answers with an error.
const CLIENT = `(() => {
  let cursor = 0, loading = false, done = false, failed = false;
  const feed = () => document.getElementById("feed");
  async function more() {
    if (loading || done || failed) return;
    loading = true;
    try {
      const res = await fetch("/i/api/graphql/sim/Likes?cursor=" + cursor);
      if (!res.ok) { failed = true; feed().insertAdjacentHTML("beforeend", '<div data-testid="error-detail"><span>Something went wrong. Try reloading.</span><button role="button"><span>Retry</span></button></div>'); return; }
      const j = await res.json(), entries = j.data.user.result.timeline.timeline.instructions[0].entries;
      const next = entries.find((e) => e.entryId.startsWith("cursor-bottom"));
      const html = entries.filter((e) => e.entryId.startsWith("tweet-")).map((e) => window.__draw(e.content.itemContent.tweet_results.result)).join("");
      feed().insertAdjacentHTML("beforeend", html);
      if (next) cursor = Number(next.content.value); else done = true;
      const all = [...feed().querySelectorAll("article")];
      for (const a of all.slice(0, Math.max(0, all.length - 60))) { const h = a.offsetHeight; a.remove(); document.getElementById("spacer").style.height = (parseFloat(document.getElementById("spacer").style.height || "0") + h) + "px"; }
    } finally { loading = false; }
  }
  addEventListener("scroll", () => { if (innerHeight + scrollY > document.documentElement.scrollHeight - 1600) more(); });
  addEventListener("DOMContentLoaded", more);
})();`;

// The draw function the client uses, the same markup as article() from X's JSON.
const DRAW = `window.__draw = (t) => {
  const L = t.legacy, h = t.core.user_results.result.core.screen_name, media = ((L.extended_entities || {}).media || []);
  const pics = media.filter((m) => m.type === "photo").map((m) => '<img alt="" src="' + m.media_url_https.replace(/\\.jpg$/, "?format=jpg&name=small") + '" width="200" height="200">').join("");
  const vids = media.filter((m) => m.type === "video").map((m) => '<div data-testid="videoPlayer"><video poster="' + m.media_url_https + '"></video></div>').join("");
  return '<article data-id="' + t.rest_id + '" style="min-height:420px"><a href="/' + h + '"><span>' + h + '</span></a><a href="/' + h + '/status/' + t.rest_id + '"><time datetime="' + new Date(L.created_at).toISOString() + '"></time></a><div data-testid="tweetText" lang="en">' + L.full_text + '</div>' + pics + vids + '</article>';
};`;

export const likesPageHtml = (user, head = "") => `<!doctype html><html><head><meta charset="utf-8"><title>Posts liked by ${user} / X</title>${head}<script>${DRAW}${CLIENT}</script></head>
<body><div id="spacer"></div><main id="feed" data-testid="primaryColumn"></main></body></html>`;

// Answers the timeline's requests: { status, json } for a cursor. failAfter: the posts served before 429.
export function timelineAnswer(posts, cursor, { failAfter = Infinity } = {}) {
  const from = Number(cursor) || 0;
  if (from >= failAfter) return { status: 429, json: { errors: [{ message: "Rate limit exceeded", code: 88 }] } };
  const page = posts.slice(from, from + PAGE_SIZE), next = from + PAGE_SIZE < posts.length ? from + PAGE_SIZE : null;
  return { status: 200, json: likesJson(page, next) };
}

// Bytes for a media address: a JPEG or an MP4 of the size the post gives, the same bytes every time.
const made = new Map();
export function mediaBytes(kind, size, key) {
  const k = `${kind}:${size}:${key}`;
  if (made.has(k)) return made.get(k);
  const fill = randomBytes(Math.max(0, size - 64));
  const out = kind === "video"
    ? Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom"), Buffer.from([0, 0, 2, 0]), Buffer.from("isomiso2"), Buffer.alloc(4), Buffer.from("mdat"), fill])
    : Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]), Buffer.from("JFIF\0"), Buffer.from([1, 1, 0, 0, 1, 0, 1, 0, 0]), Buffer.from([0xff, 0xfe, 0, 18]), Buffer.from(key.padEnd(16).slice(0, 16)), fill, Buffer.from([0xff, 0xd9])]);
  if (kind === "video") out.writeUInt32BE(out.length - 24, 24);
  made.set(k, out);
  return out;
}
