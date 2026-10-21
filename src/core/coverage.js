// "Other coverage": other outlets reporting the same story, from the GDELT Project's DOC 2.0 API.
// This is Radar's only feature that sends anything off the machine. It is off by default; the
// user turns it on in the options page, the browser asks for access to api.gdeltproject.org, and
// each lookup runs only on a click. Radar sends the main words of the article's title and nothing
// else: not the page address, not the user's history, not any post.
//
// Each outlet is labelled by its owner type as the site tables state it (src/core/sites.js):
// state media, public broadcaster, regional govt, nonprofit, commercial, or not stated. Radar never
// labels an outlet by a left or right position.

import { ownerType, OWNER_TYPES } from "./sites.js";
import { siteKey, hostOf } from "./hosts.js";

export const COVERAGE_HOST = "api.gdeltproject.org";
export const COVERAGE_ORIGIN = `https://${COVERAGE_HOST}/*`;
export const MAX_TERMS = 4;
const ENDPOINT = `https://${COVERAGE_HOST}/api/v2/doc/doc`;

export const COVERAGE_PRIVACY = "Other coverage is off unless you turn it on. When it is on and you click \"Find other coverage\" on an article, Radar sends the main words of that article's title, and nothing else, to the GDELT Project's public DOC 2.0 API at api.gdeltproject.org. Radar does not send the page address, your history, any post or any account. GDELT receives the request like any web request, so it sees your IP address and the words. Its terms are at gdeltproject.org. Nothing is sent until you click.";

const STOP = new Set(("the a an and or but of to in on at by for with from as is are was were be been it its this that these those their they he she his her we our you your " +
  "not no do does did has have had will would can could should may might than then so if into about over under after before what which who when where why how " +
  "says said say new news live update updates video watch report reports le la les des du de et un une el los las del y der die das und den ein eine").split(" "));

// The title's main words, at most MAX_TERMS, lower-case, letters and digits only. Null when fewer than
// two usable words remain (GDELT rejects short and common words).
export function coverageTerms(title) {
  const t = String(title || "").split(/\s+[|–—-]\s+/)[0];
  const words = t.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/)
    .filter((w) => w.length >= 4 || (/\d/.test(w) && w.length >= 3)).filter((w) => !STOP.has(w));
  // GDELT matches all the words, so a long query finds almost nothing. Keep the four longest words
  // (longer words name the story's people, places and things), in the title's order.
  const uniq = [...new Set(words)];
  const keep = new Set([...uniq].sort((a, b) => b.length - a.length).slice(0, MAX_TERMS));
  const terms = uniq.filter((w) => keep.has(w));
  return terms.length >= 2 ? terms.join(" ") : null;
}

export function coverageUrl(title, { timespan = "1w", max = 50 } = {}) {
  const q = coverageTerms(title);
  if (!q) return null;
  const u = new URL(ENDPOINT);
  for (const [k, v] of [["query", q], ["mode", "ArtList"], ["format", "json"], ["maxrecords", String(max)], ["timespan", timespan], ["sort", "HybridRel"]]) u.searchParams.set(k, v);
  return u.toString();
}

const day = (s) => { const m = String(s || "").match(/^(\d{4})(\d\d)(\d\d)/); return m ? `${m[1]}-${m[2]}-${m[3]}` : null; };

// GDELT's article list to one entry per site, without the page's own site. infoOf(site) returns
// { facts, state } from the site tables.
export function coverageList(json, { self = null, infoOf = () => ({}) } = {}) {
  const arts = json && Array.isArray(json.articles) ? json.articles : [];
  const own = self ? siteKey(hostOf("https://" + String(self).replace(/^https?:\/\//, ""))) : null, seen = new Set(), out = [];
  for (const a of arts) {
    if (!a || !/^https:\/\//i.test(String(a.url || ""))) continue;
    const site = siteKey(hostOf(a.url));
    if (!site || site === own || seen.has(site)) continue;
    seen.add(site);
    const info = infoOf(site) || {};
    out.push({ site, url: a.url, title: String(a.title || "").slice(0, 200), seen: day(a.seendate), language: a.language || null, country: a.sourcecountry || null, type: ownerType(info), name: (info.facts && info.facts.name) || null });
  }
  return out;
}

// Counts per owner type, in OWNER_TYPES order; types with no outlet are left out.
export function coverageGroups(list) {
  return OWNER_TYPES.map((type) => ({ type, n: (list || []).filter((x) => x.type === type).length })).filter((g) => g.n);
}

export const COVERAGE_DOES_NOT_PROVE = "GDELT finds articles by their words, so some may be about a different event, and it covers only the outlets it monitors. Owner type is what the site tables state, not a judgment of the reporting.";
