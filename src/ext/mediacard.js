// The window's media rows for one post: first upload, first seen, the "From @account" credit,
// reverse search links, a Content Credentials check and video frames for reverse search. Every
// network step waits for a click, and each says what it sends and to whom.
(() => {
  "use strict";
  const day = (iso) => (iso ? iso.slice(0, 10) : "unknown");
  const when = (iso) => (iso ? iso.slice(0, 16).replace("T", " ") + " UTC" : "time unknown");
  const SEARCH = [
    ["Google Lens", (u) => "https://lens.google.com/uploadbyurl?url=" + encodeURIComponent(u), "https://lens.google.com/"],
    ["Bing", (u) => "https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:" + encodeURIComponent(u), "https://www.bing.com/visualsearch"],
    ["TinEye", (u) => "https://tineye.com/search?url=" + encodeURIComponent(u), "https://tineye.com/"],
    ["Yandex", (u) => "https://yandex.com/images/search?rpt=imageview&url=" + encodeURIComponent(u), "https://yandex.com/images/"],
  ];
  const SEARCH_NOTE = "Each link opens in a new tab. Clicking one sends this image's address to that service; nothing is sent before you click.";
  const CHECK_NOTE = "Reads the file this page already loaded, from the same address, without cookies. Nothing goes anywhere else.";
  const FRAME_NOTE = "Radar copies the frame to your clipboard and opens the service in a new tab. Paste it there (Ctrl+V); nothing is sent until you do.";
  const open = (id) => ({ links: [["open post", `https://x.com/i/status/${id}`]] });

  function seenRows(f) {
    if (!f) return [];
    const rows = [];
    if (f.first && !f.first.isThis) rows.push(["First seen", `@${f.first.handle || "unknown"}, ${when(f.first.at)} (${f.first.how === "from" ? "the post X credits it to" : "the earliest post with this upload in what you have viewed"})`], ["", open(f.first.id)]);
    else if (f.first && f.first.isThis) rows.push(["First seen", "here: this is the earliest post with this upload in what you have viewed"]);
    if (f.from && (!f.first || f.first.id !== f.from.id)) rows.push(["Re-shared from", `@${f.from.handle || "a post"}, ${when(f.from.at)} (X's "From" credit)`], ["", open(f.from.id)]);
    return rows;
  }

  function credentialRows(x) {
    if (!x.src) return [["Content Credentials", { note: x.type === "image" ? "this image is not on screen, so Radar has no loaded file to read" : "this video is streamed in pieces, so there is no single file to read" }]];
    const c = PBMedia.checkOf(x.src);
    if (!c) return [["Content Credentials", { action: ["Check this file", () => PBMedia.check(x.src), "Reading the file…"] }], ["", { note: CHECK_NOTE }]];
    if (c.state === "reading") return [["Content Credentials", { note: "Reading the file…" }]];
    return PB.credentialRows(c.result);
  }

  function frameRows(x, key) {
    if (!x.video) return [];
    const f = PBMedia.framesOf(key);
    if (!f) return [["Frames", { action: ["Take 4 frames", () => PBMedia.takeFrames(key, x.video), "Taking frames…"] }], ["", { note: "Frames come from the part of the video already loaded, for a reverse search of each one." }]];
    if (f.state === "reading") return [["Frames", { note: "Taking frames…" }]];
    const rows = f.error ? [["Frames", f.error]] : [];
    for (const fr of f.list) {
      rows.push([`Frame at ${Math.floor(fr.t / 60)}:${String(Math.floor(fr.t % 60)).padStart(2, "0")}`, { image: fr.url, alt: `video frame at ${fr.t} seconds` }]);
      rows.push(["", { actions: SEARCH.map(([label, , page]) => [label, () => PBMedia.searchFrame(fr, page)]) }]);
    }
    if (f.list.length) rows.push(["", { note: FRAME_NOTE }]);
    return rows;
  }

  // Rows for every piece of media in the post. node: the post element; tweet and trail as in card.js.
  function rows(m) {
    const T = m.tweet || {}, list = globalThis.PBMedia ? PBMedia.inPost(m.node, m.tweet) : [];
    const seen = T.media && globalThis.PBLogs ? PB.firstSeen(T, m.tweets || new Map(), PBLogs.trail()) : [];
    const out = [];
    for (const x of list) {
      const md = x.media || {};
      out.push([`${list.length > 1 ? `Media ${x.i + 1}` : "Media"}: ${x.type}`, md.uploaded ? `first uploaded to X ${day(md.uploaded)}` + (md.fromPost ? `, taken from a post of ${day(md.fromPostTime)}` : "") : "on this page"]);
      out.push(...seenRows(seen[x.i]));
      if (x.searchUrl) out.push(["Find earlier copies", { links: SEARCH.map(([label, f]) => [label, f(x.searchUrl)]) }], ["", { note: SEARCH_NOTE }]);
      out.push(...credentialRows(x), ...frameRows(x, `${T.id || "post"}:${x.i}`));
    }
    return out;
  }

  globalThis.PBMediaCard = Object.freeze({ rows });
})();
