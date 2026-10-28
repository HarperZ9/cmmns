# Competitors and 2.0 targets

CMMNS 2.0.0 stream 0. Every figure below was read on 2026-10-20 from the source linked beside it.
Store figures come from the Chrome Web Store (CWS) listing page and the Firefox Add-ons (AMO) API.
Anything we could not confirm says "unknown". Review themes come from the most recent reviews with
text on AMO (up to 25 per add-on). That sample is small and self-selected, so read the counts as
themes, not rates. CWS review text loads by script and was not collected.

## The field at a glance

| Tool | What the user gets | Platforms | Price | What leaves the browser | How it states accuracy |
|---|---|---|---|---|---|
| NewsGuard | A score icon beside links; hover summary; a "Nutrition Label" (ownership, content, reliability) per site | Chrome, Firefox, Edge, Safari; inline in ChatGPT and Gemini citations | $8/month after a 2-week trial; account and card required [1] | Requests `<all_urls>`, `tabs` and `nativeMessaging` (AMO). Account data: name, email, country, payment [2] | "35,000+ news sources" rated by journalists on "nonpartisan criteria" [1]. No error rate published that we found |
| Ground News | Coverage of one story across outlets; left/centre/right split; Blindspot stories; ownership (2,276 outlets hand-coded); "My News Bias" | Web, iOS, Android; extension on Chrome and Firefox | Free tier; Vantage $99.99/year; other tier prices conflict across sources (unknown) [3] | Host access to all sites plus `extension.ground.news` and `production.checkitt.news/api` (AMO). Reviewers report every visited URL is sent [4] | Bias is the average of AllSides, Ad Fontes and MBFC; factuality the average of Ad Fontes and MBFC [5]. No own error rate |
| InVID / WeVerify plugin | Keyframes from video, reverse search on several engines, metadata, forensic filters, OCR, fact-check search; synthetic-image and voice-clone detectors in beta for registered users [6] | Chrome, Firefox | Free; some tools reserved to vetted journalists and researchers [6] | `<all_urls>`, `scripting`, `webNavigation` (AMO). What each tool uploads: unknown per tool | Tools report raw outputs; no headline accuracy claim found |
| Bot Sentinel | A 0 to 100 score per X account; v3.0 announced with "Narratives" tracking and network graphs | X (old extension); v3.0 platforms unknown | Free, donation-funded | Old extension sends handles to botsentinel.com | Claims "99% accuracy" on its homepage [7]; no method found |
| Botometer X | A bot score per account from pre-computed data | Web | Free web; API via RapidAPI [8] | The handle you query | Archival only: no accounts created after 2023-05-31; cannot detect generative-AI bots, per its makers [8] |
| Community Notes | Crowd-written context on a post, shown when raters who usually disagree both rate it helpful | X; Meta (Facebook, Instagram, Threads) in the US since 2025; TikTok "Footnotes" since 2025-07-30 [9] | Free, built into the platform | Nothing extra (platform feature) | X publishes data and code. Studies: about 10% of notes reach "helpful" and show [10]; median 6.2 h from note to helpful [11] |
| Media Bias/Fact Check | Left/right bias (-10 to +10), factual-reporting level and a 10-point credibility rating per site | Web; extension on Chrome and Firefox (third-party, "Mike Crowe") | Free with ads; ad-free from $3/month [12] | AMO build requests Facebook only plus `tabs` | "10,000+ sources"; says no accepted scientific standard exists [12]. Its scores correlate with NewsGuard at r = 0.81 in one 2022 study [13] |
| AllSides | Left/centre/right rating per outlet; balanced story pages | Web, newsletter | Free; paid membership (price unknown) | Not applicable (website) | Blind Bias Survey plus multi-partisan editorial review, with low/initial/medium/high confidence labels [14] |
| Hoaxy (now OSoMeNet) | Spread graphs of claims and accounts | Web | Free | The query | Hoaxy now redirects to OSoMeNet [15]; OSoMeNet's data sources: unknown |
| Logically | Narrative intelligence for government and enterprise | Enterprise only | Sales-led | Not applicable | Not consumer-facing. Assets sold to Kreatur Ltd in a pre-pack administration in July 2025 [16] |
| TrustServista | One-click article verification; text analytics API | Chrome extension; API | Unknown | Article URL to its API | "analyzed more than 4 Million news articles" [17]; no error rate. Aimed at media professionals |
| Bad News | A browser game in which the player runs a fake-news campaign and learns six techniques (impersonation, emotion, polarisation, conspiracy, discrediting, trolling) [18] | Web | Free | Gameplay answers (research consent) | 15,000-player study reported about 20% lower trust in fake items [18]. Replications find the game raises "false" answers for true items too, with no gain in discernment [19] |
| Go Viral! | A five-minute COVID-19 version of the same idea, with the UK Cabinet Office [20] | Web | Free | Unknown | Effects held one week in the makers' study [20]. The site did not answer over TLS on 2026-10-20 (status unknown) |

