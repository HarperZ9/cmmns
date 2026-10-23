// The window's two faces on social sites: Hanken Grotesk for words and JetBrains Mono for figures, as on
// Daylight Commons' own pages. The worker sends the bytes (background.js), and they are added under names of
// Daylight Commons' own, so the site's fonts never change. If they cannot load, the window falls back to the
// system sans and monospace (badges.css).
(() => {
  "use strict";
  if (globalThis.PBFonts) return;
  const bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
  async function load() {
    const list = await chrome.runtime.sendMessage({ type: "pb-fonts" });
    for (const f of Array.isArray(list) ? list : []) {
      const face = new FontFace(f.family, bytes(f.data), { weight: f.weight, display: "swap" });
      document.fonts.add(await face.load());
    }
  }
  globalThis.PBFonts = load().catch((e) => console.warn("[daylight-commons] using system fonts in the window", e));
})();
