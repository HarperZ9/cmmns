// Engagement over time (project-docs/ENGAGEMENT-SERIES.md): the store. Four IndexedDB stores under
// the extension's own origin, in database "cmmns-track": "tracked" (one record per saved post, by
// "<platform>:<post id>"), "readings" (the counts read from the page's own data, at most one per
// post per 6 hours), "seen" (the optional log of every post the page loaded, by time) and
// "seenLast" (when each seen post was last logged). The decisions are in src/core/engagement-series.js;
// this file only reads and writes. Nothing here touches the network.
globalThis.PBTrackStoreMake = function makeTrackStore(backend, PB) {
  "use strict";
  const DAY = 86400000;
  const uniq = (list) => [...new Set(list)];

  async function capTracked(now) {
    if ((await backend.count("tracked")) <= PB.SERIES_MAX_TRACKED) return;
    const { drop } = PB.pruneTracked(await backend.all("tracked"), now);
    for (const key of drop) await backend.delMany("readings", (await backend.byKey("readings", key)).map((r) => r.id));
    await backend.delMany("tracked", drop);
  }

  // A post the user saved. Resolves to its record, or null when Part 1 is off or the post has no id.
  async function addTracked(meta, settings, now = Date.now()) {
    if (!settings || !settings.trackSeries) return null;
    const e = PB.trackEntry(meta, now);
    if (!e) return null;
    const old = await backend.get("tracked", e.key);
    if (old) return old;
    const first = PB.saveReading(e, meta, now);
    await backend.put("tracked", first ? { ...e, lastAt: now } : e);
    if (first) await backend.put("readings", first);
    await capTracked(now);
    return e;
  }

  async function lookup(store, keys) {
    const out = {};
    for (const k of keys) { const v = await backend.get(store, k); if (v) out[k] = v; }
    return out;
  }

  async function thin(keys) {
    for (const key of keys) {
      const list = await backend.byKey("readings", key);
      if (list.length > PB.SERIES_MAX_READINGS) await backend.delMany("readings", PB.thinReadings(list).drop);
    }
  }

  // Posts the page's data carried. Resolves to how many readings and seen-log lines were written.
  async function sightings(list, settings, now = Date.now()) {
    const s = settings || {};
    if (!s.trackSeries && !(s.seenLog && !s.protection)) return { readings: 0, seen: 0 };
    const keys = uniq((list || []).map((x) => PB.seriesKey(x.platform, x.postId)));
    const tracked = s.trackSeries ? await lookup("tracked", keys) : {};
    const last = s.seenLog && !s.protection ? await lookup("seenLast", keys) : {};
    const seenLast = Object.fromEntries(Object.entries(last).map(([k, v]) => [k, v.lastAt]));
    const plan = PB.planSightings({ sightings: list, tracked, seenLast, settings: s, now });
    if (plan.readings.length) {
      await backend.putMany("readings", plan.readings);
      await backend.putMany("tracked", Object.keys(plan.lastAt).map((k) => ({ ...tracked[k], lastAt: now, postedAt: tracked[k].postedAt || plan.postedAt[k] || null })));
      await thin(Object.keys(plan.lastAt));
    }
    if (plan.seen.length) await writeSeen(plan.seen, list, now);
    return { readings: plan.readings.length, seen: plan.seen.length };
  }

  // Media addresses go into the log only as their SHA-256.
  async function writeSeen(records, list, now) {
    const media = new Map(list.map((x) => [PB.seriesKey(x.platform, x.postId), x.mediaUrls || []]));
    for (const r of records) r.mediaHashes = await Promise.all((media.get(r.key) || []).map((u) => PB.sha256Hex(u)));
    await backend.putMany("seen", records);
    await backend.putMany("seenLast", records.map((r) => ({ key: r.key, lastAt: now })));
  }

  const byKey = (readings) => readings.reduce((m, r) => ((m[r.key] = m[r.key] || []).push(r), m), {});

  // The due list now, with every missed age written into its post's record (never filled in).
  async function refresh(now = Date.now()) {
    const entries = await backend.all("tracked"), out = PB.dueReadings(entries, byKey(await backend.all("readings")), now);
    const missed = out.missed.reduce((m, x) => ((m[x.key] = m[x.key] || []).push(x.day), m), {});
    const changed = entries.filter((e) => (missed[e.key] || []).some((d) => !(e.missed || []).includes(d)))
      .map((e) => ({ ...e, missed: uniq([...(e.missed || []), ...missed[e.key]]).sort((a, b) => a - b) }));
    if (changed.length) await backend.putMany("tracked", changed);
    return { due: out.due, count: out.due.length, missed: out.missed.length };
  }

  const sorted = async (store) => PB.sortReadings(await backend.all(store));
  const counts = async () => ({ posts: await backend.count("tracked"), readings: await backend.count("readings"), seen: await backend.count("seen") });

  async function exportSeries(now = Date.now(), version = null) {
    const day = new Date(now).toISOString().slice(0, 10), readings = await sorted("readings"), seen = await sorted("seen");
    const jsonl = PB.seriesJsonl(readings), seenJsonl = seen.length ? PB.seriesJsonl(seen) : null;
    const files = [{ name: `engagement-series-${day}.jsonl`, holds: "readings", text: jsonl }, ...(seenJsonl ? [{ name: `seen-log-${day}.jsonl`, holds: "seen posts", text: seenJsonl }] : [])];
    const manifest = await PB.seriesManifest(files, { tracked: await backend.all("tracked"), now, version });
    return { jsonl, seenJsonl, manifest, names: { readings: files[0].name, seen: seenJsonl ? files[1].name : null, manifest: `engagement-series-${day}.manifest.json` } };
  }

  async function pruneSeen(now = Date.now(), days = PB.SEEN_DAYS_DEFAULT) {
    const cutoff = now - days * DAY;
    await backend.delBefore("seen", cutoff);
    await backend.delBefore("seenLast", cutoff);
  }
  async function clearSeries() { await backend.clear("tracked"); await backend.clear("readings"); }
  async function clearSeen() { await backend.clear("seen"); await backend.clear("seenLast"); }

  return Object.freeze({ addTracked, sightings, refresh, exportSeries, pruneSeen, clearSeries, clearSeen, counts,
    tracked: () => backend.all("tracked"), readings: () => sorted("readings"), seen: () => sorted("seen"),
    clearAll: async () => { await clearSeries(); await clearSeen(); } });
};

