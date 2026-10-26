// Daylight Commons' side panel: the window for the post under the pointer, beside the page instead
// of over it. It follows the active tab and keeps each tab's last post, so switching tabs and back
// shows it again. Sections come from side-bridge.js in the page; a button press goes back there.
(() => {
  "use strict";
  const view = document.getElementById("view"), empty = document.getElementById("empty"), from = document.getElementById("from");
  const byTab = new Map();
  let active = null;
  // Stays connected while the panel is open, so the worker can tell pages to send their windows here.
  chrome.runtime.connect({ name: "pb-sidepanel" });
  const dark = () => matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("pb-dark", dark());

  // Buttons in the data ({ fn: n }) become functions that ask the page to run its own.
  function live(v, tabId) {
    if (Array.isArray(v)) return v.map((x) => live(x, tabId));
    if (v && typeof v === "object") {
      if (Number.isInteger(v.fn) && Object.keys(v).length === 1) return () => chrome.tabs.sendMessage(tabId, { type: "pb-side-call", fn: v.fn }).catch(() => {});
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, live(x, tabId)]));
    }
    return v;
  }

  function draw() {
    const got = active != null ? byTab.get(active) : null;
    empty.hidden = !!got; from.hidden = !got;
    if (!got) { view.replaceChildren(); return; }
    from.textContent = got.page;
    try { view.replaceChildren(PBPop.render(live(got.sections, active))); }
    catch (e) { console.warn("[daylight-commons] could not draw the side panel", e); }
  }

  // ?tab=<id> holds the panel on one tab, for the page opened on its own (scripts/qa/hover_check.py).
  const held = Number(new URLSearchParams(location.search).get("tab")) || null;
  async function follow() {
    const [t] = held ? [{ id: held }] : await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
    active = t ? t.id : null;
    draw();
    if (active != null) chrome.tabs.sendMessage(active, { type: "pb-side-ask" }).catch(() => {});
  }

  chrome.runtime.onMessage.addListener((msg, sender) => {
    if (!msg || msg.type !== "pb-side-sections" || !sender.tab) return false;
    byTab.set(sender.tab.id, { sections: msg.sections, page: msg.page });
    if (sender.tab.id === active) draw();
    return false;
  });
  chrome.tabs.onActivated.addListener(follow);
  chrome.tabs.onRemoved.addListener((id) => byTab.delete(id));
  if (chrome.windows && chrome.windows.onFocusChanged) chrome.windows.onFocusChanged.addListener(follow);
  follow();
})();
