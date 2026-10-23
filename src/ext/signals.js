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
    "platform-label": "moderation label", "brand-lookalike": "name borrows a brand",
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
  const dnp = (t) => ["What it shows", t];

  function language(m) {
    const out = [];
    for (const mk of (m.markers || []).filter((x) => STRONG[x.family])) {
      out.push({ label: STRONG[mk.family], fam: mk.family, lang: mk.lang, level: "warn", cat: "language", rows: [["In this post", `"${mk.match}"`], ["What it is", MEANING[mk.family]], ...(mk.lang ? [["Language", PB.langLine(mk.lang)]] : []), dnp("A match on the post's wording, which also turns up in quotes, irony and reported speech.")] });
    }
    // Named conspiracy theories (src/core/theories.js): info level, sourced, not measured yet.
    for (const mk of (m.markers || []).filter((x) => x.family === "conspiracy-theory")) {
      const t = PB.theoryById(mk.theory);
      if (t) out.push({ label: `names a theory: ${t.name}`, fam: "conspiracy-theory", level: "info", cat: "language", rows: [["In this post", `"${mk.match}"`], ["The theory", t.claim], ["What the record shows", t.record], ["Sources", { links: t.sources.map((x) => [`${x.title.split(", ")[0]} (${x.date})`, x.url]) }], dnp(`${t.dnp} ${PB.THEORY_DOES_NOT_PROVE}`)] });
    }
    // Persuasion techniques: how the post argues. Info level, and never an account flag.
    for (const t of m.persuasion || []) {
      out.push({ label: `persuasion: ${t.name.toLowerCase()}`, fam: t.technique, level: "info", cat: "language", rows: [["In this post", `"${t.match}"`], ["What it is", t.definition], t.lang === "fr" ? ["French cue", "The figure below is for English news articles; French is still to be measured."] : null, dnp(PB.PERSUASION_DOES_NOT_PROVE)].filter(Boolean) });
    }
    // The reading lens (src/core/reading.js): the span, its name, and the two factors that moved it.
    for (const f of m.lens || []) {
      out.push({ label: f.name.toLowerCase(), fam: "reading", level: "info", cat: "language", rows: [["In this post", `"${f.match}"`], ...(f.top.length ? [["Weighed by", f.top.map((x) => `${x.label} (${x.effect})`).join("; ")]] : [])] });
    }
    const M = m.machine;
    if (M && M.leak) out.push({ label: "leaked AI text", fam: "leaked-ai", level: "warn", cat: "language", rows: [["In this post", `"${M.leak}"`], ["What it is", "Text a chatbot writes, posted as it came out."], dnp("Chatbot boilerplate in the post, which people also paste as a quote or a joke.")] });
    else if (M && M.machineLike) out.push({ label: "machine-writing signs", fam: "machine-writing", level: "flag", cat: "language", rows: [["Signs", M.signs.join("; ")], ["How Daylight Commons decides", "Three or more independent signs in a post of at least 25 words, using Articulate's word lists."], dnp("The post has three or more machine-writing signs. Detectors flag non-native English writers more often.")] });
    if (M && M.spam) out.push({ label: "spam pattern", fam: "spam-pattern", level: "warn", cat: "language", rows: [["In this post", `"${M.spam}"`], ["What it is", "A pattern common in scam and spam posts: giveaways, crypto, contact bait."]] });
    if (m.xSpam) out.push({ label: "X: probable spam", fam: "x-spam", level: "warn", cat: "language", rows: [["Source", "X itself filed this reply under \"Probable spam\"."], dnp("X's spam filter makes mistakes in both directions.")] });
    return out;
  }

  function post(m) {
    const out = [], T = m.tweet || {};
    const old = PB.olderMedia(T);
    if (old.length) out.push({ label: `media from ${day(old[0].uploaded)}`, fam: "old-media", level: "warn", cat: "media", rows: [["What Daylight Commons sees", `This post was made ${day(T.posted)}, but its ${old[0].type === "photo" ? "image" : old[0].type} was first uploaded to X on ${day(old[0].uploaded)}, ${old[0].days} days earlier.`], ["Check it", "Open the card's media search links to find earlier copies, often with the real date and place."], dnp("An old upload can be honest, such as a labelled archive photo.")] });
    else if ((T.media || []).some((x) => x.fromPost)) out.push({ label: "media from another post", fam: "lifted-media", level: "flag", cat: "media", rows: [["What Daylight Commons sees", `The media was taken from an earlier post made ${day((T.media.find((x) => x.fromPost) || {}).fromPostTime)}.`], dnp("Sharing someone else's video with credit is normal.")] });
    for (const sp of (m.trail && m.trail.media) || []) {
      if (sp.accounts >= 3) { out.push({ label: `same upload, ${sp.accounts} accounts`, fam: "same-upload", level: "flag", cat: "coordination", rows: [["What Daylight Commons sees", `This exact upload appears in ${sp.posts} posts by ${sp.accounts} accounts in what you have viewed, first posted by @${sp.first.handle} (${day(sp.first.at)}).`], ["Who", sp.sharers.map((h) => "@" + h).join(", ")], dnp("Many accounts on one upload shows spread. Popular videos get reposted widely by ordinary people too.")] }); break; }
    }
    for (const g of (m.crossLang || []).slice(0, 1)) out.push({ label: `same ${g.kind === "claim" ? "claim" : g.kind === "media" ? "upload" : "link"} in ${g.langs.length} languages`, fam: "cross-language", level: "flag", cat: "coordination", rows: [["What Daylight Commons sees", `This ${g.kind === "claim" ? "fact-checked claim" : g.kind === "media" ? "upload" : "link"} is carried by ${g.accounts} accounts writing in ${g.langs.map((l) => l.replace("script:", "") + (l.startsWith("script:") ? " script" : "")).join(", ")}${g.across ? ", across threads you viewed" : " in this thread"}.`], ["Language from", g.basis === "script" ? "the writing system, since the site left the language blank" : "the language the site assigns each post"], ...(g.across ? [["In ordinary threads", "Not measured across threads yet."]] : baseline("cross-language", m)), dnp(PB.CROSS_DOES_NOT_PROVE)] });
    const C = m.chain;
    if (C && C.originHidden && C.intermediaries >= 1) out.push({ label: `passed through ${C.intermediaries} ${C.intermediaries === 1 ? "step" : "steps"}`, fam: "laundered", level: "info", cat: "sources", rows: [["Chain", C.hops.map((h) => (h.handle ? "@" + h.handle : h.domain) + (h.role === "origin" ? " (earliest Daylight Commons saw)" : "")).join(" → ")], C.hoursFromOrigin != null ? ["Time from origin", `${C.hoursFromOrigin} h`] : null, dnp(PB.CHAIN_DOES_NOT_PROVE)].filter(Boolean) });
    // Content Credentials and AI metadata, once the user has checked a file in this post.
    if (globalThis.PBMedia) for (const r of PBMedia.resultsFor(m.node, m.tweet)) out.push(...PB.credentialSignals(r));
    // Text the user had Daylight Commons read from an image in this post: the same language and fact-check
    // signs, each labelled as read from an image and kept at info level.
    if (globalThis.PBMedia && PBMedia.textsFor) {
      for (const r of PBMedia.textsFor(m.node, m.tweet)) {
        const found = [...language(PB.imageTextModel(r)), ...(r.claims || []).map((c) => { const card = PB.claimCard(c); return { label: card.label, fam: "fact-check", level: "warn", cat: "sources", rows: card.rows }; })];
        out.push(...found.map((x) => PB.fromImage(x, r)));
      }
    }
    if (T.client && !PB.COMMON_CLIENTS.test(T.client)) out.push({ label: `via ${T.client}`, fam: "client", level: "flag", cat: "posting", rows: [["Source", "The app this post was sent from, in the data X loaded. X has since hidden it from the page."], ["What it is", "Scheduling tools, automation services and custom apps post this way."], dnp("News desks, brands and many people schedule posts with tools like these.")] });
    if (m.paid) out.push({ label: "ad", fam: "ad", level: "flag", cat: "sources", rows: [["Source", "X labels this an ad or promoted post: someone paid for it to reach you."]] });
    const place = m.reading && m.reading.basedIn && (PB.parseLabel(m.reading.basedIn) || {}).country;
    if (m.writtenIn && PB.languageFits(m.writtenIn, place) !== true) out.push({ label: `written in ${m.writtenIn}`, fam: "written-in", level: "info", cat: "place", rows: [["Source", `X translated this post from ${m.writtenIn}.`], ["Account based in", (m.reading && m.reading.basedIn) || "not known yet"], dnp("People write in many languages, including ones from where they grew up.")] });
    return out;
  }

  // Domains and accounts named in a published influence-operation report (src/core/ops.js), from
  // the post's links, the account's handle and what its profile names. One sign per operation.
  function reports(m) {
    const prof = PB.profileLinks ? PB.profileLinks(m.reading) : { domains: [], handles: [] };
    const where = [...(m.domains || []).map((d) => [d, "This post links to", PB.opsOfDomain(d)]), ...prof.domains.map((d) => [d, "This account's profile names", PB.opsOfDomain(d)]),
      [m.handle, "This account is", PB.opsOfHandle(m.handle)], ...prof.handles.map((h) => [h, "This account's profile names", PB.opsOfHandle(h)])];
    const out = [], seen = new Set();
    for (const [what, how, hits] of where) for (const h of hits || []) {
      if (!h.op || seen.has(h.op.id)) continue;
      seen.add(h.op.id);
      const shown = h.indicator.x ? "@" + h.indicator.x : h.indicator.d;
      out.push({ label: "Named in a published report", fam: "named-in-report", level: "warn", cat: "sources", rows: [["What Daylight Commons sees", `${how} ${shown}${what && what.toLowerCase() !== shown.replace(/^@/, "") ? ` (${what})` : ""}.`], ...PB.opRows(h)] });
    }
    return { out, domains: new Set(where.filter(([, , h]) => h && h.length).map(([d]) => String(d).toLowerCase())) };
  }

  // Documented backing of a public media personality (src/core/backing.js), for the post's own author
  // only. Info level for every kind of record and every person: an allegation never escalates it.
  function backing(m) {
    const p = PB.backingOf && m.site ? PB.backingOf(m.site.id, m.handle) : null;
    return p ? [{ label: PB.backingLabel(p), fam: "backing-record", level: "info", cat: "sources", rows: PB.backingRows(p) }] : [];
  }

  // Look-alike news addresses (src/core/lookalike.js): a weak sign of its own.
  // A post that names the copied outlet in its own words adds a row (src/core/cloned.js), and an
  // address a published report named points at that sign.
  function lookalikes(m) {
    return PB.clonedCitations(m.text, m.domains).map((h) => ({
      label: `look-alike of ${h.official}`, fam: "lookalike-domain", level: "flag", cat: "sources",
      rows: [["What Daylight Commons sees", `This post links to ${h.domain}, which ${h.how === "swapped ending" ? "uses the name of" : h.how === "copies the name" ? "copies the name of" : h.how === "look-alike letters" ? "spells with look-alike letters the name of" : "is one letter away from the name of"} ${h.outlet} (${h.official}).`],
        h.named ? ["In its words", `The post names ${h.outlet} while its link goes to a different address. Open ${h.official} and look for the same story there.`] : null,
        h.reports.length ? ["Published reports", `A published report named this address as part of ${h.reports.slice(0, 2).join(" and ")}. See the "Named in a published report" sign.`] : null,
        ["Why it matters", "Operations such as Doppelganger copied real outlets on addresses like washingtonpost.pm to borrow their trust."], dnp(h.named ? PB.CLONED_DOES_NOT_PROVE : PB.LOOKALIKE_DOES_NOT_PROVE)].filter(Boolean),
    }));
  }

  function links(m) {
    const rep = reports(m), out = [...rep.out, ...backing(m), ...lookalikes(m)];
    // A report hit replaces the older state-table chip for the same domain or account.
    const covered = (h) => h.basis === "named-in-report" && (rep.domains.has(String(h.domain || "").toLowerCase()) || rep.domains.has(String(h.x || "").toLowerCase()));
    const hits = [...(m.domains || []).flatMap(PB.stateLinksOfDomain), ...PB.stateLinksOfHandle(m.handle)].filter((h) => !covered(h));
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
      out.push({ label: `link: ${o.name}`, fam: "owner", level: "info", cat: "sources", rows: [["Outlet", `${o.name} (${d})`], [PB.ownerHeading(o), o.owner], ["Source", PB.ownerSource(o)], dnp("The owner Wikidata lists, which can lag a sale and can differ from who runs the newsroom.")] });
    }
    return out;
  }

  // Coordination signs carry what normal looks like: how often the same sign showed up in
  // ordinary threads of this size (src/core/baselines.js).
  function baseline(id, m) {
    const T = m.thread || {}, line = PB.baselineLine(id, { replies: T.replies, viewed: T.viewed });
    return line ? [["In ordinary threads", line], ["Baseline from", PB.BASELINE_SOURCE]] : [];
  }

  function account(m) {
    return (m.flags || []).map((f) => ({ label: FLAG_LABEL[f.id] || f.id, fam: PB.familyOf("flag", f.id), cat: FLAG_CAT[f.id] || "account", level: f.id === "based-elsewhere" ? "warn" : WEAK.has(f.id) ? "info" : "flag", rows: [["Evidence", f.evidence], ...baseline(f.id, m), dnp(f.doesNotProve)] }));
  }

  // Shown first: a Community Note X attached to the post, then fact-checks of similar claims. The
  // rating is the fact-checker's own words; Daylight Commons adds no verdict of its own.
  function checks(m) {
    const out = [], T = m.tweet || {};
    const when = T.note ? PB.noteTiming(T) : null;
    if (T.note) out.push({ label: "Community Note", fam: "community-note", level: "warn", cat: "sources", rows: [["Note", T.note], ...(when ? [["Timing", when.text]] : []), ["Source", "X loaded a Community Note for this post. Notes are written and rated by X users."], dnp("A note shows what X users from different viewpoints rated helpful.")] });
    for (const c of m.claims || []) { const card = PB.claimCard(c); out.push({ label: card.label, fam: "fact-check", level: "warn", cat: "sources", rows: card.rows }); }
    return out;
  }

  // A sign's catalogue rows: the entries and versions that cite it, linked, and the dispute template.
  const catalogue = (id) => {
    if (!id || !PB.badgeLinks) return [];
    const b = PB.badgeLinks(id, PB.CATALOGUE_ENTRIES, PB.SIGNAL_REGISTRY);
    return [["Catalogue", PB.badgeLine(b)], ["", { links: b.links }]];
  };

  // The launch campaign lens on the launch post itself: the lead and the ladder's claims, with each
  // sign's does-not-prove line. Shown only when at least one inauthenticity sign fired.
  function campaign(m) {
    const c = m.campaign;
    if (!c || (c.status !== "strong" && c.status !== "one")) return [];
    return [{ label: c.status === "strong" ? "consistent with purchased amplification" : "one campaign sign", fam: "campaign", level: c.status === "strong" ? "warn" : "info", cat: "coordination",
      rows: [["Reading", c.lead], ...(c.claims || []).map((x) => [x.step === 1 ? "Documented" : "Inference", x.text]), ...c.indicators.flatMap((x) => [["Sign", x.text], dnp(x.dnp), ...catalogue(x.id)]), dnp(c.dnp), ["Dispute", c.dispute], ...(PB.DECISIONS_URL ? [["", { links: [["Decisions log", PB.DECISIONS_URL]] }]] : [])] }];
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
    return [...checks(m), ...campaign(m), ...language(m), ...links(m), ...post(m), ...account(m)].filter(shown)
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