// The IndexedDB backend: the calls the store makes, one transaction each.
globalThis.PBTrackIdb = function trackIdb(name) {
  "use strict";
  const DB = name || "cmmns-track";
  let opening = null;
  function db() {
    if (opening) return opening;
    opening = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        d.createObjectStore("tracked", { keyPath: "key" });
        d.createObjectStore("readings", { keyPath: "id" }).createIndex("key", "key");
        d.createObjectStore("seen", { keyPath: "id" }).createIndex("atMs", "atMs");
        d.createObjectStore("seenLast", { keyPath: "key" }).createIndex("lastAt", "lastAt");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { opening = null; reject(req.error); };
    });
    return opening;
  }
  // Runs fn(store) in one transaction; resolves with the request's result once it commits.
  async function tx(store, mode, fn) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const t = d.transaction([store], mode), req = fn(t.objectStore(store));
      t.oncomplete = () => resolve(req && "result" in req ? req.result : undefined);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error("transaction aborted"));
    });
  }
  const below = (s, ms) => {
    const c = s.index(s.name === "seen" ? "atMs" : "lastAt").openCursor(IDBKeyRange.upperBound(ms, true));
    c.onsuccess = () => { if (c.result) { c.result.delete(); c.result.continue(); } };
  };
  return {
    get: (s, k) => tx(s, "readonly", (o) => o.get(k)),
    put: (s, v) => tx(s, "readwrite", (o) => { o.put(v); }),
    putMany: (s, list) => tx(s, "readwrite", (o) => { for (const v of list) o.put(v); }),
    all: (s) => tx(s, "readonly", (o) => o.getAll()),
    byKey: (s, key) => tx(s, "readonly", (o) => o.index("key").getAll(key)),
    del: (s, k) => tx(s, "readwrite", (o) => { o.delete(k); }),
    delMany: (s, keys) => tx(s, "readwrite", (o) => { for (const k of keys) o.delete(k); }),
    delBefore: (s, ms) => tx(s, "readwrite", (o) => { below(o, ms); }),
    clear: (s) => tx(s, "readwrite", (o) => { o.clear(); }),
    count: (s) => tx(s, "readonly", (o) => o.count()),
  };
};

if (typeof indexedDB !== "undefined" && globalThis.PB && !globalThis.PBTrackStore) globalThis.PBTrackStore = globalThis.PBTrackStoreMake(globalThis.PBTrackIdb(), globalThis.PB);
