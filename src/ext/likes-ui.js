// The "Save all likes" bar (likes.js), drawn in the lower left of X's likes list. It shows the counts
// (found, listed for fetching, saved, already saved, failed, and against the archive's checklist how
// many are still missing), Pause, Stop, the command that fetches the files, and Import like.js. In the
// builds that carry auto-scroll (likes-scroll.js) also the pace and the scroll button; elsewhere the
// posts are collected as the user scrolls. Hidden with the in-post Download buttons (the same setting),
// and so in source-protection mode.
(() => {
  "use strict";
  if (!globalThis.PBLikes) return;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const PACE_KEY = "pb.likes.pace";
  let bar = null, pace = "careful", scrolling = false, mode = globalThis.PBLikesScroll ? "manifest" : "browser";
  try { chrome.storage.local.get(PACE_KEY).then((g) => { if (g[PACE_KEY] && PBLikesScroll && PBLikesScroll.PACES[g[PACE_KEY]]) pace = g[PACE_KEY]; }).catch(() => {}); } catch { /* storage unavailable */ }
  const on = () => !globalThis.PBSettings || PBSettings.get().mediaButtons !== false;
  const FETCH = "cmmns likes fetch --watch";

  function button(label, title, fn) {
    const b = el("button", "pb-lib-btn", label);
    b.type = "button"; b.title = title;
    b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); Promise.resolve(fn(b)).catch((x) => PBQuickToast.show(`Save all likes: ${x.message}`, { tone: "no", stay: 8000 })); });
    return b;
  }

  function counts(s) {
    const parts = [`${s.found} found`, mode === "manifest" ? `${s.listed} listed for fetching` : `${s.saved} saved`, `${s.duplicate} already saved`, s.failed ? `${s.failed} failed` : null,
      s.waiting ? `${s.waiting} waiting` : null, s.checklist ? `${s.missing} of ${s.checklist} in the archive still missing` : null].filter(Boolean);
    return `Likes: ${parts.join(", ")}`;
  }

  async function scroll() {
    scrolling = true; render();
    const why = await PBLikesScroll.run({ pace: () => pace, stopped: () => PBLikes.status().status === "stopped", paused: () => PBLikes.status().status === "paused",
      pending: PBLikes.pending, seen: () => PBLikes.status().found, resumeY: PBLikes.resumeY ? PBLikes.resumeY() : 0 });
    scrolling = false;
    const error = /^X showed/.test(why);
    if (PBLikes.status().status !== "stopped") await PBLikes.stop(why, { resumable: error });
    PBQuickToast.show(`Save all likes stopped: ${why}.`, { tone: error ? "no" : "ok", stay: error ? 20000 : 8000 });
    render();
  }

  async function begin(resume) {
    await PBLikes.start(mode);
    if (resume && PBLikes.resumeY) PBQuickToast.show("Continuing: posts already done are counted, not saved again.", { stay: 5000 });
    if (globalThis.PBLikesScroll) scroll(); else render();
  }

  function importButton() {
    const input = el("input");
    input.type = "file"; input.accept = ".js,application/javascript,text/javascript"; input.hidden = true;
    input.addEventListener("change", async () => {
      const f = input.files && input.files[0];
      if (!f) return;
      try { const n = await PBLikes.importArchive(await f.text()); PBQuickToast.show(`Checklist from your archive: ${n} likes. The bar now counts the ones still missing.`, { tone: "ok", stay: 8000 }); }
      catch (e) { PBQuickToast.show(`like.js not read: ${e.message}`, { tone: "no", stay: 8000 }); }
      render();
    });
    const b = button("Import like.js", "Your X data archive (Settings, Your account, Download an archive) holds data/like.js, the list of every post you liked. It is read here, on this computer, as the checklist; nothing is sent.", () => input.click());
    return [input, b];
  }

  function controls(s) {
    const running = s.status === "running" || s.status === "paused";
    if (running) {
      bar.append(button(s.status === "paused" ? "Resume" : "Pause", "Pauses scrolling and saving; the record is kept", () => PBLikes.pause(s.status !== "paused")));
      bar.append(button("Stop", "Stops, writes the manifest, and keeps the record so the next run skips what is done", () => PBLikes.stop()));
    } else {
      const sel = el("select", "pb-lib-cap");
      sel.title = "Fetch with the command line (fastest: it reads the manifest this page writes and saves the files itself), or save each file from this page";
      for (const [v, t] of [["manifest", "Command line fetch"], ["browser", "Save in the browser"]]) { const o = el("option", null, t); o.value = v; sel.append(o); }
      sel.value = mode; sel.addEventListener("change", () => { mode = sel.value; });
      bar.append(sel, button(s.status === "resumable" ? "Resume saving likes" : "Save all likes", "Collects every liked post this page loads, once each; posts already saved are skipped", () => begin(s.status === "resumable")));
    }
    if (globalThis.PBLikesScroll && !scrolling) {
      const p = el("select", "pb-lib-cap");
      p.title = PBLikesScroll.PACE_NOTE;
      for (const k of Object.keys(PBLikesScroll.PACES)) { const o = el("option", null, k[0].toUpperCase() + k.slice(1)); o.value = k; p.append(o); }
      p.value = pace; p.addEventListener("change", () => { pace = p.value; try { chrome.storage.local.set({ [PACE_KEY]: pace }); } catch { /* kept for this page */ } });
      bar.append(p);
    }
    bar.append(button("Copy fetch command", "Copies the command that fetches every listed file straight from X's media hosts into Downloads/CMMNS/x/ (needs CMMNS' command line)", async () => {
      await navigator.clipboard.writeText(FETCH);
      PBQuickToast.show(`Copied: ${FETCH}`, { tone: "ok", stay: 9000 });
    }), ...importButton());
  }

  function render() {
    const here = on() && PBLikes.route(), s = PBLikes.status();
    if (!here && !(s.status === "running" || s.status === "paused")) { if (bar) { bar.remove(); bar = null; } return; }
    if (!bar) { bar = el("div", "pb-lib pb-likes"); bar.setAttribute("role", "status"); document.documentElement.append(bar); }
    bar.replaceChildren(el("span", "pb-lib-count", counts(s)));
    if (s.why && s.status !== "running") bar.append(el("span", "pb-lib-up", `Stopped: ${s.why}.`));
    controls(s);
  }

  // X changes address without loading a page: leaving the likes list stops the run.
  let here = location.href;
  setInterval(() => {
    if (location.href === here) return;
    here = location.href;
    const s = PBLikes.status();
    if ((s.status === "running" || s.status === "paused") && !PBLikes.route()) PBLikes.stop("the page moved away from the likes", { resumable: true }).then(render);
    else render();
  }, 1000);
  let last = null;
  PBLikes.onChange((s) => { const c = bar && bar.querySelector(".pb-lib-count"); if (c && s.status === last) { c.textContent = counts(s); return; } last = s.status; render(); });
  if (globalThis.PBSettings) { PBSettings.ready.then(render); PBSettings.onChange(render); }
  render();
})();
