// A stand-in for the extension APIs so the content scripts can run in an ordinary page.
// storage.local is in memory; a "pb-lookup" message answers after a short delay with the
// reading listed in window.FIXTURE_ABOUT, the way the background worker would.
(() => {
  const store = { ...(globalThis.FIXTURE_STORE || {}) };
  const listeners = [];
  // The worker's font bytes (background.js), read from src/ext/fonts relative to the fixture.
  const b64 = (buf) => { const u = new Uint8Array(buf); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
  const fixtureFonts = () => Promise.all([["CMMNS Hanken", "hanken-grotesk.woff2", "100 900"], ["CMMNS Mono", "jetbrains-mono-regular.woff2", "400"]]
    .map(([family, file, weight]) => fetch(new URL("../../src/ext/fonts/" + file, document.currentScript ? document.currentScript.src : location.href)).then((r) => r.arrayBuffer()).then((b) => ({ family, weight, data: b64(b) }))));
  globalThis.chrome = {
    storage: { local: {
      get: async (k) => Object.fromEntries((Array.isArray(k) ? k : [k]).map((x) => [x, store[x]])),
      set: async (o) => { Object.assign(store, o); },
      remove: async (k) => { for (const x of Array.isArray(k) ? k : [k]) delete store[x]; },
    }, onChanged: { addListener: () => {} } },
    runtime: {
      getManifest: () => ({ version: "fixture" }),
      getURL: (p) => new URL("../../src/ext/" + p, location.href).href,
      onMessage: { addListener: (f) => listeners.push(f) },
      sendMessage: async (msg) => {
        if (msg.type === "pb-owners" || msg.type === "pb-state") return [];
        if (msg.type === "pb-fonts") return fixtureFonts();
        if (msg.type === "pb-card-open") { globalThis.FIXTURE_CARD = msg.built; return; }
        // Reading text in an image: the fixture runs the background's reader in the page itself.
        if (msg.type === "pb-claims") return {};
        if (msg.type === "pb-ocr" && globalThis.PBOCR) {
          const model = PBOCR.decodeWeights(await (await fetch(new URL("../../src/ext/ocr/latin.bin", location.href))).arrayBuffer());
          const bytes = Uint8Array.from(atob(msg.bytes), (c) => c.charCodeAt(0)), bmp = await createImageBitmap(new Blob([bytes]));
          const c = new OffscreenCanvas(bmp.width, bmp.height), g = c.getContext("2d");
          g.drawImage(bmp, 0, 0);
          const img = g.getImageData(0, 0, bmp.width, bmp.height), r = PBOCR.readImage(model, img, { now: () => performance.now() });
          return { text: r.text, confidence: r.confidence, ms: r.ms, lines: r.lines.map((l) => ({ text: l.text, confidence: l.confidence, low: l.low })) };
        }
        if (msg.type !== "pb-lookup") return;
        for (const [i, h] of msg.handles.entries()) {
          setTimeout(async () => {
            const reading = (globalThis.FIXTURE_ABOUT || {})[h] || null;
            if (reading) await PBStore.put({ handle: h, ...reading });
            listeners.forEach((f) => f({ type: "pb-about-result", handle: h, reading }));
          }, 150 * (i + 1));
        }
      },
    },
  };
})();
