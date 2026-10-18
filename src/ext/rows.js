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

  // Chips for metadata strong enough to show on the comment itself.
  function chips(m, chip) {
    const T = m.tweet || {}, out = [];
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
      out.push(["Published", [video.published, video.category, video.views != null ? `${num(video.views)} views` : null].filter(Boolean).join(" · ") || null]);
    }
    if (pushed && pushed.length) out.push(["Links pushed across threads", pushed.slice(0, 4).map((p) => `${p.domain}: ${p.authors} accounts in ${p.threads} threads you viewed`).join("; ")]);
    return out.filter(([, t]) => t);
  }

  globalThis.PBRows = Object.freeze({ rows, chips, panelLines });
})();
