// Two parts of the thread report (src/ext/panel.js) that work on the thread as a whole:
// - The reply timeline: a strip of bars, one per stretch of time, with the stretches the timing test
//   marked as bursts drawn in the sign colour and underlined, so a burst never rests on colour alone.
//   The strip is a picture with one sentence as its name; the same sentence is printed under it.
//   Nothing moves.
// - Save the thread: the replies the page has loaded, with their times and badges, as one Markdown
//   note or as JSON Lines (src/core/thread-save.js), written to this computer through the same save
//   path as every other CMMNS save (src/ext/quick-save.js). Built on the click; nothing is sent.
(() => {
  "use strict";
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  // t: PB.replyTimeline(). Returns the section, or null when there is nothing to draw.
  function timeline(t) {
    if (!t) return null;
    const sentence = PB.timelineSentence(t);
    const s = el("section", "pb-psec pb-tl-sec");
    s.append(el("h3", "pb-sec-h", "Reply timeline"));
    const fig = el("div", "pb-tl");
    fig.setAttribute("role", "img");
    fig.setAttribute("aria-label", sentence);
    for (const b of t.bins) {
      const bar = el("i", b.burst ? "pb-tl-burst" : b.n ? null : "pb-zero");
      bar.style.height = `${b.n ? Math.max(8, Math.round((b.n / t.peak) * 100)) : 2}%`;
      bar.title = `${b.from.slice(11, 19)} to ${b.to.slice(11, 19)} UTC: ${b.n} repl${b.n === 1 ? "y" : "ies"}${b.burst ? ", burst" : ""}`;
      fig.append(bar);
    }
    const axis = el("div", "pb-axis");
    axis.setAttribute("aria-hidden", "true");
    axis.append(el("span", null, `${t.from.slice(11, 16)} UTC`), el("span", null, `${t.to.slice(11, 16)} UTC`));
    s.append(fig, axis, el("p", "pb-num", sentence));
    if (t.bursts) s.append(el("p", "pb-foot", PB.TIMELINE_DOES_NOT_PROVE));
    return s;
  }

  const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

  // format: "note" | "jsonl". ctx: { site, root, replies, rows, clusters, bursts }.
  async function save(format, ctx) {
    const input = { ...ctx, site: ctx.site.name, page: location.href, savedAt: new Date().toISOString(), tool: "CMMNS " + chrome.runtime.getManifest().version };
    const jsonl = format === "jsonl";
    const text = jsonl ? PB.threadJsonl(input) : PB.threadMarkdown(input);
    const name = `cmmns-thread-${ctx.site.id}-${stamp()}.${jsonl ? "jsonl" : "md"}`;
    const toast = (t, o) => (globalThis.PBQuickToast ? PBQuickToast.show(t, o) : null);
    try {
      const saved = await PBQuickSave.saveText(new TextEncoder().encode(text), jsonl ? "application/x-ndjson" : "text/markdown", name, location.hostname.replace(/^www\./, ""), false);
      toast(`Saved the thread: ${saved}`, { tone: "ok" });
    } catch (e) {
      PBGuard.report("could not save the thread", e);
      toast(`Not saved: ${e.message}`, { tone: "no" });
    }
  }

  globalThis.PBThreadTools = Object.freeze({ timeline, save });
})();
