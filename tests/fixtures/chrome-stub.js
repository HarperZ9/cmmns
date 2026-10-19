// A stand-in for the extension APIs so the content scripts can run in an ordinary page.
// storage.local is in memory; a "pb-lookup" message answers after a short delay with the
// reading listed in window.FIXTURE_ABOUT, the way the background worker would.
(() => {
  const store = {};
  const listeners = [];
  globalThis.chrome = {
    storage: { local: {
      get: async (k) => ({ [k]: store[k] }),
      set: async (o) => { Object.assign(store, o); },
      remove: async (k) => { delete store[k]; },
    }, onChanged: { addListener: () => {} } },
    runtime: {
      getManifest: () => ({ version: "fixture" }),
      onMessage: { addListener: (f) => listeners.push(f) },
      sendMessage: async (msg) => {
        if (msg.type === "pb-owners" || msg.type === "pb-state") return [];
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
