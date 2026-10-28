// Data packs in the background worker (src/core/packs.js, src/core/packs-content.js): the packs
// the user imported and enabled, each verified again against the keys the user trusts every time
// they are loaded. A pack whose signature, hashes or content fail is left out and logged. Packs
// are only ever files the user picked in the options page; nothing here downloads anything.
(() => {
  "use strict";
  const PACKS = "pb.packs.v1", KEYS = "pb.packkeys.v1";
  const listeners = [];
  let ready = null;

  async function load() {
    const got = await chrome.storage.local.get([PACKS, KEYS]);
    const keys = got[KEYS] || [], out = [];
    for (const entry of got[PACKS] || []) {
      if (!entry || !entry.enabled) continue;
      const v = await PB.verifyPack(entry.pack, keys);
      const problems = [...v.problems, ...PB.validatePackContent((entry.pack && entry.pack.content) || {})];
      if (v.trusted && !problems.length) out.push({ name: entry.pack.manifest.name, keyId: v.keyId, content: entry.pack.content });
      else console.warn("[cmmns] left out a data pack:", entry.pack && entry.pack.manifest && entry.pack.manifest.name, v.trusted ? problems : "its key is not trusted");
    }
    PB.setPackNotes(out);
    return out;
  }

  globalThis.PBPacks = {
    PACKS, KEYS,
    enabled() {
      if (!ready) ready = load().catch((e) => { console.error("[cmmns] data packs failed to load", e); ready = null; return []; });
      return ready;
    },
    onChange(fn) { listeners.push(fn); },
  };
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== "local" || !(ch[PACKS] || ch[KEYS])) return;
    ready = null;
    for (const fn of listeners) fn();
  });
})();
