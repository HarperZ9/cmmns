# Fact-checked claims: sources and licences

`src/ext/claims.json` is built by `scripts/claims-build.mjs` at build time. Daylight Commons never fetches
fact-check data while it runs. Terms were checked on 2026-10-21. A source is bundled only when its
published terms allow redistribution; a source with unknown terms is recorded as unknown and not used.

| Source | What it holds | Terms found | Bundled |
|---|---|---|---|
| Data Commons fact-check feed (`storage.googleapis.com/datacommons-feeds/factcheck/latest/data.json`), from https://datacommons.org/factcheck/download | ClaimReview markup published by fact-checkers and collected by Google Fact Check Tools: claim, rating, fact-checker, review URL, date | The download page says the research dataset and the feed are "licensed under CC BY" (CC BY 4.0). Each item's own `sdLicense` field governs that item; on 2026-10-21 no item in the feed carried one. Publishers' own sites have their own terms, and the review articles themselves are not in the feed. | Yes |
| Data Commons research dataset (`fact_checks_20190605.txt.gz`) | Historical ClaimReview items to 2019 | CC BY, same page | No: superseded by the feed for current claims |
| Google Fact Check Tools Claim Search API | The same ClaimReview items, by query | Google APIs Terms of Service; needs an API key; no redistribution grant found | No. It would also be a runtime call. |
| Duke Reporters' Lab, Fact-Check Insights dataset | Over 200,000 ClaimReview and MediaReview items | Free after registration for researchers, journalists and fact-checkers. No licence text found. | No: terms unknown |
| Duke Reporters' Lab fact-checking census | A list of fact-checking outlets | No licence text found | No: terms unknown |
| IFCN signatories list (ifcncodeofprinciples.poynter.org) | Fact-checkers verified against the IFCN Code of Principles | No terms of use found for the list | No: terms unknown |
| EUvsDisinfo database (euvsdisinfo.eu) | Pro-Kremlin disinformation cases and disproofs | The site blocked scripted reads on 2026-10-21, so its own terms could not be read. The general EU copyright notice (CC BY 4.0) covers EU-owned editorial content on europa.eu sites and carves out third-party material; whether it covers EUvsDisinfo's case texts is unknown. A CC BY 4.0 copy on Mendeley Data (Barbaro and Skumanich, 2023) was scraped from the site, so its licence cannot grant more than the source allows. | No: terms unknown. It also covers one country's campaigns only, so on its own it would not meet the same-rule-for-every-direction test. |
| Community Notes public data (x.com/i/communitynotes/download-data) | All notes, ratings and status history, as TSV files, daily | The download page sits behind an X login. The documentation (github.com/twitter/communitynotes, Apache 2.0 for the code) describes the data as free to analyse but states no licence for redistributing it. | No: terms unknown. Daylight Commons already shows the Community Note X loads with a post on the page (`note` in `src/core/xdata.js`), which needs no bundled copy. |

## What a row keeps
The claim as the fact-checker summarised it (cut at 300 characters), the rating as the
fact-checker wrote it (rows whose rating runs over 80 characters are dropped, since it would no
longer read as a rating), the fact-checker's name, the review URL, the date, and a language guess
from function words (null when unsure; the feed carries no language), and the site where the
fact-checker said the claim appeared: its registrable domain only, or null when the claim appeared
only on platforms, archives, transcripts or other hosts of other people's words (rules and measured
rates in `data/sites.README.md`). The person or account the fact-checker says made the claim, and
the full links to where it appeared, are not kept.

## Selection
Newest first, at most 1,500 rows from any one fact-checker (the feed's largest publishers would
otherwise fill the table), until the file reaches 6 MB. Build of 2026-10-21: 84,873 usable reviews
in the feed, 19,379 rows kept from 318 fact-checkers, 5,999,377 bytes, dated 2024-03-18 to
2026-10-20; 632 rows name a site where the claim appeared. Language guesses: 36% English, 8% Portuguese, 4% Spanish, 4% French, under 1%
German and Italian, and 49% unsure (most of them in scripts the guesser does not cover).

## Attribution
CC BY 4.0 requires attribution. Every match Daylight Commons shows names the fact-checker, links to the
review, and carries the line "ClaimReview markup published by the fact-checker, from the Data
Commons fact-check feed (CC BY 4.0)."

## Limits
- Which claims are in the table is what fact-checkers chose to check, and coverage differs by
  country, language and topic. A missing match says nothing about a post.
- The feed includes publishers that are not IFCN signatories. Daylight Commons does not grade fact-checkers.
- The table covers about the last two and a half years; older claims that resurface are missed.
- Rebuild with `node scripts/claims-build.mjs` and review the diff before committing.
