// The hover Download control's drawing (quick-hover.js decides when it shows). A host element in the
// browser's top layer (a manual popover) holds a closed shadow root, so the site's styles never reach
// it and it never moves the page: the host is fixed, sized to nothing, and only the two buttons take
// the pointer. Download saves; the second button opens a short menu. Buttons are 28 px, keyboard
// reachable, with a visible focus ring, and nothing animates.
globalThis.PBHoverUi = globalThis.PBHoverUi || (() => {
  "use strict";
  const CSS = `:host { all: initial; position: fixed !important; inset: auto !important; left: 0; top: 0; width: 0; height: 0; margin: 0; padding: 0; border: 0;
  overflow: visible; background: transparent; z-index: 2147483646; pointer-events: none; }
.bar { position: fixed; display: flex; gap: 2px; padding: 2px; border-radius: 4px; background: rgba(22,19,15,.78); pointer-events: auto;
  font: 600 12px/16px "Hanken Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
button { all: unset; box-sizing: border-box; min-width: 28px; height: 28px; padding: 0 6px; display: inline-flex; align-items: center; justify-content: center;
  gap: 4px; border-radius: 3px; color: #ebe5d8; cursor: pointer; }
button:hover { background: rgba(235,229,216,.16); }
button:focus-visible { outline: 2px solid #ebe5d8; outline-offset: 1px; }
svg { width: 16px; height: 16px; fill: currentColor; }
.menu { position: fixed; min-width: 168px; padding: 4px; border-radius: 4px; background: #ebe5d8; color: #16130f; pointer-events: auto;
  box-shadow: 0 10px 30px rgba(22,19,15,.2), 0 0 0 1px rgba(123,114,98,.55); font: 500 13px/18px "Hanken Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
.menu button { display: flex; width: 100%; justify-content: flex-start; color: #16130f; padding: 0 10px; }
.menu button:hover { background: rgba(22,19,15,.08); }
.menu button:focus-visible { outline-color: #16130f; }
.menu hr { border: 0; border-top: 1px solid #c9bfab; margin: 4px 2px; }
@media (prefers-color-scheme: dark) { .menu { background: #111114; color: #ece5d6; } .menu button { color: #ece5d6; } .menu button:hover { background: rgba(236,229,214,.1); }
  .menu button:focus-visible { outline-color: #ece5d6; } .menu hr { border-top-color: #38363b; } }`;
  const DOWN = "M12 3.5a1 1 0 0 1 1 1v8.09l2.8-2.8a1 1 0 1 1 1.4 1.42l-4.5 4.5a1 1 0 0 1-1.4 0l-4.5-4.5a1 1 0 0 1 1.4-1.42l2.8 2.8V4.5a1 1 0 0 1 1-1zM5 18.5a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1z";
  const MORE = "M6 10.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z";
  const ITEMS = [["study", "Study"], ["gif", "Download as GIF"], ["copy", "Copy"], ["link", "Copy link"], ["caption", "Copy with caption"], ["daylight", "Save to Daylight"], null, ["never", "Never on this site"], ["off", "Turn off hover download"]];
  let host = null, root = null, bar = null, menu = null, onAction = () => {}, items = ITEMS;

  function icon(d) {
    const ns = "http://www.w3.org/2000/svg", s = document.createElementNS(ns, "svg"), p = document.createElementNS(ns, "path");
    s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true"); p.setAttribute("d", d); s.append(p);
    return s;
  }
  function button(label, d, action, extra = {}) {
    const b = document.createElement("button");
    b.type = "button"; b.setAttribute("aria-label", label); b.title = label;
    for (const [k, v] of Object.entries(extra)) b.setAttribute(k, v);
    if (d) b.append(icon(d));
    b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); action(e); });
    return b;
  }

  // Clicks, presses and context menus on the control stop here: the site never sees them.
  function guard(el) {
    for (const t of ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "dblclick", "contextmenu", "touchstart", "touchend"]) el.addEventListener(t, (e) => e.stopPropagation());
  }

  function mount() {
    if (host && host.isConnected) return;
    host = document.createElement("daylight-hover");
    host.setAttribute("popover", "manual");
    root = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = CSS;
    root.append(style);
    guard(host);
    // A press on a button must not clear the page's text selection ("Save selection" needs it).
    root.addEventListener("mousedown", (e) => e.preventDefault());
    document.documentElement.append(host);
    try { host.showPopover(); } catch { /* no top layer here: the fixed host with a high z-index stands in */ }
  }

  function closeMenu() { if (menu) { menu.remove(); menu = null; } }

  function openMenu(anchor) {
    closeMenu();
    menu = document.createElement("div");
    menu.className = "menu"; menu.setAttribute("role", "menu");
    for (const it of items) {
      if (!it) { menu.append(document.createElement("hr")); continue; }
      const b = button(it[1], null, () => { closeMenu(); onAction(it[0]); }, { role: "menuitem" });
      b.textContent = it[1];
      menu.append(b);
    }
    const r = anchor.getBoundingClientRect();
    menu.style.left = `${Math.max(4, Math.min(r.right - 168, innerWidth - 176))}px`;
    menu.style.top = `${r.bottom + 4 + 260 > innerHeight ? Math.max(4, r.top - 264) : r.bottom + 4}px`;
    menu.addEventListener("keydown", (e) => {
      const items = [...menu.querySelectorAll("button")], i = items.indexOf(root.activeElement);
      if (e.key === "Escape") { e.stopPropagation(); closeMenu(); anchor.focus(); }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length].focus(); }
    });
    root.append(menu);
    menu.querySelector("button").focus();
  }

  // Shows the control at the top-right corner of rect. label names the file type for screen readers;
  // menu replaces the default menu items ([[action, label], null for a rule]).
  function show(rect, label, handler, menuItems = null) {
    mount();
    onAction = handler; items = menuItems || ITEMS;
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "bar"; bar.setAttribute("role", "group"); bar.setAttribute("aria-label", "Daylight Commons");
      const dl = button("Download", DOWN, () => onAction("download"));
      const more = button("More ways to save", MORE, () => (menu ? closeMenu() : openMenu(more)), { "aria-haspopup": "menu" });
      bar.append(dl, more);
      root.append(bar);
    }
    bar.firstChild.setAttribute("aria-label", label); bar.firstChild.title = label;
    place(rect);
    bar.hidden = false;
  }

  function place(rect) {
    if (!bar) return;
    const w = 62, x = Math.min(Math.max(rect.right - w - 8, rect.left + 4, 4), innerWidth - w - 4), y = Math.min(Math.max(rect.top + 8, 4), innerHeight - 36);
    bar.style.left = `${Math.round(x)}px`; bar.style.top = `${Math.round(y)}px`;
  }

  function hide() { closeMenu(); if (bar) bar.hidden = true; }
  // True when the point is over the control or its menu (the pointer may leave the media for them).
  function covers(x, y) {
    return [bar, menu].some((el) => { if (!el || el.hidden) return false; const r = el.getBoundingClientRect(); return x >= r.left - 4 && x <= r.right + 4 && y >= r.top - 4 && y <= r.bottom + 4; });
  }
  const menuOpen = () => !!menu;
  const isHost = (el) => el === host;

  return Object.freeze({ show, place, hide, covers, menuOpen, isHost, ITEMS });
})();
