// Cross-launch overlap for the launch campaign lens (project-docs/CAMPAIGN-LENS.md, signal 4): how
// many accounts sampled on this launch were already seen amplifying other launches the viewer
// opened. Pure functions over a store the extension keeps in chrome.storage.local only.
//
// Accounts are stored as salted hashes, never as handles. The salt is made on the device and never
// exported, so the store cannot be read back as a list of accounts, and two users' stores cannot be
// joined. The viewer can wipe it at any time ("Forget launches I viewed").

export const OVERLAP_KEY = "pb.campaign.v1", OVERLAP_RETAIN_DAYS = 30, OVERLAP_MAX_LAUNCHES = 200, OVERLAP_MAX_ACCOUNTS = 500;
export const OVERLAP_OTHER_MIN = 2, OVERLAP_MIN = 5, OVERLAP_SHARE = 0.2;
export const OVERLAP_DOES_NOT_PROVE = "Fans of a field, employees and investors reshare each other's launches. Overlap says these launches drew some of the same accounts, not why.";
const DAY = 86400000;

// FNV-1a over salt + handle, as a short hex string. Not cryptographic; its job is to keep handles
// out of storage on this device, not to resist someone holding the salt.
export function hashHandle(salt, handle) {
  const s = String(salt) + "|" + String(handle || "").toLowerCase();
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) { h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619) >>> 0; h2 = Math.imul(h2 ^ s.charCodeAt(i), 2246822519) >>> 0; }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

export function emptyStore(salt) { return { v: 1, salt, launches: {} }; }

// Records the sampled accounts of one launch (by post id). Returns a new store.
export function recordLaunch(store, launchId, handles, now = Date.now()) {
  const S = { ...store, launches: { ...(store.launches || {}) } };
  const prev = S.launches[launchId] || { seen: now, a: [] };
  const set = new Set(prev.a);
  for (const h of handles || []) if (set.size < OVERLAP_MAX_ACCOUNTS) set.add(hashHandle(S.salt, h));
  S.launches[launchId] = { seen: now, a: [...set] };
  return pruneLaunches(S, now);
}

export function pruneLaunches(store, now = Date.now()) {
  const keep = Object.entries(store.launches || {}).filter(([, l]) => now - l.seen <= OVERLAP_RETAIN_DAYS * DAY).sort((a, b) => b[1].seen - a[1].seen).slice(0, OVERLAP_MAX_LAUNCHES);
  return { ...store, launches: Object.fromEntries(keep) };
}

// For this launch's sample: { n, repeat, share, launches } where repeat counts sampled accounts seen
// on OVERLAP_OTHER_MIN or more other launches, and launches is how many other launches are stored.
export function overlapOf(store, launchId, handles) {
  const others = Object.entries((store && store.launches) || {}).filter(([id]) => id !== launchId).map(([, l]) => new Set(l.a));
  const hs = [...new Set((handles || []).map((h) => hashHandle(store.salt, h)))];
  let repeat = 0;
  for (const h of hs) if (others.filter((s) => s.has(h)).length >= OVERLAP_OTHER_MIN) repeat++;
  return { n: hs.length, repeat, share: hs.length ? repeat / hs.length : 0, launches: others.length, indicator: repeat >= OVERLAP_MIN && hs.length && repeat / hs.length >= OVERLAP_SHARE };
}
