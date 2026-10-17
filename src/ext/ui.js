// Badge, popover and thread-panel rendering. Page text only ever goes in through textContent,
// never innerHTML, so nothing a reply says can inject markup.
(() => {
  "use strict";
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  const FLAG_LABEL = {
    "new-account": "new account", "name-changes": "renamed", "default-handle": "sign-up handle",
    "based-elsewhere": "speaks as local, labelled elsewhere", "same-text": "same text as others",
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

  // model: { handle, reading, flags, mismatch, lookingUp }
  function badge(article, model, onLookup) {
    let bar = article.querySelector(":scope .pb-bar");
    if (!bar) {
      bar = el("div", "pb-bar");
      const anchor = article.querySelector('[data-testid="User-Name"]');
      (anchor && anchor.parentElement ? anchor.parentElement : article).append(bar);
    }
    bar.replaceChildren();
    const R = model.reading;
    if (R && R.basedIn) {
      bar.append(chip(`Based in ${R.basedIn}`, "pb-place", [
        ["Source", `X's "About this account" label for @${model.handle}, read from the page X shows you.`],
        ["Joined", R.joinDate || "not shown"], ["Connected via", R.connectedVia || "not shown"],
        ["Username changes", R.nameChanges == null ? "not shown" : String(R.nameChanges)],
        ["What it does not prove", PB.DOES_NOT_PROVE["based-elsewhere"]],
      ]));
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
    const head = el("button", "pb-panel-head", collapsed ? "Thread report ▸" : "Thread report ▾");
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
