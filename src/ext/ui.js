// Badge, popover and thread-panel rendering. Page text only ever goes in through textContent,
// never innerHTML, so nothing a reply says can inject markup.
(() => {
  "use strict";
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  const FLAG_LABEL = {
    "new-account": "new account", "name-changes": "renamed", "default-handle": "sign-up handle",
    "based-elsewhere": "speaks as local, labelled elsewhere", "same-text": "same text as others", "hate-symbol-name": "hate symbol in name", "store-elsewhere": "app store elsewhere", "flag-elsewhere": "flag of another country", "profile-location-elsewhere": "profile says elsewhere", "high-volume": "posts at a very high rate", "follow-pattern": "follows many, few follow back",
  };

  const STRONG = { slur: "slur or coded hate term", stereotype: "group stereotype", dehumanise: "dehumanising language", violence: "call for violence", vigilante: "call for vigilantes" };
  const MEANING = {
    slur: "A slur, dog whistle or coined term with a documented hateful meaning (ADL Hate Symbols database, Hatebase, GNET, ISD).",
    stereotype: "Names a whole group of people by a trait, such as criminal, lazy or violent.",
    dehumanise: "Describes a group of people as vermin, disease, animals or filth.",
    violence: "Calls for violence or collective punishment against people.",
    vigilante: "Calls for people outside the law, or soldiers, to act against people.",
  };

  let openPop = null;
  function closePop() { if (openPop) { openPop.remove(); openPop = null; } }
  document.addEventListener("click", (e) => { if (openPop && !openPop.contains(e.target) && !e.target.closest(".pb-chip")) closePop(); }, true);

  // rows: [[heading, text]]
  function popover(anchor, rows) {
    closePop();
    const p = el("div", "pb-pop");
    for (const [h, t] of rows) { if (!t) continue; p.append(el("div", "pb-pop-h", h), el("div", "pb-pop-t", t)); }
    const r = anchor.getBoundingClientRect();
    p.style.top = `${Math.round(window.scrollY + r.bottom + 6)}px`;
    p.style.left = `${Math.round(Math.min(window.scrollX + r.left, window.scrollX + document.documentElement.clientWidth - 340))}px`;
    document.body.append(p);
    openPop = p;
  }

  function chip(text, cls, rows) {
    const c = el("button", `pb-chip ${cls || ""}`, text);
    c.type = "button";
    c.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); popover(c, rows); });
    return c;
  }

  // The account card: everything the site itself discloses about the account and the comment,
  // plus Radar's evidence. It never shows or guesses demographics (race, religion, ethnicity,
  // gender, age): the platforms do not disclose them, and guessing them about a person is profiling.
  function accountRows(m) {
    const R = m.reading || {};
    const age = R.joinDate ? PB.ageDays(R.joinDate) : null;
    const no = m.site && !m.site.hasLocation ? `${m.site.name} does not disclose this` : (m.reading ? "not shown" : "not looked up yet");
    return [
      ["Account", [m.display, "@" + m.handle].filter(Boolean).join("  ")],
      ["Owned by", PB.ownerOfHandle(m.handle) ? `${PB.ownerOfHandle(m.handle).owner} (Wikidata: ${PB.ownerOfHandle(m.handle).source})` : null],
      ["Profile", m.profile || null],
      ["Account based in", R.basedIn || no],
      ["Joined", R.joinDate ? `${R.joinDate.slice(0, 7)} (${age} days ago)` : no],
      ["Connected via", R.connectedVia || no],
      ["Profile location (self-declared)", R.profileLocation || null],
      ["Bio", R.bio ? R.bio.slice(0, 280) : null],
      ["Website", R.website || null],
      ["Followers / following", R.followersCount != null ? `${R.followersCount.toLocaleString()} / ${R.followingCount.toLocaleString()}` : (R.followers || R.following ? [R.followers, R.following].filter(Boolean).join(" / ") : null)],
      ["Posts", R.postsCount != null ? `${R.postsCount.toLocaleString()}${age ? ` (about ${Math.round(R.postsCount / Math.max(1, age))} a day)` : ""}` : (R.posts || null)],
      ["Checkmark", R.verifiedType ? ({ Blue: "blue (paid subscription)", Business: "gold (organisation)", Government: "grey (government)" }[R.verifiedType] || R.verifiedType) : null],
      ["X label", R.xLabel || m.pageLabel ? `${R.xLabel || m.pageLabel} account` : null],
      ["Category", R.category || null],
      ["Protected", R.protected ? "yes, posts are private" : null],
      ["Data from", R.aboutRead ? "X's page data and the About page" : (R.fromPage ? "the data X loaded for this page (no request by Radar); Scan adds the About page" : null)],
      ["VPN or proxy note", R.proxyNote ? "X notes the location may not be accurate (a VPN or proxy may be in use)" : null],
      ["Verified", R.verifiedSince ? `since ${R.verifiedSince}` : (m.reading ? "no" : no)],
      ["Affiliate of", R.affiliateOf || null],
      ["Username changes", R.nameChanges == null ? no : String(R.nameChanges)],
      ["This comment", m.posted ? `posted ${m.posted.slice(0, 16).replace("T", " ")} UTC` : null],
      ["Radar's flags", (m.flags || []).length ? m.flags.map((f) => f.evidence).join("; ") : "none"],
      ["Not shown", "Demographics. Platforms do not disclose them, and Radar does not guess them."],
    ];
  }

  // model: { handle, display, posted, profile, reading, flags, mismatch, lookingUp }
  function badge(article, model, onLookup, anchor) {
    let bar = article.querySelector(":scope .pb-bar");
    if (!bar) {
      bar = el("div", "pb-bar");
      if (anchor && anchor.parentElement) anchor.after(bar); else article.append(bar);
    }
    bar.replaceChildren();
    const R = model.reading;
    bar.append(chip("Account", "pb-acct", accountRows(model)));
    if (R && R.basedIn) {
      bar.append(chip(`Based in ${R.basedIn}`, "pb-place", [
        ["Source", `X's "About this account" label for @${model.handle}, read from the page X shows you.`],
        ["Joined", R.joinDate || "not shown"], ["Connected via", R.connectedVia || "not shown"],
        ["Username changes", R.nameChanges == null ? "not shown" : String(R.nameChanges)],
        ["What it does not prove", PB.DOES_NOT_PROVE["based-elsewhere"]],
      ]));
    } else if (model.site && !model.site.hasLocation) {
      // no location on this site: badges only appear when there is a coordination sign
    } else if (R && R.aboutRead) {
      bar.append(chip("No location shown", "pb-quiet", [["Source", "X's about page showed no location for this account."]]));
    } else {
      const b = el("button", "pb-chip pb-look", model.lookingUp ? "Looking up…" : model.failed ? "Nothing found, retry" : "Look up");
      b.type = "button";
      b.disabled = !!model.lookingUp;
      b.title = "Read this account's About page in a background tab";
      b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); onLookup(model.handle); });
      bar.append(b);
    }
    // Language in this comment: only the strong marker families get a chip on the comment; the
    // weaker ones count in the thread report alone. The chip describes the words, not the person.
    for (const mk of (model.markers || []).filter((x) => STRONG[x.family])) {
      bar.append(chip(STRONG[mk.family], "pb-warn", [
        ["In this comment", `"${mk.match}"`],
        ["What it is", MEANING[mk.family]],
        ["What it does not prove", "Words can be quoted, ironic or reported speech. This describes the comment, not who wrote it or why."],
      ]));
    }
    const M = model.machine;
    if (M && M.leak) bar.append(chip("leaked AI text", "pb-warn", [["In this comment", `"${M.leak}"`], ["What it is", "Text a chatbot writes, posted without editing: a strong sign a bot or tool wrote the reply."], ["What it does not prove", "People quote chatbots, joke, or paste a reply on purpose."]]));
    else if (M && M.machineLike) bar.append(chip("machine-writing signs", "pb-flag", [["Signs", M.signs.join("; ")], ["How Radar decides", "Three or more independent signs in a reply of at least 25 words, using Articulate's word lists."], ["What it does not prove", "No detector reliably tells human from machine writing in a few sentences, and detectors flag non-native English writers more often. Treat this as a hint."]]));
    if (M && M.spam) bar.append(chip("spam pattern", "pb-warn", [["In this comment", `"${M.spam}"`], ["What it is", "A pattern common in scam and spam replies: giveaways, crypto, contact bait."]]));
    if (model.xSpam) bar.append(chip("X: probable spam", "pb-warn", [["Source", "X itself filed this reply under its \"Probable spam\" heading."], ["What it does not prove", "X's spam filter makes mistakes in both directions."]]));
    if (model.writtenIn) bar.append(chip(`written in ${model.writtenIn}`, "pb-flag", [["Source", `X translated this reply from ${model.writtenIn}.`], ["Account based in", (model.reading && model.reading.basedIn) || "not known yet"], ["What it does not prove", "People write in many languages, including ones from where they grew up."]]));
    if (model.paid) bar.append(chip("ad (X label)", "pb-flag", [["Source", "X labels this post as an ad or promoted post: someone paid for it to reach you."]]));
    for (const d of model.domains || []) {
      const o = PB.ownerOfDomain(d);
      if (!o || d === "x.com" || d === "twitter.com") continue;
      bar.append(chip(`link: ${o.name}`, "pb-place", [["Outlet", `${o.name} (${d})`], ["Owned by", o.owner], ["Source", `Wikidata: ${o.source}`], ["What it does not prove", "Ownership is not editorial control, and Wikidata can lag a sale."]]));
    }
    for (const f of model.flags || []) {
      bar.append(chip(FLAG_LABEL[f.id] || f.id, f.id === "based-elsewhere" ? "pb-warn" : "pb-flag", [
        ["Evidence", f.evidence], ["What it does not prove", f.doesNotProve],
      ]));
    }
  }

  const pct = (x) => `${Math.round(x * 100)}%`;
  const ci = (c) => `${pct(c[0])} to ${pct(c[1])}`;

  // report: threadReport(); clusters: duplicateClusters(); stats: { pending }
  // X has its own light, dim and dark themes, independent of the system setting: follow the
  // page's actual background.
  function syncTheme() {
    const m = getComputedStyle(document.body).backgroundColor.match(/\d+/g);
    const dark = m && (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) < 128;
    document.documentElement.classList.toggle("pb-dark", !!dark);
  }

  function panel(report, clusters, stats, onLookupAll) {
    syncTheme();
    let p = document.getElementById("pb-panel");
    if (!p) {
      p = el("aside", "pb-panel"); p.id = "pb-panel";
      p.dataset.collapsed = window.innerWidth < 1000 ? "1" : "0";   // stay out of the way on narrow screens
      document.body.append(p);
    }
    const collapsed = p.dataset.collapsed === "1";
    p.replaceChildren();
    const head = el("button", "pb-panel-head", collapsed ? "Radar ▸" : "Radar ▾");
    head.type = "button";
    head.addEventListener("click", () => { p.dataset.collapsed = collapsed ? "0" : "1"; panel(report, clusters, stats, onLookupAll); });
    p.append(head);
    if (collapsed) return;
    p.append(el("p", "pb-sentence", report.sentence));
    if (report.verdict !== "too-few") {
      p.append(el("p", "pb-num", `Extreme replies from flagged accounts: ${pct(report.extreme.share)} (95% interval ${ci(report.extreme.ci)}).`));
      p.append(el("p", "pb-num", `Other replies from flagged accounts: ${pct(report.others.share)} (95% interval ${ci(report.others.ci)}).`));
    }
    p.append(el("p", "pb-num", `${report.replies} repl${report.replies === 1 ? "y" : "ies"} on screen, ${report.lookedUp} account${report.lookedUp === 1 ? "" : "s"} looked up.`));
    if (report.origins && report.origins.length) {
      p.append(el("p", "pb-num", "Where looked-up accounts are labelled as based: " + report.origins.slice(0, 5).map((o) => `${o.place} ${o.n}`).join(", ") + (report.origins.length > 5 ? ", and others" : "") + "."));
    }
    if (report.joinBurst && report.joinBurst.n >= 3) {
      p.append(el("p", "pb-num", `${report.joinBurst.n} of ${report.joinBurst.of} looked-up accounts joined within the same two weeks (${report.joinBurst.from} to ${report.joinBurst.to}).`));
    }
    if (report.machine && report.machine.n) p.append(el("p", "pb-num", `${report.machine.n} of ${report.replies} replies show machine-writing signs or leaked AI text (a hint, not a finding).`));
    if (clusters.length) p.append(el("p", "pb-num", `${clusters.length} group${clusters.length === 1 ? "" : "s"} of near-identical replies from different accounts (largest: ${clusters[0].ids.length}).`));
    if (stats.site && !stats.site.hasLocation) p.append(el("p", "pb-num", `${stats.site.name} shows no account location, so this report uses coordination signs only.`));
    if (stats.paused) {
      p.append(el("p", "pb-num", "X is limiting requests; Radar paused About lookups for a few minutes."));
    } else if (stats.scanning) {
      p.append(el("p", "pb-num", `Reading About data automatically: ${stats.scanning} account${stats.scanning === 1 ? "" : "s"} left.`));
    } else if (stats.pending) {
      const b = el("button", "pb-chip pb-look", `Scan ${Math.min(stats.pending, 200)} account${stats.pending === 1 ? "" : "s"} (about ${Math.ceil((Math.min(stats.pending, 200) * 6) / 60)} min)`);
      b.type = "button";
      b.title = "Reads each account's public profile and About page in one minimised window. Radar's toolbar button does the same.";
      b.addEventListener("click", onLookupAll);
      p.append(b);
    }
    p.append(el("p", "pb-caveat", PB.REPORT_DOES_NOT_PROVE));
  }

  globalThis.PBUI = Object.freeze({ badge, panel, closePop });
})();
