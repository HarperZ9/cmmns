// The "Save page as library" control (library.js), drawn in the lower left of X profile, list and
// search pages and Reddit user and subreddit pages. While a library fills it shows the counts and
// a Stop button; in the builds that carry auto-scroll (library-scroll.js) also a cap and a button
// that scrolls to the end. Hidden with the in-post Download buttons (the same setting), and so in
// source-protection mode.
(() => {
  "use strict";
  if (!globalThis.PBLibrary) return;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const CAP_KEY = "pb.library.cap";
  let bar = null, here = location.href, auto = false, cap = PB.LIBRARY_CAP;
  try { chrome.storage.local.get(CAP_KEY).then((g) => { if (Number(g[CAP_KEY]) > 0) cap = Number(g[CAP_KEY]); }).catch(() => {}); } catch { /* storage unavailable */ }
  const on = () => !globalThis.PBSettings || PBSettings.get().mediaButtons !== false;

  function button(label, title, fn) {
    const b = el("button", "pb-lib-btn", label);
    b.type = "button"; b.title = title;
    b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); fn(b); });
    return b;
  }
  const fail = (e) => PBQuickToast.show(`Library not started: ${e.message}`, { tone: "no", stay: 7000 });

  function counts(s) {
    const parts = [`${s.saved} saved`, s.skipped ? `${s.skipped} skipped` : null, s.already ? `${s.already} already in it` : null, s.queued ? `${s.queued} waiting` : null].filter(Boolean);
    return `Library ${s.folder}: ${parts.join(", ")}`;
  }

  // The cap and the scroll button, only where library-scroll.js is in the build.
  function autoControls(row, s) {
    if (!globalThis.PBLibraryScroll || !s.running) return;
    const input = el("input", "pb-lib-cap");
    input.type = "number"; input.min = "1"; input.value = String(cap); input.title = "Stop after this many posts are saved"; input.disabled = auto;
    input.addEventListener("change", () => { cap = Math.max(1, Number(input.value) || PB.LIBRARY_CAP); try { chrome.storage.local.set({ [CAP_KEY]: cap }); } catch { /* kept for this page */ } });
    const go = button(auto ? "Scrolling" : PBLibraryScroll.LABEL, "Scrolls the page at a reading pace until the end of the feed, the cap, or Stop", () => scroll());
    go.disabled = auto;
    row.append(el("span", "pb-lib-up", "up to"), input, go);
  }

  async function scroll() {
    auto = true; render();
    const first = PBLibrary.status();
    const why = await PBLibraryScroll.run({ cap, saved: () => PBLibrary.status().saved, pending: PBLibrary.pending, stopped: () => !PBLibrary.status().running,
      progress: () => { const s = PBLibrary.status(); return s.saved + s.skipped + s.already - (first.saved + first.skipped + first.already); } });
    auto = false;
    if (PBLibrary.status().running) await PBLibrary.stop(why);
    if (why !== "Stop pressed") PBQuickToast.show(`Library stopped: ${why}. index.jsonl and LIBRARY.md are written.`, { tone: "ok", stay: 8000 });
  }

  function render() {
    const lib = on() ? PB.libraryOf(location.href) : null, s = PBLibrary.status();
    if (!lib && !s.running) { if (bar) { bar.remove(); bar = null; } return; }
    if (!bar) { bar = el("div", "pb-lib"); bar.setAttribute("role", "status"); document.documentElement.append(bar); }
    bar.replaceChildren();
    if (s.running) {
      bar.append(el("span", "pb-lib-count", counts(s)));
      bar.append(button("Stop", "Stops after the post being saved, then writes index.jsonl and LIBRARY.md", () => PBLibrary.stop().then((x) => PBQuickToast.show(`Library ${x.folder}: ${x.total} posts in it. index.jsonl and LIBRARY.md are written.`, { tone: "ok", stay: 7000 }))));
      autoControls(bar, s);
      return;
    }
    if (s.folder && s.why) bar.append(el("span", "pb-lib-count", `Stopped: ${s.why}. ${s.total} posts in ${s.folder}.`));
    bar.append(button("Save page as library", `Saves every post this page loads, once each, into the library folder ${lib.folder}`, (b) => { b.disabled = true; PBLibrary.start(lib).catch(fail).finally(render); }));
  }

  // X and Reddit change address without loading a page: a library stops when its page is left.
  setInterval(() => {
    if (location.href === here) return;
    here = location.href;
    const s = PBLibrary.status(), lib = PB.libraryOf(here);
    if (s.running && (!lib || lib.folder !== s.folder)) PBLibrary.stop("the page moved to another address").then(render);
    else render();
  }, 1000);
  PBLibrary.onChange(() => { if (bar && PBLibrary.status().running) { const c = bar.querySelector(".pb-lib-count"); if (c) { c.textContent = counts(PBLibrary.status()); return; } } render(); });
  if (globalThis.PBSettings) { PBSettings.ready.then(render); PBSettings.onChange(render); }
  render();
})();