### Browser extensions by user count (CWS, 2026-10-20)

| Extension | CWS users | Rating (n) | Updated | AMO users | Price |
|---|---|---|---|---|---|
| Fake news debunker by InVID & WeVerify | 100,000 | 3.9 (50) | 2026-07-28, v0.93 | 310 | Free |
| Ground News | 40,000 | 4.0 (64) | 2025-03-25, v3.2.1 | 4,414 | Freemium |
| NewsGuard | 30,000 | 3.4 (518) | 2026-04-14, v5.10.2 | 1,621 | $8/month |
| BitMind AI detector | 30,000 | 3.8 (52) | 2026-06-24 | unknown | unknown |
| Media Bias/Fact Check | 9,000 | 4.6 (82) | 2026-03-11, v4.2.0 | 478 | Free |
| Hiya deepfake voice detector | 4,000 | 2.8 (9) | 2024-11-23 | unknown | unknown |
| Digimarc C2PA Content Credentials | 1,000 | 3.8 (6) | 2026-05-19, v0.2.0 | unknown | Free |
| Facticity AI fact checker | 430 | 4.3 (7) | 2026-10-14 | unknown | unknown |
| Bellingcat BENEDMO fact-check finder | 370 | none | 2022-11-07 | unknown | Free |
| Adobe Content Authenticity | 77 | 5 (1) | 2026-10-13, v1.0.2 | unknown | Free |
| TinEye reverse image search | unknown | | | 40,996 | Free |
| Bot Sentinel | not found | | | 1,198 (last update 2022-12-05) | Free |

No misinformation extension we found passes 100,000 Chrome users, and the leader is a toolkit for
journalists. Newer AI "fact checker" extensions sit under 500 users each. CMMNS 1.0.0 has no store
listing, so its store user count is zero by construction.

## Feature matrix

Y = has it. P = partial. - = no. CMMNS 1.0.0 per `README.md` and `CHANGELOG.md`.

| Feature | CMMNS 1.0.0 | NewsGuard | Ground News | InVID | Bot Sentinel / Botometer | Community Notes | MBFC ext. | Prebunking games |
|---|---|---|---|---|---|---|---|---|
| One-click store install | - | Y | Y | Y | P | n/a | Y | n/a |
| Free, no account | Y | - | P | P | Y | Y | Y | Y |
| Nothing sent off the device | Y | - | - | - | - | n/a | Y | - |
| Per-site owner | Y (7,374 rows) | Y | Y (2,276) | - | - | - | P | - |
| State-media links, cited | Y | P | P (Government owner) | - | - | - | P | - |
| Site fact-check record | - | Y | P | - | - | - | Y | - |
| Site context on any page (search, news, AI answers) | - | Y | Y | - | - | - | - | - |
| Other coverage of the same story | - | - | Y | - | - | - | - | - |
| Post matched to a published fact-check | Y (19,728 reviews) | - | - | Y (search) | - | - | - | - |
| Community Notes shown | Y (X) | - | - | - | - | Y | - | - |
| Notes on Meta and TikTok | - | - | - | - | - | Y | - | - |
| Account evidence (age, renames, posting clock) | Y | - | - | - | P (score) | - | - | - |
| Coordination signs (copies, bursts) | Y | - | - | P | P | - | - | - |
| Coordination graph | P (history page lists) | - | - | P (research only) | Y (v3 announced), Hoaxy | - | - | - |
| Hostile-rhetoric signs, symmetry-tested | Y | - | - | - | - | - | - | - |
| Persuasion techniques | P (measured, held back) | - | - | - | - | - | - | Y (taught) |
| Video keyframes and forensic filters | - | - | - | Y | - | - | - | - |
| Content Credentials (C2PA) reading | - | - | - | - | - | - | - | - |
| Reverse image search | Y | - | - | Y | - | - | - | - |
| Personal feed dashboard over time | P (history page) | - | Y (My News Bias) | - | - | - | - | - |
| Lessons on techniques | - | - | - | - | - | - | - | Y |
| Measured error rate per sign | Y | - | - | - | - (Bot Sentinel claims 99%) | P (open data) | - | P (studies) |
| User correction channel | - | P (publisher appeals) | P (edit rating for yourself) | - | - | Y | - | - |
| Mobile | - | P (Safari, apps) | Y (apps) | - | - | Y | - | Y (web) |
| Platforms covered | X, YouTube, Reddit, Facebook, Instagram, Bluesky | all sites | all sites; X, Reddit, Facebook, LinkedIn, Bluesky | any media | X | X, Meta, TikTok | Facebook | n/a |

