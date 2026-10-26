// "Save as card": draws a post's or a selection's words as a PNG in the worker, from the plan in
// src/core/media-card.js, in the house type shipped with the extension (fonts/), and saves it through
// the same downloads path as every other file. The card names itself a Daylight Commons rendering.
globalThis.PBCardBg = (() => {
  "use strict";
  let fontsReady = null;

  // Hanken Grotesk and JetBrains Mono from the extension's own files, once per worker.
  function fonts() {
    if (fontsReady) return fontsReady;
    const set = globalThis.fonts || (globalThis.document && document.fonts);
    const load = async (family, file, weight) => {
      const face = new FontFace(family, await (await fetch(chrome.runtime.getURL(file))).arrayBuffer(), weight ? { weight } : {});
      await face.load();
      if (set) set.add(face);
    };
    fontsReady = Promise.all([load("Hanken Grotesk", "fonts/hanken-grotesk.woff2", "100 900"), load("JetBrains Mono", "fonts/jetbrains-mono-regular.woff2")])
      .catch((e) => { console.warn("[daylight-commons] card fonts did not load; the system type is used", e); });
    return fontsReady;
  }

  async function render(meta) {
    await fonts();
    const probe = new OffscreenCanvas(8, 8).getContext("2d");
    const measure = (text, font) => { probe.font = font; return probe.measureText(text).width; };
    const plan = PB.cardPlan(meta, measure);
    const canvas = new OffscreenCanvas(plan.width, Math.min(plan.height, 4000)), g = canvas.getContext("2d");
    g.fillStyle = plan.background; g.fillRect(0, 0, canvas.width, canvas.height);
    for (const it of plan.items) {
      if (it.kind === "rule") { g.fillStyle = PB.CARD.rule; g.fillRect(it.x, it.y, it.w, it.h); continue; }
      g.font = it.font; g.fillStyle = it.color; g.textBaseline = "alphabetic";
      g.fillText(it.text, it.x, it.y);
    }
    return new Uint8Array(await (await canvas.convertToBlob({ type: "image/png" })).arrayBuffer());
  }

  // A data: address for the downloads API (the worker has no blob addresses).
  function dataUrl(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return "data:image/png;base64," + btoa(s);
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.type !== "pb-card" || !sender.tab) return false;
    render(msg.meta).then((png) => PBQuickBg.download({ url: dataUrl(png), filename: msg.filename, site: msg.site, study: !!msg.study }))
      .then(sendResponse, (e) => { console.warn("[daylight-commons] could not make the card", e); sendResponse({ error: e.message }); });
    return true;
  });

  return Object.freeze({ render });
})();
