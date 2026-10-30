// An in-memory stand-in for the IndexedDB backend of src/ext/track-store.js, with the same calls.
// Values are copied in and out, as IndexedDB copies them, so a caller never holds a stored object.
export function memoryBackend() {
  const stores = { tracked: new Map(), readings: new Map(), seen: new Map(), seenLast: new Map() };
  const keyOf = { tracked: "key", readings: "id", seen: "id", seenLast: "key" };
  const copy = (v) => (v === undefined ? undefined : structuredClone(v));
  return {
    get: async (s, k) => copy(stores[s].get(k)),
    put: async (s, v) => { stores[s].set(v[keyOf[s]], copy(v)); },
    putMany: async (s, list) => { for (const v of list) stores[s].set(v[keyOf[s]], copy(v)); },
    all: async (s) => [...stores[s].values()].map(copy),
    byKey: async (s, key) => [...stores[s].values()].filter((v) => v.key === key).map(copy),
    del: async (s, k) => { stores[s].delete(k); },
    delMany: async (s, keys) => { for (const k of keys) stores[s].delete(k); },
    delBefore: async (s, ms) => { for (const [k, v] of stores[s]) if ((v.atMs != null ? v.atMs : v.lastAt) < ms) stores[s].delete(k); },
    clear: async (s) => { stores[s].clear(); },
    count: async (s) => stores[s].size,
  };
}