The Content Credentials row is empty for everyone in the table; the Adobe and Digimarc extensions
cover it with under 1,100 Chrome users between them.

## Gaps and 2.0 targets

Each row is a feature a competitor has and CMMNS 1.0.0 lacks or covers only in part. A target
passes only when the named check passes. Rows are in order of expected effect on adoption.

| # | Gap (who has it) | 2.0 target | Check | Stream |
|---|---|---|---|---|
| 1 | One-click install (all) | Listed on CWS and AMO; signed Firefox build; install to first badge in under 60 s | Store listing URLs live; timed first run on a clean profile | 7 |
| 2 | Site fact-check record (NewsGuard, MBFC) | For every domain with at least one ClaimReview in the shipped table, the window shows the count of reviewed claims, the checkers' own ratings and links | Unit test over the table: 100% of domains with a review get a record; fixture with a known domain | 2 |
| 3 | Site context on any page (NewsGuard, Ground News) | Owner and state-link badge on result links in Google, Bing and DuckDuckGo and on article pages, opt-in per site | Of 500 news links sampled from those engines, at least 85% resolve to an owner row; fixture tests per engine | 2 |
| 4 | Other coverage of a story (Ground News) | Opt-in GDELT lookup, off by default, says what it sends and to whom before first use; lists other outlets by owner type with no left/right score | At least 3 other outlets for 70% of a 100-story test set; median under 3 s | 2 |
| 5 | Notes beyond X (Community Notes on Meta, TikTok Footnotes) | Platform notes shown first wherever Facebook, Instagram, Threads or TikTok load them in the page | One fixture per platform; live check on two | 2, 6 |
| 6 | Media forensics (InVID, Adobe, Digimarc) | Read C2PA manifests and AI-generation metadata from media the page already loaded; keyframe reverse search for video, click only | 100% of valid manifests in the C2PA sample files read; 0 false "has credentials" on stripped files | 3 |
| 7 | Lessons on techniques (Bad News, Go Viral) | A lesson of at most 2 minutes for every shipped technique and sign, linked from the badge | Every shipped sign has a lesson (test); a small pre/post study reports discernment (d'), not only "false" answers, so the response-bias critique [19] is checked | 5 |
| 8 | Personal feed dashboard (Ground News My News Bias) | Local dashboard of what feeds pushed over 7, 30 and 60 days: sources, owners, state-media share, techniques, flagged share | Computed from local history only; network log empty during dashboard use (test) | 4 |
| 9 | Coordination graph (Hoaxy/OSoMeNet, Bot Sentinel v3) | Graph of accounts and shared text across viewed threads, built from local data | Renders 500 nodes in under 1 s; every edge links to its evidence | 4 |
| 10 | Platform reach (Ground News on LinkedIn; Community Notes on Threads, TikTok) | Threads, Mastodon and TikTok comments | Fixture tests per adapter; live check on each | 6 |
| 11 | Mobile (NewsGuard, Ground News apps) | Firefox for Android build | Badges and window work on X and YouTube mobile web on a test device | 6 |
| 12 | Correction channel (Community Notes, AllSides feedback) | Local "this sign was wrong" with per-user calibration; opt-in export for evaluation | Feedback stays local by default (test); export file validates against a schema | 7 |
| 13 | AI answer citations (NewsGuard in ChatGPT and Gemini) | Owner badge on cited links in ChatGPT, Gemini, Claude and Perplexity answers | One fixture per assistant | 2 (after 3) |
| 14 | Transparency on accuracy (MBFC confidence labels, Community Notes open data) | A transparency page generated from EVALUATION.md, shipped inside the extension | Page regenerates in CI; no figure differs from EVALUATION.md | 7 |
| 15 | Rhetoric beyond Western European languages (InVID UI in many languages) | Rhetoric in Arabic, Russian, Ukrainian, Chinese and Hindi, measured where corpora allow, otherwise "not measured yet" | Symmetry tests per language; EVALUATION.md row per language | 6 |

Considered and not adopted: a per-site trust score (NewsGuard), a left/right score per outlet
(AllSides, MBFC, Ground News) and a per-account bot score (Bot Sentinel, Botometer). Each conflicts
with "evidence, not verdicts", and the criticism below shows the score itself becomes the dispute.

## Why people install, keep and uninstall

### What users praise (install and keep)
- Speed at the point of reading. "quickly ascertain the quality and reputation of news sources"
  on feeds (MBFC review, 2024-08-01); Bot Sentinel users praise skipping accounts while scrolling
  (5 of 9 positive reviews).
- Working where they already read: Reddit, Lemmy, Bluesky, Mastodon and Twitter come up by name.
- Seeing the reason. NewsGuard's one recent positive review credits it for "explaining how these
  decisions are reached" (2024-09-24).
- Fairness felt across sides: "avoid ideology-driven news sites on both the left and right" (MBFC).
- A scale over a verdict: a Bot Sentinel reviewer values the 0 to 100 range "so it's not like it
  provides a binary judgment".

### What drives uninstalls (counts from the AMO samples)
| Cause | NewsGuard (15) | Ground News (15) | MBFC (12) | Bot Sentinel (16) |
|---|---|---|---|---|
| Paywall or card for a trial | 5 | 1 | 0 | 0 |
| Data over-reach, URLs sent off the device | 0 | 6 | 0 | 2 (closed source, domain access) |
| Breaks pages, flicker, CPU | 0 | 6 | 3 | 0 |
| Does nothing or "unknown" most of the time | 3 | 1 | 0 | 3 |
| Perceived partisan bias in ratings | 6 | 1 | 2 | 2 |
| Login friction | 1 | 3 | 0 | 0 |

Outside the stores the same pattern holds: Ground News is criticised for false equivalence and for
using AllSides ratings without permission, per AllSides [21]; NewsGuard is in litigation with the
FTC after the FTC chair accused it of censorship, and NewsGuard denies bias [22]. MBFC is criticised
as one person's opinions used as research ground truth [13]. Community Notes is slow and rare at
the moment a post spreads [10][11]. Prebunking games shift answers toward "false" for true and
false items alike [19].

## The three differentiators that matter most

1. **Nothing leaves the browser, free, no account.** The two most common uninstall causes above are
   payment and data over-reach. CMMNS already answers both, and no rater in the table does. Every
   2.0 network feature stays opt-in and says what it sends before first use, so the claim stays true.
2. **Sourced evidence with a measured error rate on every sign, and no score.** Ratings and scores
   draw the bias attack that dominates NewsGuard, Bot Sentinel and MBFC reviews. CMMNS shows the
   owner, the cited report, the checker's own words and the sign's precision with its interval, and
   publishes symmetry tests across sides. A reader can check each claim, and nothing rests on our say.
3. **The reply and account layer, tied to a lesson.** Site raters stop at the domain, and the games
   sit apart from the feed. CMMNS works on the replies and accounts where coordination happens, and
   2.0 links each sign to a short lesson on the exact technique in front of the user, measured for
   discernment so it avoids the games' known failure.

## Sources (all read 2026-10-20)
1. NewsGuard, How it works: https://www.newsguardtech.com/how-it-works/
2. NewsGuard privacy policy (updated 2026-07-22): https://newsguardtech.com/privacy-policy ; AMO API https://addons.mozilla.org/api/v5/addons/addon/newsguard/
3. StationX, Ground News review (2026-08): https://app.stationx.net/articles/ground-news-review ; ReadLess, pricing (2026-09): https://www.readless.app/blog/ground-news-pricing-free-vs-paid-2026
4. AMO reviews and API for ground-news-bias-checker: https://addons.mozilla.org/api/v5/ratings/rating/?addon=ground-news-bias-checker
5. Ground News rating system: https://ground.news/rating-system
6. WeVerify verification plugin page: https://weverify.eu/verification-plugin/ ; Bellingcat toolkit entry: https://bellingcat.gitbook.io/toolkit/more/all-tools/invid.md
7. Bot Sentinel homepage (shows "Coming Soon", v3.0 beta, a countdown to 2026-05-01 at zero): https://botsentinel.com/
8. OSoMe, Introducing Botometer X (2024-02-21): https://osome.iu.edu/research/blog/introducing-botometer-x
9. TechCrunch, TikTok Footnotes US launch (2025-07-30): https://techcrunch.com/2025/07/30/tiktoks-crowdsourced-fact-checks-called-footnotes-launch-in-the-u-s ; Poynter on Meta Community Notes (2025-04-16): https://www.poynter.org/?p=1155813
10. Consensus Stability of Community Notes on X (arXiv 2601.14002): https://arxiv.org/pdf/2601.14002 ; LLM-augmented notes for health misinformation (arXiv 2510.11423): https://arxiv.org/pdf/2510.11423
11. Timeliness, Consensus, and Composition of the Crowd (arXiv 2510.12559): https://arxiv.org/pdf/2510.12559
12. MBFC methodology: https://mediabiasfactcheck.com/methodology/
13. Wikipedia, Media Bias/Fact Check (cites the 2022 r = 0.81 study and the "Stop using MBFC" critique): https://en.wikipedia.org/wiki/Media_Bias/Fact_Check
14. AllSides rating methods: https://www.allsides.com/media-bias/media-bias-rating-methods ; Common Sense Media review: https://www.commonsensemedia.org/website-reviews/allsides
15. Hoaxy (redirects to OSoMeNet): https://hoaxy.osome.iu.edu/
16. Sifted on Logically's administration (2025-07): https://sifted.eu/articles/logically-ai-fact-check-misinformation-trump-tiktok-meta ; logically.ai footer "© 2026 Kreatur Limited"
17. TrustServista homepage: https://www.trustservista.com/
18. University of Cambridge, "Fake news vaccine works": https://www.cam.ac.uk/research/news/fake-news-vaccine-works-pre-bunk-game-reduces-susceptibility-to-disinformation
19. Graham et al. 2023, Journal of Cognition: https://doaj.org/article/38cc4c6c96064c4aafbea7229b94aeb8 ; Seabrooke, Modirrousta-Galian and Higham 2026, Psychonomic Bulletin and Review: https://discovery.ucl.ac.uk/id/eprint/10211973/7/Modirrousta-Galian_s13423-025-02827-x.pdf
20. University of Cambridge, Go Viral!: https://cam.ac.uk/stories/goviral ; EGU21 abstract: https://meetingorganizer.copernicus.org/EGU21/EGU21-12138.html
21. Columbia Journalism Review, "The business of balance": https://www.cjr.org/analysis/the-business-of-balance-ground-news.php
22. MediaPost, NewsGuard sues FTC: https://www.mediapost.com/publications/article/412628 ; Techdirt: https://www.techdirt.com/company/newsmax/
23. Chrome Web Store listings, read by page fetch: https://chromewebstore.google.com/detail/hcgajcpgaalgpeholhdooeddllhedegi (NewsGuard), .../agleiimpggapjekcdhdjbmegjbbkleie (Ground News), .../mhccpoafgdgbhnjfhkcmgknndkeenfhe (InVID), .../ganicjnkcddicfioohdaegodjodcbkkh (MBFC)

## Limits of this scan
- Store user counts are the stores' rounded figures, read once. CWS review text was not collected.
- Review theme counts come from at most 25 recent AMO reviews per add-on; one review can count
  under two causes.
- Ground News tier prices conflict across secondary sources; only Vantage at $99.99/year agrees.
- Bot Sentinel v3.0 status, OSoMeNet's data sources, AllSides membership price and Go Viral!'s
  current availability are unknown.
