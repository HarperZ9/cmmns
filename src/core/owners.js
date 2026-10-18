// Who owns the outlet behind a link or an account. A small bundled table: no network calls, so
// nothing about what the user reads leaves the browser. Every entry names its source. Entries
// marked `seed` were written from general knowledge and still need checking against the source;
// scripts/owners-build.mjs (to be run with the author's approval) replaces them with Wikidata
// "owned by" records that carry their own references.
//
// What this does not show: who funds an individual creator. That money (sponsors, investors,
// donors) is mostly undisclosed; Radar shows it only where a platform labels it on the page
// (paid partnership, ad) or a public record is cited here.

export const OWNERS = [
  { name: "The Washington Post", domains: ["washingtonpost.com"], handles: ["washingtonpost"], owner: "Jeff Bezos (Nash Holdings)", source: "https://en.wikipedia.org/wiki/The_Washington_Post", seed: true },
  { name: "Fox News", domains: ["foxnews.com"], handles: ["foxnews"], owner: "Fox Corporation (Murdoch family)", source: "https://en.wikipedia.org/wiki/Fox_News", seed: true },
  { name: "The Wall Street Journal", domains: ["wsj.com"], handles: ["wsj"], owner: "News Corp (Murdoch family)", source: "https://en.wikipedia.org/wiki/The_Wall_Street_Journal", seed: true },
  { name: "New York Post", domains: ["nypost.com"], handles: ["nypost"], owner: "News Corp (Murdoch family)", source: "https://en.wikipedia.org/wiki/New_York_Post", seed: true },
  { name: "The Times (UK)", domains: ["thetimes.co.uk", "thetimes.com"], handles: ["thetimes"], owner: "News UK, part of News Corp (Murdoch family)", source: "https://en.wikipedia.org/wiki/The_Times", seed: true },
  { name: "Sky News", domains: ["news.sky.com"], handles: ["skynews"], owner: "Sky Group, owned by Comcast", source: "https://en.wikipedia.org/wiki/Sky_News", seed: true },
  { name: "Daily Mail", domains: ["dailymail.co.uk"], handles: ["mailonline", "dailymail"], owner: "DMG Media (Daily Mail and General Trust, Rothermere family)", source: "https://en.wikipedia.org/wiki/Daily_Mail", seed: true },
  { name: "The Guardian", domains: ["theguardian.com"], handles: ["guardian"], owner: "Guardian Media Group, owned by the Scott Trust", source: "https://en.wikipedia.org/wiki/The_Guardian", seed: true },
  { name: "The New York Times", domains: ["nytimes.com"], handles: ["nytimes"], owner: "The New York Times Company (Ochs-Sulzberger family control)", source: "https://en.wikipedia.org/wiki/The_New_York_Times", seed: true },
  { name: "CBS News", domains: ["cbsnews.com"], handles: ["cbsnews"], owner: "Paramount Skydance (Ellison family)", source: "https://en.wikipedia.org/wiki/CBS_News", seed: true },
  { name: "Le Figaro", domains: ["lefigaro.fr"], handles: ["le_figaro"], owner: "Groupe Dassault", source: "https://en.wikipedia.org/wiki/Le_Figaro", seed: true },
  { name: "CNews", domains: ["cnews.fr"], handles: ["cnews"], owner: "Canal+ group, controlled by the Bolloré family", source: "https://en.wikipedia.org/wiki/CNews", seed: true },
  { name: "BFMTV", domains: ["bfmtv.com"], handles: ["bfmtv"], owner: "CMA CGM (Saadé family)", source: "https://en.wikipedia.org/wiki/BFM_TV", seed: true },
  { name: "Le Monde", domains: ["lemonde.fr"], handles: ["lemondefr"], owner: "Le Monde group, with an independence fund holding control rights", source: "https://en.wikipedia.org/wiki/Le_Monde", seed: true },
  { name: "RT", domains: ["rt.com"], handles: ["rt_com"], owner: "Russian state (TV-Novosti, state-funded)", source: "https://en.wikipedia.org/wiki/RT_(TV_network)", seed: true },
  { name: "CGTN", domains: ["cgtn.com"], handles: ["cgtnofficial"], owner: "Chinese state (China Media Group)", source: "https://en.wikipedia.org/wiki/CGTN", seed: true },
  { name: "Al Jazeera", domains: ["aljazeera.com"], handles: ["ajenglish"], owner: "Al Jazeera Media Network, funded by the government of Qatar", source: "https://en.wikipedia.org/wiki/Al_Jazeera", seed: true },
  { name: "BBC", domains: ["bbc.com", "bbc.co.uk"], handles: ["bbcworld", "bbcnews"], owner: "Public corporation, funded mainly by the UK licence fee", source: "https://en.wikipedia.org/wiki/BBC", seed: true },
  { name: "YouTube", domains: ["youtube.com", "youtu.be"], handles: ["youtube"], owner: "Google (Alphabet)", source: "https://en.wikipedia.org/wiki/YouTube", seed: true },
  { name: "Instagram", domains: ["instagram.com"], handles: ["instagram"], owner: "Meta Platforms", source: "https://en.wikipedia.org/wiki/Instagram", seed: true },
  { name: "Facebook", domains: ["facebook.com"], handles: ["facebook"], owner: "Meta Platforms", source: "https://en.wikipedia.org/wiki/Facebook", seed: true },
];

const BY_DOMAIN = new Map(), BY_HANDLE = new Map();
for (const o of OWNERS) {
  for (const d of o.domains) BY_DOMAIN.set(d, o);
  for (const h of o.handles) BY_HANDLE.set(h.toLowerCase(), o);
}

// "www.news.sky.com/story" -> the most specific listed domain, or null.
export function ownerOfDomain(host) {
  let h = String(host || "").toLowerCase().replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "");
  while (h.includes(".")) { if (BY_DOMAIN.has(h)) return BY_DOMAIN.get(h); h = h.slice(h.indexOf(".") + 1); }
  return null;
}
export function ownerOfHandle(handle) { return BY_HANDLE.get(String(handle || "").toLowerCase()) || null; }

// Domains mentioned in text ("From washingtonpost.com", "bbc.co.uk/news/..."), lower-case, unique.
export function domainsIn(text) {
  const out = new Set();
  for (const m of String(text || "").matchAll(/\b((?:[a-z0-9-]+\.)+(?:com|co\.uk|fr|de|org|net|news|tv|io|uk|eu|ca|au))\b/gi)) out.add(m[1].toLowerCase());
  return [...out];
}
