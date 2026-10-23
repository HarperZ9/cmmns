// Reposter and replier sample analysis for the launch campaign lens (project-docs/CAMPAIGN-LENS.md,
// signal 2). Input is the accounts the viewer's page loaded (repost list, quote list, replies), as
// the platform disclosed them. Output is counts and shares about the sample, never a per-account
// verdict and never a list of handles.
//
// Banned features: language, script, place, name origin and avatar appearance are never read.
// `bio` is used only through skeletons, cue phrases and topic families (src/core/campaign-text.js).

import { templateGroups, personaCues, PERSONA_MIN_FAMILIES, topicsOf } from "./campaign-text.js";

export const SAMPLE_MIN = 12;
export const PERSONA_SHARE = 0.25, JOIN_WINDOW_DAYS = 14, JOIN_MIN = 5, JOIN_SHARE = 0.3, MISMATCH_SHARE = 0.4, MISMATCH_MIN = 4;
export const SAMPLE_DOES_NOT_PROVE = {
  "bio-template": "Friends, colleagues and fan accounts copy each other's bios, and some sites suggest bio wording.",
  "stock-persona": "Real people write short, list-like bios, and these phrases are common.",
  "join-cluster": "Accounts join in waves after news, an event or a platform change.",
  "topic-mismatch": "People follow and reshare outside their own interests, and a bio says little about what someone reads.",
  "random-suffix": "Many people choose a handle with numbers and letters for privacy or safety, so this stays context.",
  "default-avatar": "Many real people keep the default picture, so this stays context.",
};

// A handle ending in a digit-and-letter tail ("_x5", "8t9", "c8s", "38"). Context only.
export function randomSuffix(handle) {
  const h = String(handle || "").toLowerCase();
  const tail = (h.match(/[a-z0-9]{3,6}$/) || [""])[0];
  const digits = (tail.match(/\d/g) || []).length;
  const switches = (tail.match(/(?<=\d)[a-z]|(?<=[a-z])\d/g) || []).length;
  return /\d{2,}$/.test(h) || (digits >= 1 && switches >= 2) || /_[a-z0-9]{1,3}_?[a-z]?\d/.test(h);
}

const dayOf = (iso) => { const t = Date.parse(iso); return Number.isFinite(t) ? Math.floor(t / 86400000) : null; };

// The densest JOIN_WINDOW_DAYS window of join dates: { n, of, from, to }.
export function joinCluster(dates) {
  const d = dates.map(dayOf).filter((x) => x != null).sort((a, b) => a - b);
  let best = { n: 0, of: d.length, from: null, to: null };
  for (let i = 0, j = 0; i < d.length; i++) {
    while (d[i] - d[j] > JOIN_WINDOW_DAYS) j++;
    if (i - j + 1 > best.n) best = { n: i - j + 1, of: d.length, from: new Date(d[j] * 86400000).toISOString().slice(0, 10), to: new Date(d[i] * 86400000).toISOString().slice(0, 10) };
  }
  return best;
}

// accounts: [{ handle, bio?, joinDate?, defaultAvatar? }]; postText: the launch post's text.
// Returns { n, enough, indicators: [{ id, ... }], context: [{ id, ... }] }.
export function sampleSigns(accounts, postText) {
  const seen = new Map();
  for (const a of accounts || []) { const k = String(a.handle || "").toLowerCase(); if (k && !seen.has(k)) seen.set(k, a); }
  const xs = [...seen.values()], n = xs.length;
  if (n < SAMPLE_MIN) return { n, enough: false, indicators: [], context: [] };
  const indicators = [], context = [];
  const bios = xs.filter((a) => a.bio && String(a.bio).trim());

  const groups = templateGroups(bios.map((a, i) => ({ id: i, text: a.bio })));
  const inGroups = groups.reduce((s, g) => s + g.size, 0);
  if (groups.length) indicators.push({ id: "bio-template", groups: groups.length, largest: groups[0].size, accounts: inGroups, of: bios.length });

  const persona = bios.filter((a) => personaCues(a.bio).length >= PERSONA_MIN_FAMILIES).length;
  if (bios.length && persona >= 3 && persona / n >= PERSONA_SHARE) indicators.push({ id: "stock-persona", n: persona, of: n, share: persona / n });

  const jc = joinCluster(xs.map((a) => a.joinDate).filter(Boolean));
  if (jc.n >= JOIN_MIN && jc.of && jc.n / jc.of >= JOIN_SHARE) indicators.push({ id: "join-cluster", ...jc, share: jc.n / jc.of });

  const postTopics = new Set(topicsOf(postText));
  const withTopic = bios.map((a) => topicsOf(a.bio)).filter((t) => t.length);
  const off = withTopic.filter((t) => !t.some((x) => postTopics.has(x)));
  if (off.length >= MISMATCH_MIN && off.length / withTopic.length >= MISMATCH_SHARE) {
    const fam = {};
    for (const t of off) for (const x of t) fam[x] = (fam[x] || 0) + 1;
    indicators.push({ id: "topic-mismatch", n: off.length, of: withTopic.length, share: off.length / withTopic.length, families: Object.entries(fam).sort((a, b) => b[1] - a[1]).map(([k]) => k), postTopics: [...postTopics] });
  }

  const suffix = xs.filter((a) => randomSuffix(a.handle)).length;
  if (suffix) context.push({ id: "random-suffix", n: suffix, of: n });
  const avatars = xs.filter((a) => a.defaultAvatar === true).length;
  if (avatars) context.push({ id: "default-avatar", n: avatars, of: n });
  return { n, enough: true, bios: bios.length, indicators, context };
}
