// Badge, popover and thread-panel rendering. Page text only ever goes in through textContent,
// never innerHTML, so nothing a reply says can inject markup.
(() => {
  "use strict";
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  const FLAG_LABEL = {
    "new-account": "new account", "name-changes": "renamed", "default-handle": "sign-up handle",
    "based-elsewhere": "speaks as local, labelled elsewhere", "same-text": "same text as others", "hate-symbol-name": "hate symbol in name",
  };

  const STRONG = { coded: "coded hate term", dehumanise: "dehumanising language", violence: "call for violence", vigilante: "call for vigilantes" };
  const MEANING = {
    coded: "A slur, dog whistle or coined term with a documented hateful meaning (ADL Hate Symbols database, GNET, ISD).",
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
      ["Profile", m.profile || null],
      ["Account based in", R.basedIn || no],
      ["Joined", R.joinDate ? `${R.joinDate.slice(0, 7)} (${age} days ago)` : no],
      ["Connected via", R.connectedVia || no],
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
    } else if (R) {
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
    if (clusters.length) p.append(el("p", "pb-num", `${clusters.length} group${clusters.length === 1 ? "" : "s"} of near-identical replies from different accounts (largest: ${clusters[0].ids.length}).`));
    if (stats.site && !stats.site.hasLocation) p.append(el("p", "pb-num", `${stats.site.name} shows no account location, so this report uses coordination signs only.`));
    if (stats.pending) {
      const b = el("button", "pb-chip pb-look", `Look up ${Math.min(stats.pending, 60)} more account${stats.pending === 1 ? "" : "s"}`);
      b.type = "button";
      b.title = "One account every 4 seconds, in background tabs";
      b.addEventListener("click", onLookupAll);
      p.append(b);
    }
    p.append(el("p", "pb-caveat", PB.REPORT_DOES_NOT_PROVE));
  }

  globalThis.PBUI = Object.freeze({ badge, panel, closePop });
})();
