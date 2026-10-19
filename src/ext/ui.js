// One compact row of pills under each post's name line. The first pill is the account at a glance
// (where X says it is based, or "Account" when the site shows no location) and opens the full
// card. After it come the signals worth a look on their own and, space allowing, a couple more;
// the rest wait in the card. A row is redrawn only when its evidence changes.
(() => {
  "use strict";
  const { el } = PBPop;
  const MAX_INLINE = 3;

  // X has its own light, dim and dark themes, independent of the system setting: follow the page.
  let themeAt = 0;
  function syncTheme() {
    if (Date.now() - themeAt < 2000) return;
    themeAt = Date.now();
    const m = getComputedStyle(document.body).backgroundColor.match(/\d+/g);
    const dark = m && (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) < 128;
    document.documentElement.classList.toggle("pb-dark", !!dark);
  }

  function summary(m) {
    const R = m.reading || {};
    if (R.basedIn) return R.basedIn;
    if (m.site && !m.site.hasLocation) return "Account";
    if (m.lookingUp) return "Reading…";
    if (R.aboutRead) return "No location shown";
    return "Account";
  }

  function pill(text, cls, sections) {
    const b = el("button", `pb-chip ${cls || ""}`, text);
    b.type = "button";
    PBPop.attach(b, sections);
    return b;
  }

  // A cheap fingerprint of what the row shows, so unchanged rows are left alone.
  function signature(m, signals) {
    const R = m.reading || {};
    return [m.handle, R.basedIn, R.aboutRead, R.at, m.lookingUp, m.failed, signals.map((s) => s.label).join("|"), m.activity && m.activity.threads, m.tweet && (m.tweet.media || []).length].join("~");
  }

  // model: { site, handle, display, posted, profile, reading, flags, markers, machine, tweet, yt, ... }
  function badge(article, model, onLookup, anchor) {
    syncTheme();
    const signals = PBSignals.all(model);
    const sig = signature(model, signals);
    let bar = article.querySelector(":scope .pb-bar");
    if (bar && bar.dataset.sig === sig) return;
    if (!bar) {
      bar = el("div", "pb-bar");
      if (anchor && anchor.parentElement) anchor.after(bar); else article.append(bar);
    }
    bar.dataset.sig = sig;
    const card = () => PBCard.sections(model, signals, onLookup);
    const inline = [...signals.filter((s) => s.level === "warn"), ...signals.filter((s) => s.level === "flag")].slice(0, MAX_INLINE);
    const rest = signals.length - inline.length;
    const head = pill(summary(model) + (rest > 0 ? `  +${rest}` : ""), `pb-acct${model.reading && model.reading.basedIn ? " pb-place" : ""}`, card);
    head.setAttribute("aria-label", `Radar: account details for @${model.handle}`);
    const nodes = [head];
    for (const s of inline) nodes.push(pill(s.label, `pb-${s.level}`, () => [{ title: s.label, rows: s.rows }, { rows: [[null, { note: "Open the first pill for everything Radar knows about this post." }]] }]));
    bar.replaceChildren(...nodes);
  }

  globalThis.PBUI = Object.freeze({ badge, panel: (...a) => PBPanel.render(...a), closePop: PBPop.close, syncTheme });
})();
