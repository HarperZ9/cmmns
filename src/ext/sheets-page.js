// The sheets page (project-docs/DISCOURSE.md, "Truth as sheets"): the post on top, the replies that
// bring a source beneath it, the primary documents as the ground. Each sheet's ink coverage is its
// reach; "Lift" moves every sheet above it out of the way so what lies beneath shows. The window writes
// the thread to storage when the user opens this page; nothing is fetched.
(() => {
  "use strict";
  const KEY = "pb.sheets.view";
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const n = (x) => Number(x).toLocaleString("en-US");
  const KIND = { claim: "the post", correction: "a reply that brings a source or names an error", document: "a primary document" };

  function reachLine(s, top) {
    if (s.kind === "document") return "No reach figure: a document is the ground the posts lie on.";
    if (s.reach == null || !s.reach) return "The site showed no view count.";
    const many = s.replies > 1 ? `, from ${s.replies} replies that rest on one source` : "";
    return s === top ? `Seen ${n(s.reach)} times${many}.` : `Seen ${n(s.reach)} times${many}: ${s.share}% of the post's reach, so its sheet is ${s.share}% inked.`;
  }

  function lift(items, i) {
    items.forEach((li, j) => { li.classList.toggle("lifted", j < i); li.setAttribute("aria-hidden", j < i ? "true" : "false"); });
    $("foot").textContent = i === 0 ? "" : `${i} ${i === 1 ? "sheet" : "sheets"} lifted. What you see now is ${KIND[items[i].dataset.kind]} with everything under it.`;
  }

  function draw(view) {
    const sheets = PBD.buildSheets(view.thread), top = sheets[0], ind = PBD.independence(sheets);
    $("lead").textContent = `${sheets.length} sheets. The post covers what lies under it by reach: the more people saw a sheet, the more of it is inked. Corrections that share a source are one sheet (${ind.replies} ${ind.replies === 1 ? "reply" : "replies"}, ${ind.origins} ${ind.origins === 1 ? "source" : "sources"}).`;
    const stack = $("stack"), items = [];
    sheets.forEach((s, i) => {
      const li = el("li", `sheet${s.kind === "document" ? " ground" : ""}`);
      li.dataset.kind = s.kind;
      const ink = el("div", "ink"), band = el("span");
      ink.setAttribute("aria-hidden", "true");
      band.style.background = s.seen;
      band.style.width = `${s.kind === "document" ? 0 : Math.max(0, Math.min(100, s.cover * 100))}%`;
      ink.append(band);
      const body = el("div", "body"), txt = el("div");
      txt.append(el("p", "text", s.text), el("p", "reach", reachLine(s, top)));
      if (i < sheets.length - 1) { const b = el("button", null, "Lift to see under it"); b.type = "button"; b.addEventListener("click", () => lift(items, i + 1)); txt.append(b); }
      if (i > 0) { const b = el("button", null, "Put the sheets back"); b.type = "button"; b.addEventListener("click", () => lift(items, 0)); txt.append(b); }
      body.append(el("span", "depth", i === 0 ? "top" : s.kind === "document" ? "ground" : `depth ${i}`), txt);
      li.append(ink, body);
      stack.append(li);
      items.push(li);
    });
    $("foot").textContent = "";
  }

  chrome.storage.local.get(KEY).then((g) => {
    const v = g[KEY];
    if (!v || !v.thread) { $("lead").textContent = "Open this page from a post's window, under Discourse checks."; return; }
    draw(v);
  }).catch((e) => { console.error("[cmmns] could not read the sheets", e); $("lead").textContent = "Could not read the sheets."; });
})();
