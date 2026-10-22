// "Other coverage": other outlets reporting the same story, read from each outlet's own feed. There
// is no aggregator in between. The user picks the outlets (src/core/outlets.js) and may add any RSS
// or Atom address; on the user's click, Daylight Commons' background worker requests each chosen feed from
// its publisher, and this module matches the article's title against the entries on this device.
// Daylight Commons sends nothing from the page: not the title, not the address, not any post. Each publisher
// sees a plain request for its own feed.
//
// Each outlet is labelled by its owner and owner type as the bundled site tables state them
// (src/core/sites.js). Daylight Commons never labels an outlet by a left or right position.

import { ownerType, OWNER_TYPES } from "./sites.js";
import { siteKey, hostOf } from "./hosts.js";
import { feedOrigin } from "./outlets.js";

export const COVERAGE_PRIVACY = "Other coverage is off unless you turn it on. When it is on and you click \"Find other coverage\" on an article, Daylight Commons asks each outlet you chose for its public news feed, at the feed's own address, and compares the article's title with the feed's headlines on your device. Daylight Commons sends nothing from the page: not the title, not the page address, not your history, not any post. Each outlet receives an ordinary request for its feed, so it sees your IP address, the time and your browser's standard headers, and could guess you were reading news at that moment. No aggregator or Daylight Commons server is involved. Nothing is requested until you click.";

export const COVERAGE_DOES_NOT_PROVE = "Matching is by shared words in headlines, so a match can be a different event with similar words, and a story told in other words is missed. A feed holds only an outlet's latest entries, and only the outlets you chose are asked. Owner and owner type are what the site tables state, not a judgment of the reporting.";

const STOP = new Set(("the a an and or but of to in on at by for with from as is are was were be been it its this that these those their they he she his her we our you your " +
  "not no do does did has have had will would can could should may might than then so if into about over under after before what which who when where why how " +
  "says said say new news live update updates video watch report reports latest breaking opinion analysis just more most first last also amid " +
  "le la les des du de et un une el los las del y der die das und den ein eine").split(" "));

// A word's plain form: lower case, letters and digits, a plain plural "s" removed.
const stem = (w) => (w.length > 4 && /[^s]s$/.test(w) ? w.slice(0, -1) : w);

// The main words of a headline, in order, without repeats: four or more letters, or a number of
// three or more characters, and not a common word. The site name after " | " or " - " is dropped.
export function titleWords(title) {
  const t = String(title || "").split(/\s+[|–—-]\s+/)[0];
  const words = t.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/)
    .filter((w) => w.length >= 4 || (/\d/.test(w) && w.length >= 3)).filter((w) => !STOP.has(w)).map(stem);
  return [...new Set(words)];
}

// The best entry in one feed for this headline, or null. A match needs, in the entry's own
// headline, at least two of the article's main words and at least a quarter of them, and across
// headline and summary at least 40% of them. Summaries alone never make a match: long summaries
// share common words with almost any story.
export function bestMatch(words, items) {
  const T = new Set(words);
  if (T.size < 2) return null;
  const need = Math.max(2, Math.ceil(T.size * 0.4)), needTitle = Math.max(2, Math.ceil(T.size * 0.25));
  let best = null;
  for (const it of items || []) {
    const inTitle = titleWords(it.title).filter((w) => T.has(w));
    if (inTitle.length < needTitle) continue;
    const shared = [...new Set([...inTitle, ...titleWords(it.summary).filter((w) => T.has(w))])];
    if (shared.length < need) continue;
    const score = shared.length / T.size + inTitle.length / (10 * T.size);
    if (!best || score > best.score) best = { item: it, shared, score };
  }
  return best;
}

const hostOfUrl = (u) => { try { return new URL(u).hostname; } catch { return null; } };

// The hosts a lookup will contact, sorted, for the consent text and the "Requested" row.
export const coveragePlan = (feeds) => [...new Set((feeds || []).map((f) => hostOfUrl(f.url)).filter(Boolean))].sort();
export const feedOrigins = (feeds) => [...new Set((feeds || []).map((f) => feedOrigin(f.url)).filter(Boolean))].sort();

// results: [{ feed: { id, name, url, site, country, custom }, items, error, ms }] from the worker.
// Returns one entry per outlet that has a match, without the page's own site, each with what the
// site tables say about its owner. infoOf(site) returns { facts, state, owner }.
export function coverageFromFeeds(title, results, { self = null, infoOf = () => ({}) } = {}) {
  const words = titleWords(title);
  const own = self ? siteKey(hostOf("https://" + String(self).replace(/^https?:\/\//, ""))) : null;
  const list = [], seen = new Set();
  for (const r of results || []) {
    if (!r || !r.feed || r.error) continue;
    const site = siteKey(hostOf("https://" + r.feed.site)) || r.feed.site;
    if (site === own || seen.has(site)) continue;
    const m = bestMatch(words, r.items);
    if (!m || siteKey(hostOf(m.item.link)) === own) continue;
    seen.add(site);
    const info = infoOf(r.feed.site) || {};
    list.push({ site, outlet: r.feed.name, url: m.item.link, title: m.item.title.slice(0, 200), published: m.item.published ? m.item.published.slice(0, 10) : null,
      shared: m.shared, country: r.feed.country || (info.facts && info.facts.country) || null, type: ownerType(info), owner: (info.owner && info.owner.owner) || null });
  }
  return { words, list };
}

// One line per feed asked: what came back, so a silent or broken feed is visible.
export function feedStatus(results) {
  return (results || []).map((r) => ({ name: r.feed.name, host: hostOfUrl(r.feed.url), ms: r.ms ?? null,
    state: r.error ? r.error : (r.items || []).length ? "ok" : "empty", entries: (r.items || []).length }));
}

// Counts per owner type, in OWNER_TYPES order; types with no outlet are left out.
export function coverageGroups(list) {
  return OWNER_TYPES.map((type) => ({ type, n: (list || []).filter((x) => x.type === type).length })).filter((g) => g.n);
}

export const FEED_ERRORS = Object.freeze({
  "no-permission": "The browser has not allowed Daylight Commons to reach this feed's host.",
  redirect: "The feed answered with a redirect to another address, which Daylight Commons does not follow. Check the outlet's site for its current feed.",
  http: "The feed answered with an error.",
  "not-a-feed": "The answer was not an RSS or Atom feed.",
  "too-large": "The feed was larger than Daylight Commons reads.",
  timeout: "The feed did not answer within 10 seconds.",
  network: "The feed could not be reached.",
});
