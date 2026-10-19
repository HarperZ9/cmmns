// The popover: opens on hover (after a short delay) or focus, stays open while the pointer is on
// it, pins on click, and closes on Escape or a click elsewhere. Content is built from data with
// textContent only, never innerHTML, so nothing a post says can inject markup.
(() => {
  "use strict";
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const OPEN_MS = 280, CLOSE_MS = 220;
  let pop = null, owner = null, pinned = false, openTimer = 0, closeTimer = 0;

  function close() { clearTimeout(openTimer); clearTimeout(closeTimer); if (pop) pop.remove(); pop = null; owner = null; pinned = false; }

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

  // sections: [{ title?, rows: [[h, t]], signals?: [{ label, level, rows }] , foot? }]
  function build(sections) {
    const p = el("div", "pb-pop");
    p.setAttribute("role", "dialog");
    for (const s of sections) {
      if (!(s.rows || []).some(([, t]) => t) && !(s.signals || []).length && !s.foot) continue;
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
    p.addEventListener("pointerleave", () => { if (!pinned) closeTimer = setTimeout(close, CLOSE_MS); });
    return p;
  }

  function place(p, anchor) {
    const r = anchor.getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = window.innerHeight;
    document.body.append(p);
    const h = p.offsetHeight, w = p.offsetWidth;
    const below = r.bottom + 6 + h < vh || r.top < h + 6;
    p.style.top = `${Math.round(window.scrollY + (below ? r.bottom + 6 : r.top - h - 6))}px`;
    p.style.left = `${Math.round(window.scrollX + Math.max(8, Math.min(r.left, vw - w - 8)))}px`;
  }

  function show(anchor, sections, pin) {
    clearTimeout(closeTimer);
    if (owner === anchor && pop) { if (pin) pinned = true; return; }
    close();
    pop = build(typeof sections === "function" ? sections() : sections);
    owner = anchor; pinned = !!pin;
    place(pop, anchor);
  }

  // Wire a trigger element. `sections` may be a function, so the card is built only when opened.
  function attach(trigger, sections) {
    trigger.addEventListener("pointerenter", () => { clearTimeout(openTimer); openTimer = setTimeout(() => show(trigger, sections, false), OPEN_MS); });
    trigger.addEventListener("pointerleave", () => { clearTimeout(openTimer); if (!pinned && owner === trigger) closeTimer = setTimeout(close, CLOSE_MS); });
    trigger.addEventListener("focus", () => show(trigger, sections, false));
    trigger.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); if (owner === trigger && pinned) close(); else show(trigger, sections, true); });
  }

  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); }, true);
  document.addEventListener("click", (e) => { if (pop && !pop.contains(e.target) && !(owner && owner.contains(e.target))) close(); }, true);
  window.addEventListener("scroll", () => { if (pop && !pinned) close(); }, { passive: true });

  globalThis.PBPop = Object.freeze({ attach, show, close, el });
})();
