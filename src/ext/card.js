// The account card: everything the site discloses about the account and the post, plus Radar's
// evidence, in plain sections. It never shows or guesses demographics (race, religion, ethnicity,
// gender, age): the platforms do not disclose them, and guessing them about a person is profiling.
(() => {
  "use strict";
  const num = (x) => (x == null ? null : Number(x).toLocaleString());
  const day = (iso) => (iso ? iso.slice(0, 10) : "unknown");
  const SEARCH = [
    ["Google Lens", (u) => "https://lens.google.com/uploadbyurl?url=" + encodeURIComponent(u)],
    ["TinEye", (u) => "https://tineye.com/search?url=" + encodeURIComponent(u)],
    ["Bing", (u) => "https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:" + encodeURIComponent(u)],
    ["Yandex", (u) => "https://yandex.com/images/search?rpt=imageview&url=" + encodeURIComponent(u)],
  ];

  function where(m) {
    const R = m.reading || {}, A = m.activity;
    const none = m.site && !m.site.hasLocation ? `${m.site.name} does not show this` : m.reading ? "not shown" : null;
    return [
      ["Based in (X label)", R.basedIn || none],
      ["Connected via", R.connectedVia || null],
      ["Profile says", R.profileLocation || null],
      ["VPN or proxy", R.proxyNote ? "X notes the location may not be accurate" : null],
      ["Active hours (inferred)", A && A.activeHours ? `fit a UTC${A.activeHours.utcOffset >= 0 ? "+" : ""}${A.activeHours.utcOffset} waking day (${Math.round(A.activeHours.fit * 100)}% of ${A.activeHours.posts} posts seen)` : null],
    ];
  }

  function account(m) {
    const R = m.reading || {}, Y = m.yt || {};
    const age = R.joinDate ? PB.ageDays(R.joinDate) : null;
    return [
      ["Joined", R.joinDate ? `${R.joinDate.slice(0, 7)} (${age} days ago)` : null],
      ["Followers / following", R.followersCount != null ? `${num(R.followersCount)} / ${num(R.followingCount)}` : null],
      ["Posts", R.postsCount != null ? `${num(R.postsCount)}${age ? ` (about ${Math.round(R.postsCount / Math.max(1, age))} a day)` : ""}` : null],
      ["Checkmark", R.verifiedType ? ({ Blue: "blue (paid subscription)", Business: "gold (organisation)", Government: "grey (government)" }[R.verifiedType] || R.verifiedType) : null],
      ["Label", R.xLabel || m.pageLabel ? `${R.xLabel || m.pageLabel} account` : null],
      ["Category", R.category || null],
      ["Account type", [R.professionalType && `${R.professionalType} account`, R.squareAvatar && "square avatar (X's mark for organisations)"].filter(Boolean).join(", ") || null],
      ["ID verified", R.identityVerified ? "yes, X says it verified a government ID" : null],
      ["Why verified (X)", R.verifiedReason || null],
      ["Affiliates", R.affiliatesCount ? `${num(R.affiliatesCount)} accounts carry this account's affiliate badge` : null],
      ["Creator subscribers", R.creatorSubscriptions ? num(R.creatorSubscriptions) : null],
      ["Pinned post", R.pinnedPost ? { links: [["open", `https://x.com/i/status/${R.pinnedPost}`]] } : null],
      ["Karma", R.karma != null ? `${num(R.karma)}${R.postKarma != null ? ` (posts ${num(R.postKarma)}, comments ${num(R.commentKarma)})` : ""}` : null],
      ["Reddit", [R.emailVerified === false && "email not verified", R.premium && "Reddit Premium", R.moderator && "moderates communities", R.employee && "Reddit employee", R.suspended && "suspended", R.unavailable && "account unavailable"].filter(Boolean).join(", ") || null],
      ["Username changes", R.nameChanges != null ? String(R.nameChanges) : null],
      ["Listed by", R.listedCount != null ? `${num(R.listedCount)} lists` : null],
      ["Profile picture", R.defaultAvatar ? "never set" : null],
      ["Withheld in", R.withheldIn ? `${R.withheldIn} (on legal demand)` : null],
      ["Affiliate of", R.affiliateOf || R.affiliate || null],
      ["Bio", R.bio ? R.bio.slice(0, 200) : null],
      ["Website", R.website || null],
      ["YouTube", [Y.verified && "verified", Y.creator && "the video's own channel", Y.artist && "official artist", Y.member].filter(Boolean).join(", ") || null],
    ];
  }

  function post(m) {
    const T = m.tweet || {}, Y = m.yt || {};
    const rows = [
      ["Posted", m.posted ? `${m.posted.slice(0, 16).replace("T", " ")} UTC` : (Y.published ? `${Y.published}${Y.edited ? ", edited" : ""}` : null)],
      ["Sent from", T.client || null],
      ["Language (X)", T.lang || null],
      ["Views · likes · reposts", T.views != null ? [T.views, T.likes, T.reposts].map((x) => num(x) || "?").join(" · ") : (Y.likes ? `${Y.likes} likes` : null)],
      ["Edited", T.edits ? `${T.edits} time${T.edits === 1 ? "" : "s"}` : null],
    ];
    (T.media || []).forEach((x, i) => {
      rows.push([`${(T.media.length > 1 ? `Media ${i + 1}` : "Media")}: ${x.type === "photo" ? "image" : x.type}`, `first uploaded ${day(x.uploaded)}` + (x.fromPost ? `, taken from a post of ${day(x.fromPostTime)}` : "")]);
      if (x.url) rows.push(["Find earlier copies", { links: SEARCH.map(([label, f]) => [label, f(x.url)]) }]);
    });
    return rows;
  }

  // The source trail: upstream pointers X records, then how the upload and links spread.
  const when = (iso) => (iso ? iso.slice(0, 16).replace("T", " ") : "time unknown");
  const open = (id) => ({ links: [["open post", `https://x.com/i/status/${id}`]] });
  function trail(m) {
    const T = m.trail;
    if (!T) return [];
    const rows = [];
    for (const st of T.steps) {
      if (st.kind === "uploaded") { rows.push(["Upload", `${st.type === "photo" ? "image" : st.type || "media"} first uploaded ${when(st.at)} UTC`]); continue; }
      rows.push([st.kind === "quotes" ? "Quotes" : st.kind === "reposts" ? "Reposts" : "Media from", `${st.handle ? "@" + st.handle : "a post"}, ${when(st.at)} UTC`]);
      rows.push(["", open(st.id)]);
    }
    for (const sp of T.media) {
      rows.push(["This upload", sp.isFirst ? `first seen here; ${sp.posts} post${sp.posts === 1 ? "" : "s"} by ${sp.accounts} account${sp.accounts === 1 ? "" : "s"} carry it` : `in ${sp.posts} posts by ${sp.accounts} accounts you have seen; first by @${sp.first.handle} at ${when(sp.first.at)} UTC`]);
      if (!sp.isFirst) rows.push(["", open(sp.first.id)]);
    }
    for (const l of T.links) {
      let d = l.url; try { d = new URL(l.url).hostname.replace(/^www\./, ""); } catch { /* keep */ }
      rows.push(["Link", l.spread && l.spread.posts > 1 ? `${d}: in ${l.spread.posts} posts by ${l.spread.accounts} accounts; first by @${l.spread.first.handle}` : d]);
    }
    return rows;
  }

  // How the account posts, from its posts X loaded (src/core/pattern.js).
  function posting(m) {
    const P = (m.reading || {}).pattern;
    if (!P) return [];
    const pc = (x) => `${Math.round(x * 100)}%`;
    const gap = P.medianGapSec == null ? null : P.medianGapSec < 120 ? `${P.medianGapSec} s` : P.medianGapSec < 7200 ? `${Math.round(P.medianGapSec / 60)} min` : `${Math.round(P.medianGapSec / 3600)} h`;
    return [
      ["Posts by hour", P.hourHist ? { hours: P.hourHist } : null],
      ["Last 14 days", P.daily ? { days: P.daily } : null],
      ["Sent from", P.clients.length ? { stack: P.clients.map((c) => ({ label: c.name, share: c.share })) } : null],
      ["Posts seen", `${P.posts} from ${P.from.slice(0, 10)} to ${P.to.slice(0, 10)} (about ${P.perDay} a day)`],
      ["Mix", `reposts ${pc(P.reposts)}, replies ${pc(P.replies)}, quotes ${pc(P.quotes)}, with media ${pc(P.media)}`],
      ["Typical gap", gap ? `${gap} between posts` : null],
      ["Hours active", `${P.activeUtcHours} of 24 UTC hours across ${P.days} days`],
      ["Languages", P.langs.map((l) => `${l.lang} ${pc(l.share)}`).join(", ") || null],
    ];
  }

  function history(m) {
    const A = m.activity;
    if (!A || !A.threads) return [];
    return [
      ["Seen by Radar", `in ${A.threads} thread${A.threads === 1 ? "" : "s"} you viewed since ${A.firstSeen}` + (A.medianDelay != null ? `; replies a median ${A.medianDelay} s after the post` : "")],
      ["Often alongside", A.alongside.length ? A.alongside.map((x) => `@${x.handle} (${x.n})`).join(", ") : null],
    ];
  }

  // How this account compares with the other repliers Radar has read in this thread.
  function compare(m) {
    const C = m.thread, R = m.reading || {};
    if (!C || C.n < 5) return [];
    const age = R.joinDate ? PB.ageDays(R.joinDate) : null;
    const same = R.basedIn ? C.places[R.basedIn] || 0 : null;
    return [
      ["Account age", age != null && C.medianAgeDays != null ? `${age.toLocaleString()} days; the thread's median is ${C.medianAgeDays.toLocaleString()} (${C.n} accounts read)` : null],
      ["Same label", same != null ? `${same} of ${C.n} accounts read here are labelled ${R.basedIn}` : null],
      ["Flagged here", `${C.flagged} of ${C.n} accounts read in this thread have at least one flag`],
    ];
  }

  // sections for PBPop, by tab; onLookup is offered when X has not given account data yet.
  function sections(m, signals, onLookup) {
    const owner = PB.ownerOfHandle(m.handle);
    const head = [
      ["Owned by", owner ? `${owner.owner} (Wikidata)` : null],
      ["Profile", m.profile ? { links: [[m.profile.replace(/^https?:\/\/(www\.)?/, ""), m.profile]] } : null],
    ];
    if (m.site && m.site.hasLocation && !(m.reading && (m.reading.aboutRead || m.reading.basedIn)) && onLookup) {
      head.push(["About this account", m.lookingUp ? { note: "Reading…" } : { action: [m.failed ? "Try again" : "Read it now", () => onLookup(m.handle), "Reading…"] }]);
    }
    // Overview: the evidence grouped by area, in the strip's order.
    const groups = PBSignals.AREAS.map(([id, name]) => ({ tab: "overview", area: id, title: name, signals: signals.filter((x) => x.cat === id) })).filter((g) => g.signals.length);
    return [
      { tab: "overview", rows: head },
      ...(groups.length ? groups : [{ tab: "overview", rows: [[null, { note: "Nothing stands out in what the site shows. The other tabs have the details." }]] }]),
      { tab: "overview", title: "Compared with this thread", rows: compare(m) },
      { tab: "account", title: "Where", rows: where(m) },
      { tab: "account", title: "Account", rows: account(m) },
      { tab: "account", title: "How it posts", rows: posting(m), foot: (m.reading || {}).pattern ? "From the posts X loaded for this account in your browser, not its whole history." : null },
      { tab: "post", title: "This post", rows: post(m) },
      { tab: "post", title: "Source trail", rows: trail(m), foot: m.trail && (m.trail.steps.length || m.trail.media.length) ? "Followed through pointers X records: quotes, reposts, lifted media and upload ids. It stops at the first upload." : null },
      { tab: "history", title: "In your history", rows: history(m) },
      { tab: "history", foot: "Radar does not show or guess demographics. Data stays in this browser." },
    ];
  }

  globalThis.PBCard = Object.freeze({ sections });
})();
