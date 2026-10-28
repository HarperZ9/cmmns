// The laundering chain: a post, the accounts and sites its material passed through, and the
// earliest origin CMMNS can see. Laundering is what makes one source look like many independent
// ones (Rauch's "artificial copies"; DISARM T0128.004, Launder Information Assets). The chain uses
// only pointers the platform records and CMMNS' own first-seen log (src/core/trail.js): a quote
// or repost points upstream, "media from" names the post the media came from, the same upload or
// the same link seen earlier names an earlier sharer. It never infers a source from wording, and
// it stops where the platform's pointers stop.

import { trailFor, firstSeen, normLink } from "./trail.js";

export const CHAIN_DOES_NOT_PROVE = "The chain starts at the first upload or link CMMNS has seen; who filmed, wrote or paid for the material sits further back. Passing material along through other accounts is also how ordinary sharing works.";

const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return null; } };
const hours = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 360000) / 10;

// Upstream accounts from quotes, reposts and "media from", nearest first.
function pointerHops(t, tweets) {
  const tr = trailFor(t, tweets, null) || { steps: [] };
  return tr.steps.filter((s) => s.kind !== "uploaded").map((s) => ({ handle: s.handle ? String(s.handle).toLowerCase() : null, id: s.id, at: s.at || null, how: s.kind }));
}

// Earlier sharers of the same upload or link, from the first-seen log.
function earlierSharers(t, tweets, log) {
  const out = [];
  for (const f of firstSeen(t, tweets, log)) if (f.seen && f.seen.id !== t.id) out.push({ handle: f.seen.handle, id: f.seen.id, at: f.seen.at, how: "same upload seen earlier" });
  const table = (log && log.links) || {};
  for (const u of t.links || []) {
    const s = table[normLink(u) || ""], p = s && s.posts[0];
    if (p && p.id !== t.id) out.push({ handle: p.handle, id: p.id, at: p.at, how: "same link seen earlier", site: host(u) });
  }
  return out.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

// t: a tweet; tweets: Map id -> tweet; log: the trail log. Returns null when nothing is upstream,
// else { hops: [{ role, handle?, domain?, id?, at, how }], intermediaries, originHidden, hoursFromOrigin }.
export function launderingChain(t, tweets, log) {
  if (!t) return null;
  const me = String(t.author || "").toLowerCase();
  const up = pointerHops(t, tweets || new Map());
  const earlier = earlierSharers(t, tweets || new Map(), log).filter((e) => e.handle && e.handle !== me);
  const sites = [...new Set((t.links || []).map(host).filter(Boolean))];
  const origin = [up[up.length - 1], earlier[0]].filter((x) => x && x.handle && x.at).sort((a, b) => Date.parse(a.at) - Date.parse(b.at))[0]
    || up[up.length - 1] || null;
  if (!origin && !sites.length) return null;
  const mids = up.filter((h) => h !== origin && h.handle !== (origin && origin.handle)).map((h) => ({ role: "intermediary", ...h }));
  const siteHops = origin && origin.how === "same link seen earlier" ? sites.map((d) => ({ role: "intermediary", domain: d, how: "linked site" })) : [];
  if (!origin) return { hops: [{ role: "post", handle: me, id: t.id, at: t.posted }, ...sites.map((d) => ({ role: "intermediary", domain: d, how: "linked site" }))], intermediaries: sites.length, originHidden: true, hoursFromOrigin: null };
  const hops = [{ role: "post", handle: me, id: t.id, at: t.posted }, ...mids, ...siteHops, { role: "origin", ...origin }];
  // The post points straight at the origin only when its own nearest pointer is the origin.
  const direct = up.length > 0 && up[0].handle === origin.handle;
  return { hops, intermediaries: mids.length + siteHops.length, originHidden: !direct, hoursFromOrigin: origin.at && t.posted ? hours(origin.at, t.posted) : null };
}
