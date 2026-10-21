// Evidence bundles in the extension's own pages: this install's signing key, the data tables and
// their hash. The key is an ECDSA P-256 pair made on first use and kept in this extension's
// IndexedDB as a non-extractable CryptoKey, so the private half can sign but can never be read,
// exported or sent. The tables are read from Radar's own package; nothing is fetched from the web.
(() => {
  "use strict";
  const DB = "radar-keys", STORE = "keys", ID = "bundle-key";
  const req = (r) => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });

  async function db() {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    return req(open);
  }

  let pair = null;
  // The key pair, made and stored on first use when make is true; otherwise null until then.
  async function keyPair(make = true) {
    if (pair) return pair;
    const d = await db();
    pair = (await req(d.transaction(STORE).objectStore(STORE).get(ID))) || null;
    if (!pair && make) {
      pair = await PB.newBundleKey({ extractable: false });
      await req(d.transaction(STORE, "readwrite").objectStore(STORE).put(pair, ID));
    }
    return pair;
  }

  const url = (f) => chrome.runtime.getURL(f);
  const bytes = (f) => fetch(url(f)).then((r) => { if (!r.ok) throw new Error(`${f}: ${r.status}`); return r.arrayBuffer(); });
  const json = (f) => fetch(url(f)).then((r) => { if (!r.ok) throw new Error(`${f}: ${r.status}`); return r.json(); });

  let tables = null;
  // Loads Radar's tables into the core once per page: sites, owners, state links and fact-checks.
  function loadTables() {
    if (!tables) tables = json("claims.json").then(async (claims) => {
      const [sites, owners, state, ...parts] = await Promise.all([json("sites.json"), json("owners.json"), json("state.json"), ...(claims.parts || []).map(json)]);
      return { names: ["claims.json", ...(claims.parts || []), "ops.json", "owners.json", "sites.json", "state.json"], loaded: PB.useData({ sites, owners, state, claims, claimParts: parts }) };
    });
    return tables;
  }

  // The same hash the CLI computes from the files on disk (src/core/evidence-bundle.js).
  async function dataLock() {
    const { names } = await loadTables();
    return PB.dataLockOf(await Promise.all(names.map(async (n) => [n, new Uint8Array(await bytes(n))])));
  }

  async function sign(bundle) { return PB.signBundle(bundle, await keyPair()); }
  // This browser's key id, or null when no bundle has been signed here yet.
  async function keyId() { const p = await keyPair(false); return p ? (await PB.publicKeyOf(p.publicKey)).keyId : null; }
  const tool = () => "Radar " + chrome.runtime.getManifest().version;

  function download(name, text) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  globalThis.PBSign = Object.freeze({ loadTables, dataLock, sign, keyId, tool, download });
})();
