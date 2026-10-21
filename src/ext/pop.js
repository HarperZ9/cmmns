// Radar's window: it fades in beside a post when the pointer rests on the post, stays while the
// pointer is on the post or the window, and fades out when it leaves. Clicking inside the window
// keeps it open until Escape or a click elsewhere. On a touch screen, where nothing hovers, each post
// gets one small "Radar" button that opens the window on a tap; otherwise nothing is drawn on the
// page itself. Content is
// built from data with textContent only, never innerHTML, so nothing a post says can inject markup.
(() => {
  "use strict";
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const OPEN_MS = 450, CLOSE_MS = 260, FADE_MS = 160;
  const TABS = [["overview", "Overview"], ["account", "Account"], ["post", "This post"], ["history", "History"]];
  // A device whose main pointer cannot hover (phones, Firefox for Android).
  const TOUCH = !!(globalThis.matchMedia && matchMedia("(hover: none)").matches);
  let pop = null, owner = null, pinned = false, openTimer = 0, closeTimer = 0, lastTab = "overview", uid = 0, quiet = null;

  function close(now, refocus) {
    clearTimeout(openTimer); clearTimeout(closeTimer);
    const p = pop, o = owner;
    if (refocus && o && p && (p.contains(document.activeElement) || o.contains(document.activeElement))) { if (document.activeElement !== o) quiet = o; o.focus({ preventScroll: true }); }
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

  // Radar's own pages (a lesson, the self-check) open in a new tab through the worker, which
  // accepts only those pages (PB.safePage). A content script cannot link to them directly.
  function openButton(label, path) {
    const b = el("button", "pb-link pb-open", label); b.type = "button";
    b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); try { chrome.runtime.sendMessage({ type: "pb-open-page", path }).catch(() => {}); } catch (err) { console.error("[radar] could not open", path, err); } });
    return b;
  }

  // A tour tip: its text, "Got it", "No more tips", and an optional page to open.
  function tipBox(tip) {
    const box = el("div", "pb-tip");
    box.setAttribute("role", "note");
    box.append(el("p", null, tip.text));
    const row = el("div", "pb-tip-row");
    if (tip.open) row.append(openButton(tip.open[0], tip.open[1]));
    const done = el("button", "pb-btn", "Got it"); done.type = "button";
    done.addEventListener("click", (e) => { e.stopPropagation(); box.remove(); });
    const stop = el("button", "pb-link pb-open", "No more tips"); stop.type = "button";
    stop.addEventListener("click", (e) => { e.stopPropagation(); if (globalThis.PBTour) PBTour.stop(); box.remove(); });
    row.append(done, stop);
    box.append(row);
    return box;
  }

  // A row value is text, { links }, { action: [label, fn, busyLabel] }, { actions: [[label, fn]] },
  // { feedback }, { open }, { image: dataUrl } (a frame Radar took from the page's own video), { note }, or a chart.
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
    } else if (typeof t === "object" && t.feedback && globalThis.PBFeedback) {
      row.append(PBFeedback.control(t.feedback));
    } else if (typeof t === "object" && t.image) {
      const img = el("img", "pb-frame"); img.src = t.image; img.alt = t.alt || ""; row.append(img);
    } else if (typeof t === "object" && t.actions) {
      const v = el("div", "pb-row-v");
      for (const [label, fn] of t.actions) { const b = el("button", "pb-btn pb-btn-s", label); b.type = "button"; b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); fn(); }); v.append(b); }
      row.append(v);
    } else if (typeof t === "object" && t.open) {
      row.append(openButton(t.open[0], t.open[1]));
    } else if (typeof t === "object" && t.action) {
      const b = el("button", "pb-btn", t.action[0]); b.type = "button";
      b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); t.action[1](); b.disabled = true; b.textContent = t.action[2] || "Working…"; });
      row.append(b);
    } else row.append(el("div", "pb-row-v", typeof t === "object" ? t.note : t));
    box.append(row);
  }

  function section(s) {
    if (s.tip) return tipBox(s.tip);
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
      strip.setAttribute("role", "group");
      strip.setAttribute("aria-label", "Areas");
      for (const a of g.areas) {
        const b = el("button", `pb-area pb-a-${a.level}`); b.type = "button";
        b.append(el("i"), el("span", null, a.name));
        b.title = b.ariaLabel = a.level === "none" ? `${a.name}: nothing found in what the site shows` : `${a.name}: ${a.n} sign${a.n === 1 ? "" : "s"}${a.level === "warn" ? ", worth a look" : ""}`;
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
    const g = (sections.find((s) => s.glance) || {}).glance;
    p.setAttribute("aria-label", g && g.who ? `Radar: ${g.who}` : "Radar");
    p.tabIndex = -1;
    const n = ++uid;
    const panes = new Map(TABS.map(([id]) => { const pane = el("div", "pb-pane"); pane.id = `pb-pane-${n}-${id}`; pane.setAttribute("role", "tabpanel"); pane.setAttribute("aria-labelledby", `pb-tab-${n}-${id}`); return [id, pane]; }));
    const tabbar = el("div", "pb-tabs");
    tabbar.setAttribute("role", "tablist");
    tabbar.setAttribute("aria-label", "Radar sections");
    const select = (id, area) => {
      lastTab = id;
      for (const [k, pane] of panes) pane.hidden = k !== id;
      for (const b of tabbar.children) { const on = b.dataset.tab === id; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; }
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
      b.id = `pb-tab-${n}-${id}`; b.setAttribute("aria-controls", `pb-pane-${n}-${id}`);
      b.addEventListener("click", (e) => { e.stopPropagation(); select(id); });
      tabbar.append(b);
    }
    // Arrow keys move between tabs, as in any tab list.
    tabbar.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const tabs = [...tabbar.children], i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      e.preventDefault(); select(next.dataset.tab); next.focus();
    });
    p.addEventListener("focusin", () => { pinned = true; clearTimeout(closeTimer); });
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

  // Returns the window, or null when there is nothing to show (Radar is off for the site).
  function show(target, sections) {
    clearTimeout(closeTimer);
    if (owner === target && pop) return pop;
    const list = typeof sections === "function" ? sections() : sections;
    close(true);
    if (!list) return null;
    pop = build(list);
    owner = target;
    place(pop, target);
    return pop;
  }
  // Move keyboard focus into the open window: the selected tab, or the window itself.
  function enter(p) {
    if (!p) return;
    pinned = true;
    const tab = p.querySelector('.pb-tab[aria-selected="true"]');
    (tab || p).focus({ preventScroll: true });
  }

  // Wire a post. `sections` is a function, so the window is built only when it opens and always
  // shows the post's latest evidence. Wired once per element.
  function hover(target, sections, anchor) {
    target.__pbSections = sections;
    if (TOUCH) tap(target, anchor || target);
    if (target.__pbWired) return;
    target.__pbWired = true;
    target.addEventListener("pointerenter", (e) => { if (e.pointerType === "touch") return; clearTimeout(openTimer); openTimer = setTimeout(() => show(target, () => target.__pbSections()), OPEN_MS); });
    target.addEventListener("pointerleave", (e) => { if (e.pointerType === "touch") return; clearTimeout(openTimer); if (!pinned && owner === target) closeTimer = setTimeout(() => close(), CLOSE_MS); });
    // Keyboard: focusing the post opens its window; Alt+R moves focus into it; Escape closes it
    // and returns focus to the post. Focus leaving both the post and the window closes it.
    target.addEventListener("focusin", (e) => { if (e.target !== target) return; if (quiet === target) { quiet = null; return; } clearTimeout(openTimer); openTimer = setTimeout(() => show(target, () => target.__pbSections()), 150); });
    target.addEventListener("focusout", (e) => {
      if (owner !== target || !pop || pop.contains(e.relatedTarget) || target.contains(e.relatedTarget)) return;
      clearTimeout(openTimer); close();
    });
    target.addEventListener("keydown", (e) => { if (e.altKey && (e.key === "r" || e.key === "R")) { e.preventDefault(); enter(show(target, () => target.__pbSections())); } });
  }

  // Touch: a tap on the post's button opens its window, held open until a tap elsewhere. The tap
  // never reaches the site, so it does not open the post.
  function tap(target, anchor) {
    if (!anchor || !anchor.isConnected || anchor.querySelector(":scope > .pb-tap")) return;
    const b = el("button", "pb-tap", "Radar");
    b.type = "button";
    b.setAttribute("aria-label", "Show what Radar knows about this post");
    b.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      if (owner === target && pop) { close(); return; }
      if (show(target, () => target.__pbSections())) pinned = true;
    });
    for (const t of ["pointerdown", "touchstart", "mousedown"]) b.addEventListener(t, (e) => e.stopPropagation(), { passive: true });
    anchor.append(b);
  }

  // Rebuild the open window in place with the post's latest evidence (after a media check).
  function refresh() {
    if (!pop || !owner || !owner.__pbSections) return;
    const list = owner.__pbSections();
    if (!list) return;
    const keep = pinned, old = pop, next = build(list);
    next.style.left = old.style.left; next.style.top = old.style.top;
    next.classList.add("pb-in");
    old.replaceWith(next);
    pop = next; pinned = keep;
  }

  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && pop) close(false, true); }, true);
  // Focus leaving the window (Tab past its last control) closes it, unless it went back to the post.
  document.addEventListener("focusin", (e) => { if (pop && !pop.contains(e.target) && !(owner && owner.contains(e.target))) close(); }, true);
  document.addEventListener("pointerdown", (e) => { if (pop && pinned && !pop.contains(e.target) && !(e.target.closest && e.target.closest(".pb-tap"))) close(); }, true);
  window.addEventListener("scroll", () => { if (pop && !pinned) close(); }, { passive: true });

  globalThis.PBPop = Object.freeze({ hover, show, close, el, refresh, tipBox, TOUCH });
})();
