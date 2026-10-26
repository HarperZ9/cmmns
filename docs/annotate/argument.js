// The argument annotation page (project-docs/ARGUMENT-LENS.md). Loads the 60 fixed gold passages,
// lets one person mark breaks and roles, keeps progress in this browser, and saves a file the scorer
// reads (scripts/eval-argument-gold.mjs). Nothing is sent anywhere.
(() => {
  "use strict";
  const ROLES = ["premise", "minor premise", "supporting premise", "assumption", "conclusion", "turn", "other"];
  const KEY = "dc.argument-annotation";
  const $ = (id) => document.getElementById(id);
  const el = (tag, attrs = {}, text) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text != null) e.textContent = text; return e; };
  let state = { annotator: "", passages: {} };
  try { state = JSON.parse(localStorage.getItem(KEY)) || state; } catch (e) { console.warn("could not read saved annotations", e); }
  const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn("could not keep annotations", e); } $("state").textContent = `${Object.values(state.passages).filter((p) => p.boundaries.length || p.roles.some(Boolean)).length} of 60 passages marked`; };

  function draw(p) {
    const box = el("section", { class: "passage", "data-lang": p.lang });
    box.append(el("p", { class: "meta" }, `${p.id} · ${p.source} · ${p.locator}`));
    const words = el("div", { class: "words" }), segs = el("ol", { class: "segs" });
    const mine = state.passages[p.id] || (state.passages[p.id] = { boundaries: [], roles: [] });
    const tokens = [...p.text.matchAll(/\S+/g)];
    const refresh = () => {
      segs.textContent = "";
      const cuts = [0, ...mine.boundaries.slice().sort((a, b) => a - b), p.text.length];
      for (let i = 0; i < cuts.length - 1; i++) {
        const li = el("li"), sel = el("select", { "aria-label": `role of part ${i + 1}` });
        sel.append(el("option", { value: "" }, "choose a role"), ...ROLES.map((r) => el("option", { value: r }, r)));
        sel.value = mine.roles[i] || "";
        sel.addEventListener("change", () => { mine.roles[i] = sel.value; keep(); });
        li.append(sel, el("span", {}, p.text.slice(cuts[i], cuts[i + 1]).trim()));
        segs.append(li);
      }
      mine.roles.length = cuts.length - 1;
    };
    tokens.forEach((t, k) => {
      if (k > 0) {
        const g = el("button", { class: "gap", type: "button", "aria-label": `break before "${t[0]}"` });
        if (mine.boundaries.includes(t.index)) g.classList.add("cut");
        g.addEventListener("click", () => {
          const i = mine.boundaries.indexOf(t.index);
          if (i >= 0) mine.boundaries.splice(i, 1); else mine.boundaries.push(t.index);
          g.classList.toggle("cut");
          mine.roles = [];
          refresh(); keep();
        });
        words.append(g);
      }
      words.append(el("span", {}, t[0]));
    });
    refresh();
    box.append(words, segs);
    return box;
  }

  function save() {
    state.annotator = $("who").value.trim() || state.annotator;
    if (!state.annotator) { $("state").textContent = "Add your initials first, so the two annotations can be told apart."; return; }
    const out = { format: "daylight.argument-annotation/1", annotator: state.annotator, saved: new Date().toISOString(), passages: state.passages };
    const a = el("a", { href: URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: "application/json" })), download: `argument-annotation-${state.annotator}.json` });
    document.body.append(a); a.click(); a.remove();
  }

  fetch("passages.json").then((r) => r.json()).then((d) => {
    const list = $("list");
    for (const p of d.passages) list.append(draw(p));
    $("who").value = state.annotator || "";
    $("lang").addEventListener("change", () => { for (const s of list.children) s.hidden = !!$("lang").value && s.dataset.lang !== $("lang").value; });
    $("save").addEventListener("click", save);
    keep();
  }).catch((e) => { console.error("could not load the passages", e); $("state").textContent = "Could not load the passages."; });
})();
