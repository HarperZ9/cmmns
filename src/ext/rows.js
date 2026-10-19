// Extra account-card rows and chips from metadata the sites load but do not show: X post data
// (posting app, language, views, edits, Community Notes), extra X account counts, YouTube comment
// author data, and wording Radar has seen in other threads. Loaded before ui.js.
(() => {
  "use strict";
  const num = (x) => (x == null ? null : Number(x).toLocaleString());

  // Rows for the account card, given the badge model.
  function rows(m) {
    const R = m.reading || {}, T = m.tweet || {}, Y = m.yt || {};
    return [
      ["Posted from", T.client ? `${T.client}${PB.COMMON_CLIENTS.test(T.client) ? "" : " (not one of X's own apps)"}` : null],
      ["Language (X's detection)", T.lang || null],
      ["Views / likes / reposts / quotes", T.views != null ? [T.views, T.likes, T.reposts, T.quotes].map((x) => num(x) || "?").join(" / ") : null],
      ["Edited", T.edits ? `${T.edits} time${T.edits === 1 ? "" : "s"}` : null],
      ["Community Note", T.note || null],
      ["Profile picture", R.defaultAvatar ? "X's default (never set)" : null],
      ["Listed by", R.listedCount != null ? `${num(R.listedCount)} lists` + (R.followersCount >= 10000 && R.listedCount < 10 ? " (few for this many followers)" : "") : null],
      ["Likes given / media posts", R.likesCount != null ? `${num(R.likesCount)} / ${num(R.mediaCount) || "?"}` : null],
      ["Withheld in", R.withheldIn ? `${R.withheldIn} (X withholds this account there on legal demand)` : null],
      ["YouTube channel id", Y.channelId || null],
      ["YouTube badges", [Y.verified && "verified", Y.creator && "the video's own channel", Y.artist && "official artist", Y.member].filter(Boolean).join(", ") || null],
      ["Comment", Y.published ? `posted ${Y.published}${Y.edited ? ", edited" : ""}; ${Y.likes || 0} likes${Y.replies ? `, ${Y.replies} replies` : ""}` : null],
    ];
  }

  // One-click reverse image searches. Nothing is sent until the user clicks one; the click opens
  // that service in a new tab with the image's public address.
  const SEARCH = [
    ["Google Lens", (u) => "https://lens.google.com/uploadbyurl?url=" + encodeURIComponent(u)],
    ["TinEye", (u) => "https://tineye.com/search?url=" + encodeURIComponent(u)],
    ["Bing", (u) => "https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:" + encodeURIComponent(u)],
    ["Yandex", (u) => "https://yandex.com/images/search?rpt=imageview&url=" + encodeURIComponent(u)],
  ];
  const day = (iso) => (iso ? iso.slice(0, 10) : "unknown");

  function mediaChip(m, chip) {
    const T = m.tweet || {}, media = T.media || [];
    if (!media.length) return null;
    const old = PB.olderMedia(T);
    const rows = media.flatMap((x, i) => [
      [`${media.length > 1 ? `Item ${i + 1}: ` : ""}${x.type === "photo" ? "image" : x.type}`, `first uploaded to X on ${day(x.uploaded)}` + (x.fromPost ? `; taken from an earlier post made ${day(x.fromPostTime)}` : "")],
      ["Search for earlier copies", x.url ? { links: SEARCH.map(([label, f]) => [label, f(x.url)]) } : null],
    ]);
    rows.push(["How Radar knows", "X's ids carry their creation time, so the media id dates the upload and a reused post id dates the original. Reverse search finds copies posted elsewhere, often with the real date and place."]);
    rows.push(["What it does not prove", "An old upload can be honest (an archive photo, clearly labelled). A new upload can still be old footage or AI-made; Radar cannot tell real from generated media, so check the earliest copy you find."]);
    if (old.length) return chip(`media from ${day(old[0].uploaded)}`, "pb-warn", rows);
    return chip(media.some((x) => x.fromPost) ? "media from another post" : "check media", media.some((x) => x.fromPost) ? "pb-flag" : "pb-quiet", rows);
  }

  function stateChips(m, chip) {
    const hits = [...(m.domains || []).flatMap(PB.stateLinksOfDomain), ...PB.stateLinksOfHandle(m.handle)];
    return [...new Set(hits)].map((h) => chip(PB.stateLabel(h).chip, "pb-flag", [
      ["What it is", PB.stateLabel(h).says], ["Source", `${h.name}: ${h.source.title}${h.source.date ? ` (${h.source.date})` : ""}`], ["Read it", { links: [[h.source.url.replace(/^https?:\/\//, "").slice(0, 60), h.source.url]] }],
      ["What it does not prove", PB.STATE_DOES_NOT_PROVE[h.basis]],
    ]));
  }

  // Chips for metadata strong enough to show on the comment itself.
  function chips(m, chip) {
    const T = m.tweet || {}, out = [];
    const mc = mediaChip(m, chip);
    if (mc) out.push(mc);
    out.push(...stateChips(m, chip));
    if (T.note) out.push(chip("Community Note", "pb-flag", [["Note", T.note], ["Source", "X loaded a Community Note for this post. Notes are written and rated by X users."]]));
    if (T.client && !PB.COMMON_CLIENTS.test(T.client)) out.push(chip(`via ${T.client}`, "pb-flag", [["Source", "The app this post was sent from, in the data X loaded for the page. X no longer shows it."], ["What it is", "Scheduling tools, automation services and custom apps post this way."], ["What it does not prove", "News desks, brands and many people schedule posts with tools like these."]]));
    if (m.yt && m.yt.creator) out.push(chip("video's own channel", "pb-quiet", [["Source", "YouTube marks this comment as from the channel that posted the video."]]));
    return out;
  }

  // Panel lines for the video (YouTube) and links pushed across threads.
  function panelLines(video, pushed) {
    const out = [];
    if (video) {
      out.push(["Channel", [video.channel, video.subscribers, video.channelBadges].filter(Boolean).join(" · ") || null]);
      out.push(["Funding (YouTube panel)", video.funding || null]);
      out.push(["Context panels", (video.contextPanels || []).filter((p) => p !== video.funding).join(" | ") || null]);
      out.push(["Paid promotion", video.paidPromotion || null]);
      out.push(["Creator disclosure", video.synthetic ? `${video.synthetic} (the uploader says the video contains altered or AI-made content)` : null]);
      out.push(["Published", [video.published, video.category, video.views != null ? `${num(video.views)} views` : null].filter(Boolean).join(" · ") || null]);
    }
    if (pushed && pushed.length) out.push(["Links pushed across threads", pushed.slice(0, 4).map((p) => `${p.domain}: ${p.authors} accounts in ${p.threads} threads you viewed`).join("; ")]);
    return out.filter(([, t]) => t);
  }

  globalThis.PBRows = Object.freeze({ rows, chips, panelLines });
})();
