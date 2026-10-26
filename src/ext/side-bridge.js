// While Daylight Commons' side panel is open, the window for a post shows there instead of over the
// page (pop.js asks take() first). The post's sections go to the panel as plain data; each button in
// them becomes a number the panel sends back, and the press runs here, in the page, as it would in
// the window. Close the panel and the window returns to the page. Nothing leaves the browser.
globalThis.PBSide = globalThis.PBSide || (() => {
  "use strict";
  let open = false, current = null, fns = [];

  // Sections as data: functions become { fn: n }; feedback controls and tour tips stay on the page.
  function plain(v) {
    if (typeof v === "function") { fns.push(v); return { fn: fns.length - 1 }; }
    if (Array.isArray(v)) return v.map(plain);
    if (v && typeof v === "object") {
      if (v.feedback) return { note: "Feedback on this is in the window on the page." };
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]));
    }
    return v;
  }

  function publish() {
    if (!open || !current) return;
    fns = [];
    let list = current.sections;
    if (typeof current.source === "function") { try { list = current.source() || list; } catch (e) { console.warn("[daylight-commons] could not refresh the side panel", e); } }
    const sections = plain((list || []).filter((s) => !s.tip));
    chrome.runtime.sendMessage({ type: "pb-side-sections", sections, page: location.href, at: Date.now() }).catch(() => {});
  }

  // From pop.js: true when the side panel took the window.
  function take(target, sections, source) {
    if (!open) return false;
    current = { target, sections, source };
    publish();
    return true;
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || sender.id !== chrome.runtime.id) return false;
    if (msg.type === "pb-side") { open = !!msg.open; if (open && globalThis.PBPop) PBPop.close(true); sendResponse({ ok: true }); return false; }
    if (msg.type === "pb-side-ask") { publish(); sendResponse({ ok: true }); return false; }
    if (msg.type === "pb-side-call" && fns[msg.fn]) {
      try { fns[msg.fn](); } catch (e) { console.warn("[daylight-commons] a side panel button failed", e); }
      setTimeout(publish, 1200);   // checks and lookups finish later; show their result
      sendResponse({ ok: true });
    }
    return false;
  });
  chrome.runtime.sendMessage({ type: "pb-side-state" }).then((r) => { open = !!(r && r.open); }, () => {});

  return Object.freeze({ take, isOpen: () => open });
})();
