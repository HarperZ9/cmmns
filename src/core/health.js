// Adapter health: whether Daylight Commons' reader for a site still finds what the site shows. Platforms
// change their page markup without notice, and a reader that finds nothing would otherwise show
// nothing, which looks the same as a quiet thread. This module turns what a reader found into a
// plain verdict and the sentence the panel shows. It reads counts only, never post text.

export const HEALTH_SETTLE_MS = 8000;
export const HEALTH_STATES = ["idle", "waiting", "ok", "empty", "partial", "changed"];

const what = (page) => (page === "feed" ? "posts" : "replies");

// found: { page: "thread" | "feed" | "other", candidates, read, withText, sinceMs,
//          structure: { times, articles } } for one site reader { name, hasLocation, rootFirst }.
// candidates are the boxes the reader picked out, read the ones it could read an author from.
export function adapterHealth(site, found) {
  const f = found || {}, name = (site && site.name) || "This site";
  const cand = f.candidates | 0, read = f.read | 0, w = what(f.page);
  if (!site || f.page === "other" || !f.page) return { state: "idle", say: null };
  if (cand > 0 && read === 0) return { state: "changed", say: `${name} changed its page; Daylight Commons cannot read ${w} here yet.`, reason: "boxes found, none readable" };
  if (cand >= 6 && read / cand < 0.3) return { state: "partial", say: `${name} changed part of its page; Daylight Commons reads ${read} of ${cand} ${w} here.`, reason: "most boxes unreadable" };
  if (read >= 5 && (f.withText | 0) / read < 0.2) return { state: "partial", say: `${name} changed part of its page; Daylight Commons finds ${w} here but cannot read their text.`, reason: "text missing" };
  if (read > 0) return { state: "ok", say: null };
  if ((f.sinceMs || 0) < HEALTH_SETTLE_MS) return { state: "waiting", say: null };
  const s = f.structure || {};
  // A post page on a site that shows the post itself should always have one; a page with no time
  // stamp or article box at all is more likely a sign-in wall or a removed post than a redesign.
  const expectsRoot = f.page === "thread" && !!(site.hasLocation || site.rootFirst) && ((s.times | 0) >= 1 || (s.articles | 0) >= 1);
  if (expectsRoot || (s.times | 0) >= 3 || (s.articles | 0) >= 3) {
    return { state: "changed", say: `${name} changed its page; Daylight Commons cannot read ${w} here yet.`, reason: expectsRoot ? "the post itself was missing" : "the page shows post-like boxes outside Daylight Commons' reader" };
  }
  return { state: "empty", say: null };
}

// The self-test's report as [label, value] rows, for the toolbar popup.
export function selfTestLines(r) {
  if (!r) return [["Result", "This site gets the site card, with site context and text checks, in place of a reader."]];
  const v = r.verdict || {};
  const pct = (a, b) => (b ? `${a} of ${b}` : "none");
  return [
    ["Site", `${r.site} (${r.page === "feed" ? "feed" : r.page === "thread" ? "post page" : "not a post or feed page"})`],
    ["Boxes found", String(r.candidates)],
    ["Read", pct(r.read, r.candidates)],
    ["With author", pct(r.withAuthor, r.read)],
    ["With text", pct(r.withText, r.read)],
    ["With id", pct(r.withId, r.read)],
    ["Page shape", `${r.structure.times} time stamps, ${r.structure.articles} article boxes`],
    ["Result", v.say || (v.state === "ok" ? "Daylight Commons reads this page." : v.state === "empty" ? "No posts loaded here; nothing points to a change." : v.state === "waiting" ? "The page is still loading." : "Nothing to read on this page.")],
    ["Checked", r.at],
  ];
}

export const HEALTH_DOES_NOT_PROVE = "The self-test counts what Daylight Commons' reader finds on this page now. A page that loads posts later can fail and then pass. The test reads layout on this device and sends nothing.";
