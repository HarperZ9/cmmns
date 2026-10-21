// The flooding sign. RAND's "firehose of falsehood" (Paul and Matthews 2016) names high volume
// across many channels and rapid, continuous repetition; Rauch calls the aim "flooding the zone"
// so that people stop believing anything (project-docs/TECHNIQUES.md). In one thread Radar can see
// two traces of it: several accounts posting at very high rates carry a large share of the
// replies (volume), or a timing burst (src/core/timing.js) is made of such accounts (speed).
// The rate is the account's own post count over its age, the same figure as the "very high post
// rate" flag. Accounts that reply many times in one thread are shown as context only: on ordinary
// threads that is what conversation looks like (project-docs/EVALUATION.md).

import { HIGH_VOLUME_PER_DAY, ageDays } from "./flags.js";

export const FLOOD_MIN_ACCOUNTS = 3, FLOOD_SHARE = 0.25, MIN_KNOWN = 10, BURST_HIGH = 2, REPEAT_MIN = 5;
export const FLOOD_DOES_NOT_PROVE = "News, alert and fan accounts post all day by design, and a busy thread draws the most active accounts on the site. This describes how the replies were posted, not who runs any account or why.";

// Posts per day since joining, or null when either number is missing.
export function ratePerDay(account, now = Date.now()) {
  if (!account || !Number.isFinite(account.postsCount) || !account.joinDate) return null;
  const age = ageDays(account.joinDate, now);
  return age == null ? null : account.postsCount / Math.max(1, age);
}

function volumeOf(rows, rateOf) {
  let known = 0, high = 0;
  const accounts = new Set();
  for (const r of rows) {
    const x = rateOf(String(r.author).toLowerCase());
    if (x == null) continue;
    known++;
    if (x >= HIGH_VOLUME_PER_DAY) { high++; accounts.add(String(r.author).toLowerCase()); }
  }
  return { known, replies: high, share: known ? Math.round((high / known) * 100) / 100 : 0, accounts: [...accounts] };
}

function repeaters(rows) {
  const n = new Map();
  for (const r of rows) { const h = String(r.author).toLowerCase(); n.set(h, (n.get(h) || 0) + 1); }
  return [...n].filter(([, k]) => k >= REPEAT_MIN).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([handle, k]) => ({ handle, n: k }));
}

// rows: [{ author, posted }]; rateOf(handle) -> posts a day or null; bursts from timingBursts().
// Returns null, or { volume, speed, repeaters, threshold }; volume or speed is null when its part
// did not fire.
export function floodSign(rows, rateOf, { bursts = [] } = {}) {
  const v = volumeOf(rows || [], rateOf);
  const volume = v.known >= MIN_KNOWN && v.accounts.length >= FLOOD_MIN_ACCOUNTS && v.share >= FLOOD_SHARE ? v : null;
  let speed = null;
  for (const b of bursts || []) {
    const high = b.authors.filter((a) => { const x = rateOf(String(a).toLowerCase()); return x != null && x >= HIGH_VOLUME_PER_DAY; });
    if (high.length >= BURST_HIGH && (!speed || high.length > speed.highRate)) speed = { from: b.from, to: b.to, accounts: b.authors.length, highRate: high.length };
  }
  if (!volume && !speed) return null;
  return { volume, speed, repeaters: repeaters(rows || []), threshold: HIGH_VOLUME_PER_DAY };
}
