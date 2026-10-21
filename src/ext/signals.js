// Every piece of evidence about one post, as data: { label, level, cat, rows }. Levels:
//   warn  worth a look on its own (strong language, leaked AI text, old media, an op-report link)
//   flag  a sign that means more alongside others
//   info  context
// The window's glance line names the warn signals; the card lists them all.
(() => {
  "use strict";
  const STRONG = { slur: "slur or coded hate term", stereotype: "group stereotype", dehumanise: "dehumanising language", violence: "call for violence", vigilante: "call for vigilantes" };
  const MEANING = {
    slur: "A slur, dog whistle or coined term with a documented hateful meaning (ADL Hate Symbols database, Hatebase, GNET, ISD).",
    stereotype: "Names a whole group of people by a trait, such as criminal, lazy or violent.",
    dehumanise: "Describes a group of people as vermin, disease, animals or filth.",
    violence: "Calls for violence or collective punishment against people.",
    vigilante: "Calls for people outside the law, or soldiers, to act against people.",
  };
  const FLAG_LABEL = {
    "new-account": "new account", "name-changes": "renamed", "default-handle": "sign-up handle",
    "based-elsewhere": "speaks as local, labelled elsewhere", "same-text": "same text as others", "hate-symbol-name": "hate symbol in name",
    "store-elsewhere": "app store elsewhere", "flag-elsewhere": "flag of another country", "profile-location-elsewhere": "profile says elsewhere",
    "high-volume": "very high post rate", "hours-elsewhere": "active hours fit elsewhere", "fast-replier": "replies within a minute",
    "copied-elsewhere": "same words in other threads", "low-karma": "low karma for its age", "automation-app": "posts through an automation app", "no-sleep-gap": "posts around the clock", "repost-only": "almost only reposts", "follow-pattern": "follows many, few follow back",
    "platform-label": "moderation label",
  };
  const WEAK = new Set(["default-handle", "follow-pattern"]);
  // The areas the window's summary strip shows, in order, and which area each account flag is in.
  const AREAS = [["place", "Place"], ["account", "Account"], ["posting", "Posting"], ["coordination", "Coordination"], ["language", "Language"], ["sources", "Sources"], ["media", "Media"]];
  const FLAG_CAT = {
    "based-elsewhere": "place", "store-elsewhere": "place", "flag-elsewhere": "place", "profile-location-elsewhere": "place", "hours-elsewhere": "place",
    "fast-replier": "posting", "automation-app": "posting", "no-sleep-gap": "posting", "repost-only": "posting", "high-volume": "posting",
    "same-text": "coordination", "copied-elsewhere": "coordination", "hate-symbol-name": "language",
  };
  const day = (iso) => (iso ? iso.slice(0, 10) : "unknown");
  const dnp = (t) => ["Does not prove", t];

  function language(m) {
    const out = [];
    for (const mk of (m.markers || []).filter((x) => STRONG[x.family])) {
      out.push({ label: STRONG[mk.family], fam: mk.family, lang: mk.lang, level: "warn", cat: "language", rows: [["In this post", `"${mk.match}"`], ["What it is", MEANING[mk.family]], ...(mk.lang ? [["Language", PB.langLine(mk.lang)]] : []), dnp("Words can be quoted, ironic or reported speech. This describes the post, not who wrote it or why.")] });
    }
    // Persuasion techniques: how the post argues. Info level, and never an account flag.
    for (const t of m.persuasion || []) {
      out.push({ label: `persuasion: ${t.name.toLowerCase()}`, fam: t.technique, level: "info", cat: "language", rows: [["In this post", `"${t.match}"`], ["What it is", t.definition], t.lang === "fr" ? ["French cue", "Not measured in French. The figure below is for English news articles."] : null, dnp(PB.PERSUASION_DOES_NOT_PROVE)].filter(Boolean) });
    }
    const M = m.machine;
    if (M && M.leak) out.push({ label: "leaked AI text", fam: "leaked-ai", level: "warn", cat: "language", rows: [["In this post", `"${M.leak}"`], ["What it is", "Text a chatbot writes, posted without editing."], dnp("People quote chatbots, joke, or paste a reply on purpose.")] });
    else if (M && M.machineLike) out.push({ label: "machine-writing signs", fam: "machine-writing", level: "flag", cat: "language", rows: [["Signs", M.signs.join("; ")], ["How Radar decides", "Three or more independent signs in a post of at least 25 words, using Articulate's word lists."], dnp("No detector reliably tells human from machine writing in a few sentences, and detectors flag non-native English writers more often.")] });
    if (M && M.spam) out.push({ label: "spam pattern", fam: "spam-pattern", level: "warn", cat: "language", rows: [["In this post", `"${M.spam}"`], ["What it is", "A pattern common in scam and spam posts: giveaways, crypto, contact bait."]] });
    if (m.xSpam) out.push({ label: "X: probable spam", fam: "x-spam", level: "warn", cat: "language", rows: [["Source", "X itself filed this reply under \"Probable spam\"."], dnp("X's spam filter makes mistakes in both directions.")] });
    return out;
  }

  function post(m) {
    const out = [], T = m.tweet || {};
    const old = PB.olderMedia(T);
    if (old.length) out.push({ label: `media from ${day(old[0].uploaded)}`, fam: "old-media", level: "warn", cat: "media", rows: [["What Radar sees", `This post was made ${day(T.posted)}, but its ${old[0].type === "photo" ? "image" : old[0].type} was first uploaded to X on ${day(old[0].uploaded)}, ${old[0].days} days earlier.`], ["Check it", "Open the card's media search links to find earlier copies, often with the real date and place."], dnp("An old upload can be honest, such as a labelled archive photo.")] });
    else if ((T.media || []).some((x) => x.fromPost)) out.push({ label: "media from another post", fam: "lifted-media", level: "flag", cat: "media", rows: [["What Radar sees", `The media was taken from an earlier post made ${day((T.media.find((x) => x.fromPost) || {}).fromPostTime)}.`], dnp("Sharing someone else's video with credit is normal.")] });
    for (const sp of (m.trail && m.trail.media) || []) {
      if (sp.accounts >= 3) { out.push({ label: `same upload, ${sp.accounts} accounts`, fam: "same-upload", level: "flag", cat: "coordination", rows: [["What Radar sees", `This exact upload appears in ${sp.posts} posts by ${sp.accounts} accounts in what you have viewed, first posted by @${sp.first.handle} (${day(sp.first.at)}).`], ["Who", sp.sharers.map((h) => "@" + h).join(", ")], dnp("Popular videos get reposted widely by ordinary people. Many accounts on one upload shows spread, not who coordinated it.")] }); break; }
    }
    // Content Credentials and AI metadata, once the user has checked a file in this post.
    if (globalThis.PBMedia) for (const r of PBMedia.resultsFor(m.node, m.tweet)) out.push(...PB.credentialSignals(r));
    if (T.client && !PB.COMMON_CLIENTS.test(T.client)) out.push({ label: `via ${T.client}`, fam: "client", level: "flag", cat: "posting", rows: [["Source", "The app this post was sent from, in the data X loaded. X no longer shows it."], ["What it is", "Scheduling tools, automation services and custom apps post this way."], dnp("News desks, brands and many people schedule posts with tools like these.")] });
    if (m.paid) out.push({ label: "ad", fam: "ad", level: "flag", cat: "sources", rows: [["Source", "X labels this an ad or promoted post: someone paid for it to reach you."]] });
    const place = m.reading && m.reading.basedIn && (PB.parseLabel(m.reading.basedIn) || {}).country;
    if (m.writtenIn && PB.languageFits(m.writtenIn, place) !== true) out.push({ label: `written in ${m.writtenIn}`, fam: "written-in", level: "info", cat: "place", rows: [["Source", `X translated this post from ${m.writtenIn}.`], ["Account based in", (m.reading && m.reading.basedIn) || "not known yet"], dnp("People write in many languages, including ones from where they grew up.")] });
    return out;
  }

  function links(m) {
    const out = [];
    const hits = [...(m.domains || []).flatMap(PB.stateLinksOfDomain), ...PB.stateLinksOfHandle(m.handle)];
    for (const h of new Set(hits)) {
      const L = PB.stateLabel(h);
      out.push({ label: L.chip, fam: "state-link", cat: "sources", level: h.basis === "named-in-report" ? "warn" : h.basis === "state-owned" || h.basis === "designated" ? "flag" : "info", rows: [["What it is", L.says], ["Source", `${h.source.title}${h.source.date ? ` (${h.source.date})` : ""}`], ["Read it", { links: [[h.source.url.replace(/^https?:\/\//, "").slice(0, 48), h.source.url]] }], h.domainSource ? ["Domain from", { links: [[h.domainSource.title, h.domainSource.url]] }] : null, dnp(PB.STATE_DOES_NOT_PROVE[h.basis])].filter(Boolean) });
    }
    for (const d of m.domains || []) {
      if (PB.hostedKind(d)) continue;
      // The full site card when the background has answered (src/ext/linkcard.js), else the owner row.
      const site = globalThis.PBLinkCard && PBLinkCard.cached(d);
      if (site && (site.owner || site.facts || site.record)) {
        const g = PB.siteGlance(site);
        out.push({ label: `link: ${g.who}`, fam: site.owner ? "owner" : "site-record", level: "info", cat: "sources", rows: PB.siteInfoRows(site, { onList: PBLinkCard.openList(site.domain) }) });
        continue;
      }
      const o = PB.ownerOfDomain(d);
      if (!o) continue;
      out.push({ label: `link: ${o.name}`, fam: "owner", level: "info", cat: "sources", rows: [["Outlet", `${o.name} (${d})`], [PB.ownerHeading(o), o.owner], ["Source", `Wikidata: ${o.source}`], dnp("Ownership is not editorial control, and Wikidata can lag a sale.")] });
    }
    return out;
  }

  function account(m) {
    return (m.flags || []).map((f) => ({ label: FLAG_LABEL[f.id] || f.id, fam: PB.familyOf("flag", f.id), cat: FLAG_CAT[f.id] || "account", level: f.id === "based-elsewhere" ? "warn" : WEAK.has(f.id) ? "info" : "flag", rows: [["Evidence", f.evidence], dnp(f.doesNotProve)] }));
  }

  // Shown first: a Community Note X attached to the post, then fact-checks of similar claims. The
  // rating is the fact-checker's own words; Radar adds no verdict of its own.
  function checks(m) {
    const out = [], T = m.tweet || {};
    if (T.note) out.push({ label: "Community Note", fam: "community-note", level: "warn", cat: "sources", rows: [["Note", T.note], ["Source", "X loaded a Community Note for this post. Notes are written and rated by X users."], dnp("A note shows what X users from different viewpoints rated helpful. It is not a ruling by X or by Radar.")] });
    for (const c of m.claims || []) { const card = PB.claimCard(c); out.push({ label: card.label, fam: "fact-check", level: "warn", cat: "sources", rows: card.rows }); }
    return out;
  }

  const ORDER = { warn: 0, flag: 1, info: 2 };
  // Each signal carries its family's measured accuracy (src/core/measured.js through families.js),
  // or "not measured yet". A marker another language's grammar found says the figure is for English;
  // its own language's figure is in its "Language" row. Areas the user hid in the options page are left out.
  // Every sign links to its lesson (src/ext/learn.html), opened by the worker on click.
  const learn = (fam) => { const path = fam && PB.lessonPath ? PB.lessonPath(fam) : null; return path ? [["Learn", { open: ["How to spot it yourself, 1 to 2 minutes", path] }]] : []; };
  const measured = (fam) => (fam && PB.measuredLine ? PB.measuredLine(fam).text : "not measured yet");
  // The user's own marks (src/ext/feedback.js) sit under the measured line and never replace it.
  const feedback = (x, m) => (globalThis.PBFeedback && x.fam ? PBFeedback.rows(x, m) : []);
  function all(m, settings) {
    const shown = (x) => !settings || !PB.areaOn || PB.areaOn(settings, x.cat);
    return [...checks(m), ...language(m), ...links(m), ...post(m), ...account(m)].filter(shown)
      .map((x) => ({ ...x, rows: [...x.rows, ["Measured", (x.lang ? "in English: " : "") + measured(x.fam)], ...feedback(x, m), ...learn(x.fam)] }))
      .sort((a, b) => ORDER[a.level] - ORDER[b.level]);
  }

  // One entry per area: the strongest level of its signals, or "none".
  function areas(signals) {
    return AREAS.map(([id, name]) => {
      const mine = signals.filter((x) => x.cat === id);
      const level = mine.length ? mine.map((x) => x.level).sort((a, b) => ORDER[a] - ORDER[b])[0] : "none";
      return { id, name, level, n: mine.length };
    });
  }

  globalThis.PBSignals = Object.freeze({ all, areas, AREAS });
})();
