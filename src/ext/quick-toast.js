// A short note in the page's corner after a one-click download: what is happening, what was saved
// and its size, or why nothing was. It sits in its own shadow root so the site's styles never
// touch it, takes no focus, and leaves after a few seconds. One note at a time.
globalThis.PBQuickToast = globalThis.PBQuickToast || (() => {
  "use strict";
  const CSS = `:host { all: initial; }
.t { position: fixed; z-index: 2147483647; left: 16px; bottom: 16px; max-width: min(420px, calc(100vw - 32px)); box-sizing: border-box;
  padding: 10px 14px; border-radius: 2px; background: #ebe5d8; color: #16130f; box-shadow: 0 10px 30px rgba(22,19,15,.16), 0 0 0 1px rgba(123,114,98,.55);
  font: 500 13px/19px "Hanken Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; border-left: 3px solid #7b7262; }
.t.ok { border-left-color: #0a6b61; } .t.no { border-left-color: #8f3a19; }
.t button { font: inherit; font-weight: 600; margin: 6px 8px 0 0; padding: 3px 10px; border-radius: 2px; border: 1px solid #7b7262; background: transparent; color: inherit; cursor: pointer; }
.t button:hover { border-color: #16130f; }
.t button:focus-visible { outline: 2px solid #16130f; outline-offset: 2px; }
.t input { font: inherit; width: 100%; box-sizing: border-box; margin-top: 6px; padding: 4px 6px; border-radius: 2px; border: 1px solid #7b7262; background: transparent; color: inherit; }
.t input:focus-visible { outline: 2px solid currentColor; outline-offset: 1px; }
@media (prefers-color-scheme: dark) { .t { background: #111114; color: #ece5d6; box-shadow: 0 10px 30px rgba(0,0,0,.7), 0 0 0 1px rgba(111,106,97,.9); }
  .t.ok { border-left-color: #63d4ce; } .t.no { border-left-color: #e29472; } .t button:hover { border-color: #ece5d6; } }
@media (prefers-reduced-motion: no-preference) { .t { animation: in .16s ease-out; } @keyframes in { from { opacity: 0; transform: translateY(6px); } } }`;
  let host = null, box = null, timer = 0, last = null;

  function mount() {
    if (host && host.isConnected) return;
    host = document.createElement("daylight-toast");
    const root = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = CSS;
    box = document.createElement("div");
    box.setAttribute("role", "status");
    box.setAttribute("aria-live", "polite");
    root.append(style, box);
    (document.body || document.documentElement).append(host);
  }

  // show(text, { tone: "ok" | "no" | null, stay: ms, actions: [[label, fn]], input: { label, onSubmit } })
  // input adds one optional line; Enter submits it, and typing keeps the note open.
  function show(text, { tone = null, stay = 4000, actions = [], input = null } = {}) {
    last = { text, tone };
    try {
      mount();
      box.className = "t" + (tone ? " " + tone : "");
      box.replaceChildren(document.createTextNode(text));
      for (const [label, fn] of actions) {
        const b = document.createElement("button");
        b.type = "button"; b.textContent = label;
        b.addEventListener("click", () => { hide(); fn(); });
        box.append(document.createElement("br"), b);
      }
      if (input) {
        const f = document.createElement("input");
        f.type = "text"; f.placeholder = input.label; f.setAttribute("aria-label", input.label); f.maxLength = 300;
        f.addEventListener("input", () => clearTimeout(timer));
        f.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter" && f.value.trim()) { hide(); input.onSubmit(f.value.trim()); } if (e.key === "Escape") hide(); });
        box.append(f);
      }
      clearTimeout(timer);
      if (stay) timer = setTimeout(hide, actions.length ? Math.max(stay, 9000) : stay);
    } catch (e) { console.warn("[daylight-commons] could not show the download note", e); }
  }
  function hide() { clearTimeout(timer); if (host) host.remove(); host = null; }

  return Object.freeze({ show, hide, last: () => last });
})();
