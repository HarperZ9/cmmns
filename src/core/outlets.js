// The suggested outlets for Other coverage: news organisations that publish their own feed, so
// Radar can ask each publisher directly with no aggregator in between. The user turns each one on
// or off and can add any RSS or Atom address. Radar requests a feed only on the user's click.
//
// How the list was chosen (project-docs/INDEPENDENCE.md has the full method and its limits):
//   1. An original newsroom with general or world news in English.
//   2. A public RSS or Atom feed at a stable https address on the outlet's own host that answered
//      with entries and without a redirect when checked on 2026-10-21.
//   3. The outlet's site is in Radar's bundled site tables (src/ext/sites.json), so the card can say
//      what the tables state about its owner and owner type. Where they state no owner, it says so.
//   4. Spread: several countries and every owner type the tables give, with the count of outlets
//      across the range of published media-bias charts kept even by the maintainer at curation.
//      No rating is stored here or shown anywhere: Radar labels outlets by owner type only.
// The order is alphabetical by id, so position in the list says nothing.

// [id, name, feed address, site in the tables, country as the outlet states it]
export const FEED_OUTLETS = Object.freeze([
  ["abc-au", "ABC News (Australia)", "https://www.abc.net.au/news/feed/51120/rss.xml", "abc.net.au", "Australia"],
  ["aljazeera", "Al Jazeera English", "https://www.aljazeera.com/xml/rss/all.xml", "aljazeera.com", "Qatar"],
  ["bbc", "BBC News", "https://feeds.bbci.co.uk/news/world/rss.xml", "bbc.co.uk", "United Kingdom"],
  ["cbc", "CBC News", "https://www.cbc.ca/webfeed/rss/rss-topstories", "cbc.ca", "Canada"],
  ["dawn", "Dawn", "https://www.dawn.com/feeds/home", "dawn.com", "Pakistan"],
  ["dw", "Deutsche Welle", "https://rss.dw.com/rdf/rss-en-all", "dw.com", "Germany"],
  ["elpais", "El País (English)", "https://feeds.elpais.com/mrss-s/pages/ep/site/english.elpais.com/portada", "elpais.com", "Spain"],
  ["fox", "Fox News", "https://moxie.foxnews.com/google-publisher/latest.xml", "foxnews.com", "United States"],
  ["france24", "France 24", "https://www.france24.com/en/rss", "france24.com", "France"],
  ["jacobin", "Jacobin", "https://jacobin.com/feed/", "jacobin.com", "United States"],
  ["japantimes", "The Japan Times", "https://www.japantimes.co.jp/feed/", "japantimes.co.jp", "Japan"],
  ["kyivindependent", "The Kyiv Independent", "https://kyivindependent.com/news-archive/rss/", "kyivindependent.com", "Ukraine"],
  ["lemonde", "Le Monde (English)", "https://www.lemonde.fr/en/rss/une.xml", "lemonde.fr", "France"],
  ["meduza", "Meduza (English)", "https://meduza.io/rss/en/all", "meduza.io", "Latvia"],
  ["motherjones", "Mother Jones", "https://www.motherjones.com/feed/", "motherjones.com", "United States"],
  ["nationalreview", "National Review", "https://www.nationalreview.com/feed/", "nationalreview.com", "United States"],
  ["npr", "NPR", "https://feeds.npr.org/1001/rss.xml", "npr.org", "United States"],
  ["nypost", "New York Post", "https://nypost.com/feed/", "nypost.com", "United States"],
  ["pbs", "PBS News", "https://www.pbs.org/newshour/feeds/rss/headlines", "pbs.org", "United States"],
  ["premiumtimes", "Premium Times", "https://www.premiumtimesng.com/feed", "premiumtimesng.com", "Nigeria"],
  ["reason", "Reason", "https://reason.com/feed/", "reason.com", "United States"],
  ["rnz", "RNZ", "https://www.rnz.co.nz/rss/world.xml", "rnz.co.nz", "New Zealand"],
  ["scmp", "South China Morning Post", "https://www.scmp.com/rss/91/feed/", "scmp.com", "Hong Kong"],
  ["straitstimes", "The Straits Times", "https://www.straitstimes.com/news/world/rss.xml", "straitstimes.com", "Singapore"],
  ["telegraph", "The Telegraph", "https://www.telegraph.co.uk/rss.xml", "telegraph.co.uk", "United Kingdom"],
  ["theguardian", "The Guardian", "https://www.theguardian.com/world/rss", "theguardian.com", "United Kingdom"],
  ["thehill", "The Hill", "https://thehill.com/news/feed/", "thehill.com", "United States"],
  ["thehindu", "The Hindu", "https://www.thehindu.com/news/international/feeder/default.rss", "thehindu.com", "India"],
  ["theintercept", "The Intercept", "https://theintercept.com/feed/?rss", "theintercept.com", "United States"],
  ["timesofindia", "The Times of India", "https://timesofindia.indiatimes.com/rssfeedstopstories.cms", "timesofindia.indiatimes.com", "India"],
  ["timesofisrael", "The Times of Israel", "https://www.timesofisrael.com/feed/", "timesofisrael.com", "Israel"],
  ["washexaminer", "Washington Examiner", "https://www.washingtonexaminer.com/feed/", "washingtonexaminer.com", "United States"],
  ["wsj", "The Wall Street Journal (world)", "https://feeds.a.dj.com/rss/RSSWorldNews.xml", "wsj.com", "United States"],
]);

export const OUTLETS_CHECKED = "2026-10-21";
export const MAX_CUSTOM_FEEDS = 30;

// The host the browser is asked to allow for one feed, as an optional host permission.
export function feedOrigin(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? `https://${u.hostname}/*` : null;
  } catch {
    return null;
  }
}

// A feed address the user typed: https only, no credentials, no fragment, at most 500 characters.
export function cleanFeedUrl(text) {
  const s = String(text || "").trim();
  if (!s || s.length > 500) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" || u.username || u.password || !u.hostname.includes(".")) return null;
    u.hash = "";
    return u.href;
  } catch {
    return null;
  }
}

// Every feed the user chose: suggested outlets switched on, then their own addresses.
// Returns [{ id, name, url, site, country, custom }].
export function chosenFeeds(settings) {
  const on = (settings && settings.outlets) || {};
  const list = FEED_OUTLETS.filter(([id]) => on[id] === true).map(([id, name, url, site, country]) => ({ id, name, url, site, country, custom: false }));
  const custom = ((settings && settings.customFeeds) || []).map(cleanFeedUrl).filter(Boolean).slice(0, MAX_CUSTOM_FEEDS);
  for (const url of custom) {
    const host = new URL(url).hostname;
    list.push({ id: "custom:" + url, name: host, url, site: host, country: null, custom: true });
  }
  return list;
}
