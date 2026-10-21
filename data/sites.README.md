# Site table: sources, rules and measured coverage

`src/ext/sites.json` is built by `scripts/sites-build.mjs` at build time. Radar never calls Wikidata
or the fact-check feed from the browser. Built 2026-10-21.

| Part | Source | Licence | What a row keeps |
|---|---|---|---|
| Facts (48,341 sites) | Wikidata items that are, or are a direct subclass of, newspaper, daily newspaper, online newspaper, news website, news media, news agency, magazine, television station, television channel, radio station, broadcaster or public broadcaster, with an official website (P856) | CC0 | Name, founding year (P571), country (P17), owner type, Q-id |
| Records (2,451 sites) | Data Commons fact-check feed (ClaimReview), the same feed as `claims.json` | CC BY 4.0 | Count of reviews, count of fact-checkers, first and last date, and the newest 40 reviews: claim, rating as written, fact-checker, review link, date |

## Owner type

As Wikidata states it, in this order: the item is a public broadcaster; the item or its legal form
is a nonprofit organisation or a business; its current owner (P127 without an end date) is one.
The item's own statement wins over its owner's; when one level states both, the type reads
"nonprofit and commercial". Radar's state table (`state.json`) comes first in the window: a cited
state-ownership or designation row reads "state media", a public-broadcaster row "public
broadcaster", a regional government owner "regional govt". A report naming a site in an operation
is shown as a state link, never as an owner type. Of the 48,341 sites, 45,909 have no owner type
on Wikidata and show none.

## Which site a review is filed under

A review counts toward a site only when the fact-checker listed a page on that site as where the
claim appeared (`itemReviewed.appearance` or `firstAppearance`). `src/core/hosts.js` sets aside:

- posts on platforms (Facebook, X, YouTube, TikTok, Telegram, VK, Weibo, Rumble, Truth Social, Gab,
  Bluesky and others): the post is the poster's, not the platform's;
- archive copies, unless the archive address carries the original page, which is then used;
- link shorteners, which are not followed;
- transcript services (Rev, Factba.se, C-SPAN), aggregators (Yahoo, MSN, Google News and others),
  fact-checkers' publishing tools and hosting or CDN addresses: they carry other people's words;
- any page on a fact-checker's own site (every review URL host in the feed), so a claim "appearing"
  on a fact-check is never filed there;
- rows with markup in a name or rating, or a link given as the fact-checker's name (252 rows).

On shared hosts (Blogspot, WordPress.com, Substack, Medium and others) each subdomain is its own
site. One review counts once per site.

## Measured on the feed of 2026-10-20 (87,647 usable reviews)

| | Reviews | Share |
|---|---|---|
| List at least one appearance | 58,520 | 66.8% of all |
| Name a site (filed in a record) | 4,908 | 5.6% of all, 8.4% of those with an appearance |
| Appeared only on platforms | 43,708 | 74.7% of those with an appearance |
| Only archive copies without the original address | 6,446 | 11.0% |
| Only transcripts, aggregators, fact-check tools or hosting | 1,106 | 1.9% |
| Only fact-checkers' own pages (the false-attribution control) | 1,634 | 2.8% |
| Only shortened links | 513 | 0.9% |

Most claims fact-checkers review circulate on platforms, so most reviews name no site. A missing
record says nothing about a site.

**Hand check of attributions.** 40 random site attributions, read by hand on 2026-10-21 after the
rules above: 36 named a site that published or hosted the claim on its own pages (government pages
carrying an official's statement, outlets that ran the claim, blogs, scam pages); 2 named a site the
fact-checker cited as context rather than as the claim's source (one news outlet, one UN page); 2
were malformed rows, now dropped by the last rule. A first read of 40, before transcript services
and fact-check tools were set aside, found 8 such misfilings. Context citations cannot be told
apart from appearances in the feed's markup, which is why every record carries its does-not-prove
line.

**Completeness.** `tests/sites.data.test.js` holds every site a shipped `claims.json` review names
to having a record (100%), and no record under a platform, archive, shortener, transcript service,
aggregator or fact-checker.

## Limits

- Wikidata lags sales, closures and new outlets, and many local outlets have no item.
- Which claims are in the feed is what fact-checkers chose to check; coverage differs by country,
  language and topic, and some publishers in the feed are not fact-checkers in the usual sense.
- A record lists the newest 40 reviews; its count covers all of them.
- Rebuild with `node scripts/sites-build.mjs --in <feed.json>` and review the diff before committing.
