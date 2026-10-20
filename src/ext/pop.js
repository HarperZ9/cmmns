// Radar's window: it fades in beside a post when the pointer rests on the post, stays while the
// pointer is on the post or the window, and fades out when it leaves. Clicking inside the window
// keeps it open until Escape or a click elsewhere. Nothing is drawn on the page itself. Content is
// built from data with textContent only, never innerHTML, so nothing a post says can inject markup.
(() => {
  "use strict";
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const OPEN_MS = 450, CLOSE_MS = 260, FADE_MS = 160;
  let pop = null, owner = null, pinned = false, openTimer = 0, closeTimer = 0;

  function close(now) {
    clearTimeout(openTimer); clearTimeout(closeTimer);
    const p = pop;
    pop = null; owner = null; pinned = false;
    if (!p) return;
    if (now) { p.remove(); return; }
    p.classList.remove("pb-in");
    setTimeout(() => p.remove(), FADE_MS);
  }

  // A row value is text, { links: [[label, href]] }, { action: [label, fn, busyLabel] } or { note }.
  function renderRow(box, h, t) {
    if (!t) return;
    const row = el("div", "pb-row");
    if (h) row.append(el("div", "pb-row-h", h));
    if (typeof t === "object" && t.links) {
      const v = el("div", "pb-row-v");
      for (const [label, href] of t.links) { const a = el("a", "pb-link", label); a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer"; v.append(a); }
      row.append(v);
    } else if (typeof t === "object" && t.action) {
      const b = el("button", "pb-btn", t.action[0]); b.type = "button";
      b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); t.action[1](); b.disabled = true; b.textContent = t.action[2] || "Working…"; });
      row.append(b);
    } else row.append(el("div", "pb-row-v", typeof t === "object" ? t.note : t));
    box.append(row);
  }

  // sections: [{ glance?, title?, rows: [[h, t]], signals?: [{ label, level, rows }], foot? }]
  function build(sections) {
    const p = el("div", "pb-pop");
    p.setAttribute("role", "dialog");
    p.setAttribute("aria-label", "Radar");
    for (const s of sections) {
      if (s.glance) { p.append(glance(s.glance)); continue; }
      if (!(s.rows || []).some(([, t]) => t) && !(s.signals || []).length && !(s.foot && !s.title)) continue;
      const sec = el("section", "pb-sec");
      if (s.title) sec.append(el("h3", "pb-sec-h", s.title));
      for (const [h, t] of s.rows || []) renderRow(sec, h, t);
      for (const g of s.signals || []) {
        const d = el("details", `pb-sig pb-${g.level || "info"}`);
        d.append(el("summary", null, g.label));
        for (const [h, t] of g.rows) renderRow(d, h, t);
        sec.append(d);
      }
      if (s.foot) sec.append(el("p", "pb-foot", s.foot));
      if (sec.childNodes.length) p.append(sec);
    }
    p.addEventListener("pointerenter", () => clearTimeout(closeTimer));
    p.addEventListener("pointerleave", () => { if (!pinned) closeTimer = setTimeout(() => close(), CLOSE_MS); });
    p.addEventListener("pointerdown", () => { pinned = true; });
    return p;
  }

  // The first lines: who, the key fact, and the signals worth a look, as plain text.
  function glance(g) {
    const box = el("header", "pb-glance");
    box.append(el("div", "pb-g-who", g.who));
    if (g.fact) box.append(el("div", "pb-g-fact", g.fact));
    if (g.warn && g.warn.length) box.append(el("div", "pb-g-warn", g.warn.join(" · ")));
    if (g.more) box.append(el("div", "pb-g-more", g.more));
    return box;
  }

  // Beside the post: to its right when there is room (outside the timeline column), else to its
  // left, else below or above it. Kept inside the viewport.
  function place(p, target) {
    const r = target.getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = window.innerHeight;
    p.style.visibility = "hidden";
    document.body.append(p);
    const w = p.offsetWidth, h = Math.min(p.offsetHeight, vh - 16);
    let left, top = Math.max(8, Math.min(r.top, vh - h - 8));
    if (r.right + 12 + w <= vw - 8) left = r.right + 12;
    else if (r.left - 12 - w >= 8) left = r.left - 12 - w;
    else {
      // No room beside the post (narrow window): below it, or above it, so the post stays readable.
      left = Math.max(8, Math.min(r.left + 24, vw - w - 8));
      top = r.bottom + 6 + h <= vh ? r.bottom + 6 : r.top - h - 6 >= 8 ? r.top - h - 6 : Math.max(8, vh - h - 8);
    }
    p.style.left = `${Math.round(window.scrollX + left)}px`;
    p.style.top = `${Math.round(window.scrollY + top)}px`;
    p.style.visibility = "";
    requestAnimationFrame(() => p.classList.add("pb-in"));
  }

  function show(target, sections) {
    clearTimeout(closeTimer);
    if (owner === target && pop) return;
    close(true);
    pop = build(typeof sections === "function" ? sections() : sections);
    owner = target;
    place(pop, target);
  }

  // Wire a post. `sections` is a function, so the window is built only when it opens and always
  // shows the post's latest evidence. Wired once per element.
  function hover(target, sections) {
    target.__pbSections = sections;
    if (target.__pbWired) return;
    target.__pbWired = true;
    target.addEventListener("pointerenter", () => { clearTimeout(openTimer); openTimer = setTimeout(() => show(target, () => target.__pbSections()), OPEN_MS); });
    target.addEventListener("pointerleave", () => { clearTimeout(openTimer); if (!pinned && owner === target) closeTimer = setTimeout(() => close(), CLOSE_MS); });
    // Keyboard: Alt+R on a focused post opens its window.
    target.addEventListener("keydown", (e) => { if (e.altKey && (e.key === "r" || e.key === "R")) { e.preventDefault(); show(target, () => target.__pbSections()); pinned = true; } });
  }

  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); }, true);
  document.addEventListener("pointerdown", (e) => { if (pop && pinned && !pop.contains(e.target)) close(); }, true);
  window.addEventListener("scroll", () => { if (pop && !pinned) close(); }, { passive: true });

  globalThis.PBPop = Object.freeze({ hover, show, close, el });
})();
