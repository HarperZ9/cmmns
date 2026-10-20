// Every piece of evidence about one post, as data: { label, level, rows }. Levels:
//   warn  worth a look on its own (strong language, leaked AI text, old media, an op-report link)
//   flag  a sign that means more alongside others
//   info  context
// ui.js shows the warn signals and a couple of flags as pills; the card lists them all.
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
    "copied-elsewhere": "same words in other threads", "low-karma": "low karma for its age", "follow-pattern": "follows many, few follow back",
  };
  const WEAK = new Set(["default-handle", "follow-pattern"]);
  const day = (iso) => (iso ? iso.slice(0, 10) : "unknown");
  const dnp = (t) => ["Does not prove", t];

  function language(m) {
    const out = [];
    for (const mk of (m.markers || []).filter((x) => STRONG[x.family])) {
      out.push({ label: STRONG[mk.family], level: "warn", rows: [["In this post", `"${mk.match}"`], ["What it is", MEANING[mk.family]], dnp("Words can be quoted, ironic or reported speech. This describes the post, not who wrote it or why.")] });
    }
    const M = m.machine;
    if (M && M.leak) out.push({ label: "leaked AI text", level: "warn", rows: [["In this post", `"${M.leak}"`], ["What it is", "Text a chatbot writes, posted without editing."], dnp("People quote chatbots, joke, or paste a reply on purpose.")] });
    else if (M && M.machineLike) out.push({ label: "machine-writing signs", level: "flag", rows: [["Signs", M.signs.join("; ")], ["How Radar decides", "Three or more independent signs in a post of at least 25 words, using Articulate's word lists."], dnp("No detector reliably tells human from machine writing in a few sentences, and detectors flag non-native English writers more often.")] });
    if (M && M.spam) out.push({ label: "spam pattern", level: "warn", rows: [["In this post", `"${M.spam}"`], ["What it is", "A pattern common in scam and spam posts: giveaways, crypto, contact bait."]] });
    if (m.xSpam) out.push({ label: "X: probable spam", level: "warn", rows: [["Source", "X itself filed this reply under \"Probable spam\"."], dnp("X's spam filter makes mistakes in both directions.")] });
    return out;
  }

  function post(m) {
    const out = [], T = m.tweet || {};
    const old = PB.olderMedia(T);
    if (old.length) out.push({ label: `media from ${day(old[0].uploaded)}`, level: "warn", rows: [["What Radar sees", `This post was made ${day(T.posted)}, but its ${old[0].type === "photo" ? "image" : old[0].type} was first uploaded to X on ${day(old[0].uploaded)}, ${old[0].days} days earlier.`], ["Check it", "Open the card's media search links to find earlier copies, often with the real date and place."], dnp("An old upload can be honest, such as a labelled archive photo.")] });
    else if ((T.media || []).some((x) => x.fromPost)) out.push({ label: "media from another post", level: "flag", rows: [["What Radar sees", `The media was taken from an earlier post made ${day((T.media.find((x) => x.fromPost) || {}).fromPostTime)}.`], dnp("Sharing someone else's video with credit is normal.")] });
    for (const sp of (m.trail && m.trail.media) || []) {
      if (sp.accounts >= 3) { out.push({ label: `same upload, ${sp.accounts} accounts`, level: "flag", rows: [["What Radar sees", `This exact upload appears in ${sp.posts} posts by ${sp.accounts} accounts in what you have viewed, first posted by @${sp.first.handle} (${day(sp.first.at)}).`], ["Who", sp.sharers.map((h) => "@" + h).join(", ")], dnp("Popular videos get reposted widely by ordinary people. Many accounts on one upload shows spread, not who coordinated it.")] }); break; }
    }
    if (T.note) out.push({ label: "Community Note", level: "flag", rows: [["Note", T.note], ["Source", "X loaded a Community Note for this post. Notes are written and rated by X users."]] });
    if (T.client && !PB.COMMON_CLIENTS.test(T.client)) out.push({ label: `via ${T.client}`, level: "flag", rows: [["Source", "The app this post was sent from, in the data X loaded. X no longer shows it."], ["What it is", "Scheduling tools, automation services and custom apps post this way."], dnp("News desks, brands and many people schedule posts with tools like these.")] });
    if (m.paid) out.push({ label: "ad", level: "flag", rows: [["Source", "X labels this an ad or promoted post: someone paid for it to reach you."]] });
    const place = m.reading && m.reading.basedIn && (PB.parseLabel(m.reading.basedIn) || {}).country;
    if (m.writtenIn && PB.languageFits(m.writtenIn, place) !== true) out.push({ label: `written in ${m.writtenIn}`, level: "info", rows: [["Source", `X translated this post from ${m.writtenIn}.`], ["Account based in", (m.reading && m.reading.basedIn) || "not known yet"], dnp("People write in many languages, including ones from where they grew up.")] });
    return out;
  }

  function links(m) {
    const out = [];
    const hits = [...(m.domains || []).flatMap(PB.stateLinksOfDomain), ...PB.stateLinksOfHandle(m.handle)];
    for (const h of new Set(hits)) {
      const L = PB.stateLabel(h);
      out.push({ label: L.chip, level: h.basis === "named-in-report" ? "warn" : h.basis === "state-owned" || h.basis === "designated" ? "flag" : "info", rows: [["What it is", L.says], ["Source", `${h.source.title}${h.source.date ? ` (${h.source.date})` : ""}`], ["Read it", { links: [[h.source.url.replace(/^https?:\/\//, "").slice(0, 48), h.source.url]] }], h.domainSource ? ["Domain from", { links: [[h.domainSource.title, h.domainSource.url]] }] : null, dnp(PB.STATE_DOES_NOT_PROVE[h.basis])].filter(Boolean) });
    }
    for (const d of m.domains || []) {
      const o = PB.ownerOfDomain(d);
      if (!o || d === "x.com" || d === "twitter.com") continue;
      out.push({ label: `link: ${o.name}`, level: "info", rows: [["Outlet", `${o.name} (${d})`], ["Owned by", o.owner], ["Source", `Wikidata: ${o.source}`], dnp("Ownership is not editorial control, and Wikidata can lag a sale.")] });
    }
    return out;
  }

  function account(m) {
    return (m.flags || []).map((f) => ({ label: FLAG_LABEL[f.id] || f.id, level: f.id === "based-elsewhere" ? "warn" : WEAK.has(f.id) ? "info" : "flag", rows: [["Evidence", f.evidence], dnp(f.doesNotProve)] }));
  }

  const ORDER = { warn: 0, flag: 1, info: 2 };
  function all(m) { return [...language(m), ...links(m), ...post(m), ...account(m)].sort((a, b) => ORDER[a.level] - ORDER[b.level]); }

  globalThis.PBSignals = Object.freeze({ all });
})();
