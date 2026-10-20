// Nothing is drawn on the page. Each post is wired so that resting the pointer on it fades in
// Radar's window beside it (src/ext/pop.js): a glance line with the key facts and the signals worth
// a look, then the full card (src/ext/card.js).
(() => {
  "use strict";

  // X has its own light, dim and dark themes, independent of the system setting: follow the page.
  let themeAt = 0;
  function syncTheme() {
    if (Date.now() - themeAt < 2000) return;
    themeAt = Date.now();
    const m = getComputedStyle(document.body).backgroundColor.match(/\d+/g);
    const dark = m && (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) < 128;
    document.documentElement.classList.toggle("pb-dark", !!dark);
  }

  // The key facts in one line: where the platform places the account, or its age where the site
  // shows no location, and how it posted.
  function fact(m) {
    const R = m.reading || {}, T = m.tweet || {};
    const age = R.joinDate ? PB.ageDays(R.joinDate) : null;
    const parts = [
      R.basedIn ? `Based in ${R.basedIn}` : m.site && m.site.hasLocation ? (m.lookingUp ? "Reading the About page…" : R.aboutRead ? "No location shown" : null) : null,
      age != null ? (age < 365 ? `${age} days old` : `since ${R.joinDate.slice(0, 7)}`) : null,
      R.karma != null ? `${R.karma.toLocaleString()} karma` : null,
      T.client && !PB.COMMON_CLIENTS.test(T.client) ? `posted via ${T.client}` : null,
    ].filter(Boolean);
    return parts.join(" · ") || null;
  }

  function glance(m, signals) {
    const warn = signals.filter((s) => s.level === "warn").map((s) => s.label);
    return {
      who: [m.display, "@" + m.handle].filter(Boolean).join("  "),
      fact: fact(m),
      warn,
      areas: PBSignals.areas(signals),
    };
  }

  // model: { site, handle, display, posted, profile, reading, flags, markers, machine, tweet, yt, trail, ... }
  function badge(article, model, onLookup) {
    syncTheme();
    const old = article.querySelector(":scope .pb-bar");
    if (old) old.remove();
    PBPop.hover(article, () => {
      const signals = PBSignals.all(model);
      return [{ glance: glance(model, signals) }, ...PBCard.sections(model, signals, onLookup)];
    });
  }

  globalThis.PBUI = Object.freeze({ badge, panel: (...a) => PBPanel.render(...a), closePop: PBPop.close, syncTheme });
})();
