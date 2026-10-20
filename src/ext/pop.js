// Radar's window: it fades in beside a post when the pointer rests on the post, stays while the
// pointer is on the post or the window, and fades out when it leaves. Clicking inside the window
// keeps it open until Escape or a click elsewhere. Nothing is drawn on the page itself. Content is
// built from data with textContent only, never innerHTML, so nothing a post says can inject markup.
(() => {
  "use strict";
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const OPEN_MS = 450, CLOSE_MS = 260, FADE_MS = 160;
  const TABS = [["overview", "Overview"], ["account", "Account"], ["post", "This post"], ["history", "History"]];
  let pop = null, owner = null, pinned = false, openTimer = 0, closeTimer = 0, lastTab = "overview";

  function close(now) {
    clearTimeout(openTimer); clearTimeout(closeTimer);
    const p = pop;
    pop = null; owner = null; pinned = false;
    if (!p) return;
    if (now) { p.remove(); return; }
    p.classList.remove("pb-in");
    setTimeout(() => p.remove(), FADE_MS);
  }

  // Small charts. Each bar carries a title for hover, and the numbers are also in the text rows.
  function bars(values, titles, cls) {
    const box = el("div", `pb-mini ${cls}`), max = Math.max(1, ...values);
    values.forEach((v, i) => { const b = el("i"); b.style.height = `${Math.max(v ? 8 : 2, Math.round((v / max) * 100))}%`; if (!v) b.className = "pb-zero"; b.title = titles[i]; box.append(b); });
    return box;
  }
  function chart(t) {
    if (t.hours) {
      const wrap = el("div", "pb-chart");
      wrap.append(bars(t.hours, t.hours.map((n, h) => `${String(h).padStart(2, "0")}:00 UTC: ${n} post${n === 1 ? "" : "s"}`), "pb-hours"));
      const axis = el("div", "pb-axis"); for (const h of ["00", "06", "12", "18", "24 UTC"]) axis.append(el("span", null, h));
      wrap.append(axis);
      return wrap;
    }
    if (t.days) return bars(t.days.map((d) => d.n), t.days.map((d) => `${d.day}: ${d.n} post${d.n === 1 ? "" : "s"}`), "pb-days");
    if (t.stack) {
      const wrap = el("div", "pb-chart"), bar = el("div", "pb-stack");
      t.stack.forEach((s, i) => { const seg = el("i", `pb-s${Math.min(i, 3)}`); seg.style.width = `${Math.round(s.share * 100)}%`; seg.title = `${s.label}: ${Math.round(s.share * 100)}%`; bar.append(seg); });
      wrap.append(bar, el("div", "pb-legend", t.stack.map((s) => `${s.label} ${Math.round(s.share * 100)}%`).join(" · ")));
      return wrap;
    }
    return null;
  }

  // A row value is text, { links }, { action: [label, fn, busyLabel] }, { note }, or a chart.
  function renderRow(box, h, t) {
    if (!t) return;
    const row = el("div", "pb-row");
    if (h) row.append(el("div", "pb-row-h", h));
    const c = typeof t === "object" ? chart(t) : null;
    if (c) row.append(c);
    else if (typeof t === "object" && t.links) {
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

  function section(s) {
    if (!(s.rows || []).some(([, t]) => t) && !(s.signals || []).length && !(s.foot && !s.title)) return null;
    const sec = el("section", "pb-sec");
    if (s.area) sec.dataset.area = s.area;
    if (s.title) sec.append(el("h3", "pb-sec-h", s.title));
    for (const [h, t] of s.rows || []) renderRow(sec, h, t);
    for (const g of s.signals || []) {
      const d = el("details", `pb-sig pb-${g.level || "info"}`);
      d.append(el("summary", null, g.label));
      for (const [h, t] of g.rows) renderRow(d, h, t);
      sec.append(d);
    }
    if (s.foot) sec.append(el("p", "pb-foot", s.foot));
    return sec;
  }

  // The head: who, the key facts, the warnings, then the area strip. Clicking an area opens the
  // Overview tab at that area's evidence.
  function head(g, select) {
    const box = el("header", "pb-glance");
    box.append(el("div", "pb-g-who", g.who));
    if (g.fact) box.append(el("div", "pb-g-fact", g.fact));
    if (g.warn && g.warn.length) box.append(el("div", "pb-g-warn", g.warn.join(" · ")));
    if (g.areas) {
      const strip = el("div", "pb-strip");
      strip.setAttribute("role", "list");
      for (const a of g.areas) {
        const b = el("button", `pb-area pb-a-${a.level}`); b.type = "button"; b.setAttribute("role", "listitem");
        b.append(el("i"), el("span", null, a.name));
        b.title = a.level === "none" ? `${a.name}: nothing found in what the site shows` : `${a.name}: ${a.n} sign${a.n === 1 ? "" : "s"}${a.level === "warn" ? ", worth a look" : ""}`;
        if (a.n) b.addEventListener("click", (e) => { e.stopPropagation(); select("overview", a.id); });
        else b.disabled = true;
        strip.append(b);
      }
      box.append(strip);
    }
    return box;
  }

  // sections: [{ glance }, { tab, title?, area?, rows?, signals?, foot? }, ...]
  function build(sections) {
    const p = el("div", "pb-pop");
    p.setAttribute("role", "dialog");
    p.setAttribute("aria-label", "Radar");
    const panes = new Map(TABS.map(([id]) => [id, el("div", "pb-pane")]));
    const tabbar = el("nav", "pb-tabs");
    const select = (id, area) => {
      lastTab = id;
      for (const [k, pane] of panes) pane.hidden = k !== id;
      for (const b of tabbar.children) b.setAttribute("aria-selected", String(b.dataset.tab === id));
      if (area) { const sec = panes.get(id).querySelector(`[data-area="${area}"]`); if (sec) { sec.querySelectorAll("details").forEach((d) => (d.open = true)); sec.scrollIntoView({ block: "nearest" }); } }
    };
    for (const s of sections) {
      if (s.glance) { p.append(head(s.glance, select)); continue; }
      const sec = section(s);
      if (sec) panes.get(s.tab || "overview").append(sec);
    }
    for (const [id, name] of TABS) {
      if (!panes.get(id).childNodes.length) continue;
      const b = el("button", "pb-tab", name); b.type = "button"; b.dataset.tab = id; b.setAttribute("role", "tab");
      b.addEventListener("click", (e) => { e.stopPropagation(); select(id); });
      tabbar.append(b);
    }
    p.append(tabbar, ...[...panes.values()].filter((x) => x.childNodes.length));
    select(panes.get(lastTab).childNodes.length ? lastTab : "overview");
    p.addEventListener("pointerenter", () => clearTimeout(closeTimer));
    p.addEventListener("pointerleave", () => { if (!pinned) closeTimer = setTimeout(() => close(), CLOSE_MS); });
    p.addEventListener("pointerdown", () => { pinned = true; });
    return p;
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
