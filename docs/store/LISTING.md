# Store listing

Final listing text and form answers for the Chrome Web Store (CWS) and Firefox Add-ons (AMO). The
author submits under their own developer accounts: creating the accounts, paying the CWS
registration fee and accepting each store's developer agreement are the author's steps. Everything
else is here, so uploading and pasting is the only work left.

Field text sits between `<!-- field:NAME -->` markers. `tests/store-listing.test.js` checks each
field against the limits below and fails on placeholders.

## Limits, as published by each store (read 2026-10-21)

| Field | Limit | Source |
|---|---|---|
| CWS name (manifest `name`) | 75 characters | developer.chrome.com/docs/extensions/reference/manifest/name |
| CWS summary (manifest `description`) | 132 characters, plain text | developer.chrome.com/docs/extensions/reference/manifest/description |
| CWS detailed description | no limit stated on the listing page | developer.chrome.com/docs/webstore/cws-dashboard-listing |
| CWS images | icon 128x128; at least one screenshot at 1280x800, up to 5; small promo tile 440x280 (PNG or JPEG); marquee 1400x560 optional; the page also lists a YouTube video link among the required items | developer.chrome.com/docs/webstore/cws-dashboard-listing |
| CWS privacy tab | single purpose, one justification per permission, remote code, data usage, certifications; no character limits stated | developer.chrome.com/docs/webstore/cws-dashboard-privacy |
| AMO name | 50 characters (since February 2024) | developer.mozilla.org, manifest.json `name` |
| AMO summary | 250 characters | extensionworkshop.com/documentation/develop/create-an-appealing-listing/ |
| AMO description | no practical limit | same page |
| AMO screenshots | 1280x800 recommended, 1.6:1 otherwise; no maximum count | same page |
| AMO data collection | `browser_specific_settings.gecko.data_collection_permissions`, required for new extensions since 2025-11-03; `"required": ["none"]` declares no collection | extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/ (page updated 2026-03-12) |

## Shared copy

**Name**

<!-- field:name -->
Daylight Commons
<!-- /field -->

**Summary** (CWS takes it from the manifest `description`; the test keeps the two identical)

<!-- field:summary -->
Evidence beside social media replies, each sign with its source and what it does not prove. No server, no account, no analytics.
<!-- /field -->

**AMO summary**

<!-- field:amo-summary -->
Evidence beside the replies you read on X, YouTube, Reddit, Facebook, Instagram, Bluesky and more: where the site places an account, coordination, fact-checks. Each sign names its source and what it does not prove. Never a score.
<!-- /field -->

**Description**

<!-- field:description -->
Free and open source (AGPL-3.0). No account, no server, no analytics.
Daylight Commons asks only the site you are on. Two features, both off by default, reach further on your click: Other coverage reads the news feeds of outlets you choose, and evidence lookups send the repository names and web domains a post links to GitHub, rdap.org and the Internet Archive. What Daylight Commons keeps stays in your browser, and "Clear all Daylight Commons data" deletes it.

Evidence with its source. Never a score.
Every sign says where its data came from and what it does not prove. Where Daylight Commons has measured a sign against examples people checked by hand, the sign shows how often it was right, with a 95% interval; every other sign says "not measured yet". The full results, the data behind them and their licences are on the transparency page.

Rest the pointer on a reply on X, YouTube, Reddit, Facebook, Instagram or Bluesky, and a window opens beside it with:
- Place: where the site labels the account as based, and replies that speak as a local of somewhere else.
- Coordination: the same text from several accounts, the same upload pushed by many, replies that arrive in bursts, wording that turns up in other threads you opened.
- Account and posting: its age, renames, posting hours and the apps it posts from.
- Sources: outlet owners, state links only where a cited report or official document names them, Community Notes, and fact-checks of similar claims with the fact-checker's own rating.
- Language: slurs, calls for violence and dehumanising language, measured on public research data.
- Site cards: rest the pointer on a link to see who owns the site, its owner type, founding date and country from Wikidata, any cited state link, and its fact-check record ("N reviews by M fact-checkers since a date"), with every rating in the fact-checker's own words. Press "Site card for this page" for the news site you are reading, and turn on labels under Google, Bing or DuckDuckGo results if you want them.
- Other coverage, off by default: on a click, Daylight Commons reads the news feeds of outlets you choose, finds the ones covering the same story and labels each by owner and owner type (state media, public broadcaster, nonprofit, commercial), never by a left or right score. Nothing from the page is sent; the options page names every outlet it would ask.
- A thread report: whether the most extreme replies come mostly from flagged accounts, with intervals, and "skewed" only when the intervals do not overlap.
- Launch campaigns on X, not measured yet: how a launch post's engagement compares with the account's own posts, shared bio templates and join-date waves among the accounts the page loaded, and Paid partnership labels. It states an inference only when two or more independent signs agree, and never names an ordinary account.
- Evidence receipts, off by default: on your click, a linked repository's creation date, a domain's registration date and its first Internet Archive capture. Each answer is kept as a receipt in a hash chain that you can save and check offline with the free command line tool.

Tell Daylight Commons when it is wrong. Each sign has "This was right" and "This was wrong". Your marks stay in your browser, and after ten on one kind of sign the window shows your own count beside the measured figure. You can save them to a file and choose whether to share it.

What Daylight Commons never does:
- Call anyone a bot, propagandist or extremist.
- Use political side as an input. The same words count the same whoever they target, and the transparency page shows how evenly each side is covered.
- Guess who runs an account, or anyone's age, gender, ethnicity, religion or politics.
- Send your data anywhere it has not told you about. Other coverage requests the public feeds of outlets you chose and sends nothing from the page. Evidence lookups send only the repository names and domains a post links to.

Keyboard: focus a post to open its window, Alt+R to move into it, Esc to close it.

How Daylight Commons is measured: https://harperz9.github.io/daylight-commons/transparency.html
Privacy policy: https://harperz9.github.io/daylight-commons/privacy.html
Source code: https://github.com/HarperZ9/daylight-commons
<!-- /field -->

| Field | CWS | AMO |
|---|---|---|
| Category | Social & Communication | Social & Communication |
| Language | English | English |
| Visibility | Public | Listed |
| Homepage | https://github.com/HarperZ9/daylight-commons | https://github.com/HarperZ9/daylight-commons |
| Support | https://github.com/HarperZ9/daylight-commons/issues | https://github.com/HarperZ9/daylight-commons/issues |
| Privacy policy | https://harperz9.github.io/daylight-commons/privacy.html | https://harperz9.github.io/daylight-commons/privacy.html |
| Mature content | Off | n/a |
| Licence | n/a | GNU Affero General Public License v3.0 only (AGPL-3.0-only) |
| Tags (AMO) | n/a | misinformation, fact-check, privacy, social media, transparency |

The privacy and transparency URLs go live when GitHub Pages serves `/docs` from `main`.

## Chrome Web Store: privacy practices tab

**Single purpose**

<!-- field:single-purpose -->
Shows the evidence behind the posts and accounts in the social media threads the user is reading: where it comes from, signs of coordination and how it argues, each with its source and what it does not prove.
<!-- /field -->

**Permission justifications**

| Permission | Justification |
|---|---|
| `storage` | Keeps the user's settings, the account details the site disclosed, thread summaries and the user's own feedback marks in this browser, for the retention the user sets. Nothing is synced or sent. |
| Host `https://x.com/*`, `https://twitter.com/*` | Reads the replies and account details X shows on the page, and repeats X's own "About this account" request for reply authors, at most one account every 1.5 seconds. |
| Host `https://www.youtube.com/*` | Reads the comments and channel data YouTube already loaded for the page. |
| Host `https://www.reddit.com/*` | Reads comments and Reddit's public account data for comment authors, one account every 2 seconds. |
| Host `https://www.facebook.com/*`, `https://www.instagram.com/*` | Reads comments and the account transparency details Meta shows when the user opens them. |
| Host `https://bsky.app/*` | Reads replies, account data and moderation labels the Bluesky app loaded. |
| `scripting` | Injects the site card into the current tab when the user presses "Site card for this page", and registers the search-result labels only for the engines the user turned on. Also runs Daylight Commons on a Mastodon server only after the user turns it on for that server, and checks, when the user opens the toolbar button on such a page, whether it is the Mastodon web app (its root element, version and domain, nothing else). |
| `activeTab` | Lets the site card and that one check read the current tab when the user opens the toolbar button, and no other time. |
| Host `https://www.threads.com/*`, `https://www.threads.net/*` | Reads the posts and replies Threads shows on the page. |
| Host `https://www.tiktok.com/*` | Reads the comments TikTok shows and the comment list its app already loaded. |
| Optional host `https://*/*` | Asked for one Mastodon server at a time, only when the user clicks "Turn on Daylight Commons here" on that server; the browser shows its own prompt. Never granted for all sites. The options page lists the servers and takes access back. The same optional permission is asked for `https://www.google.com/*`, `https://www.bing.com/*` or `https://duckduckgo.com/*` only when the user turns on result labels for that engine, and for one news feed's host at a time (for example `https://feeds.bbci.co.uk/*`) only when the user chooses that outlet or adds that feed for Other coverage, which on the user's click downloads the feed and sends nothing from the page. It is asked for `https://web.archive.org/*` only when the user turns on Evidence lookups, because the Internet Archive's capture index answers a browser extension only with host access. |

The APIs Daylight Commons also calls (`action`, `tabs.create`, `tabs.query`, `tabs.sendMessage`,
`windows.create`) need no manifest permission. `tests/store-listing.test.js` fails when the
manifest asks for a host or permission this table does not justify.

**Remote code:** No, I am not using remote code. Every script ships in the package.

**Data usage.** The CWS user-data FAQ says disclosure applies "even when data is processed or stored
locally". Tick these, because Daylight Commons reads and keeps them in the browser:

| CWS category | Ticked | Why |
|---|---|---|
| Website content | Yes | Reads the replies and account details on the page; keeps summaries and, only when the user ticks it, a post's text with a feedback mark |
| Web browsing activity | Yes | Keeps a summary of each thread the user opened, for the history page |
| Website content, sent | Yes | Only with evidence lookups, off by default: on the user's click, the repository names and web domains the post links to go to api.github.com, rdap.org and web.archive.org. Other coverage downloads the feeds of outlets the user chose and sends nothing from the page |
| Personally identifiable information, Health, Financial and payment, Authentication, Personal communications, Location, User activity | No | Daylight Commons reads none of these. The location labels are the sites' public labels about other accounts, not the user's location |

Certifications (tick all three): not sold or transferred to third parties outside the approved use
cases; not used or transferred for purposes unrelated to the single purpose; not used or
transferred to determine creditworthiness or for lending.

## Firefox Add-ons fields

| Field | Value |
|---|---|
| Package | `radar-firefox-<version>.xpi` from the GitHub release, or `npm run package`; AMO signs it |
| Add-on ID | `radar@harperz9.github.io`. Permanent: see DESIGN.md, "Add-on identity" |
| Minimum version | Firefox 128 (main-world content scripts) |
| Data collection | `"required": ["none"], "optional": ["websiteContent"]`. Nothing is sent by default. Evidence lookups, when the user turns them on in Options (Firefox then asks for website content), send the repository names and web domains a post links to GitHub, rdap.org and the Internet Archive. Other coverage downloads public news feeds from hosts the user approved one by one and sends nothing from the page |
| Lint | `web-ext lint` 8.10.0 on the 2026-10-21 build: 0 errors, 0 warnings, 0 notices |
| Source code | Upload a source archive (`git archive`) and note: `core.bundle.js` is generated by `npm run build` from `src/core`; nothing is minified |
| Notes to reviewer | Run `node scripts/serve.mjs` and open `http://127.0.0.1:8742/tests/fixtures/thread.html` to see the window without any account. On a real site, Firefox asks for site access on the first-run page |

Daylight Commons 2.x declared `websiteContent` under `optional` for the GDELT lookup, which sent title
words. 3.0.0 removed that lookup, and declares `websiteContent` under `optional` again for evidence
lookups. Any future feature that sends user data must add its data type here first.

## Screenshots and images

All in `docs/store/`, made from the installed 3.0.0 Chrome package on synthetic pages where every
account is invented (`docs/demo/README.md` says how). Each screenshot is 1280x800, the size CWS
requires and AMO recommends; use the same files for both stores, in this order.

| File | Caption to paste |
|---|---|
| `screenshots/01-finding-place.png` | A reply's window: where the platform places the account, with the evidence and what it does not prove. |
| `screenshots/02-finding-language.png` | A language sign with its measured precision and 95% interval. |
| `screenshots/03-finding-thread-report.png` | The thread panel: where the accounts are based and coordination across the thread. |
| `screenshots/04-finding-launch-campaign.png` | The launch campaign lens: documented fact first, then the inference, each sign with what it does not prove. |
| `screenshots/05-finding-evidence.png` | Evidence lookups, on your click: each answer kept as a receipt you can check offline. |
| `screenshots/06-page-welcome-light.png` | First run: what Daylight Commons shows, what it never does, and where it runs. |

Small promo tile (CWS, 440x280, required): `promo-tile.png` (source `promo-tile.svg`). Marquee
(1400x560): optional, skip. Icon: `src/ext/icons/radar-128.png` inside the package. Video: the CWS
dashboard lists a YouTube link among the listing items; `docs/demo/demo-install-to-verify.webm` is a
one-minute recording the author can upload to their own channel if the dashboard asks for one.

## Submission steps for the author

Nothing here has been submitted. Creating the developer accounts, paying the CWS registration fee,
accepting each store's developer agreement and pressing submit are the author's steps.

**Chrome Web Store**
1. Sign in at chrome.google.com/webstore/devconsole with the account that will own the listing.
   Pay the one-time registration fee and accept the developer agreement if this is the first item.
2. New item: upload `radar-chrome-3.0.0.zip` from the GitHub release v3.0.0. Check its SHA-256
   against the release's `SHA256SUMS` first.
3. Store listing tab: the summary comes from the manifest; paste "Description" from above;
   category Social & Communication; language English; upload the six screenshots in order and the
   promo tile; homepage and support URLs from the table above.
4. Privacy practices tab: paste "Single purpose", one justification per permission from the table,
   "Remote code: No", tick the data usage rows as the table says (Website content sent: Yes), tick
   the three certifications, and give the privacy policy URL.
5. Distribution: Public, all regions. Submit for review.

**Firefox Add-ons (listed)**
1. Sign in at addons.mozilla.org/developers with the account that will own the add-on, and accept
   the distribution agreement.
2. Submit a new add-on, "On this site": upload `radar-firefox-3.0.0.xpi` from the release. The
   add-on id `radar@harperz9.github.io` is set in the package; it must never change.
3. Source code: answer yes and upload `git archive --format=zip v3.0.0` of the repository, with the
   note from the Firefox fields table above (`npm run build` regenerates `core.bundle.js` and
   `ocr.bundle.js`; nothing is minified).
4. Paste the name, the AMO summary and the description; licence AGPL-3.0-only; tags from the table;
   upload the screenshots with their captions; privacy policy URL.
5. Submit. The data collection answer comes from the manifest: nothing required, website content
   optional for evidence lookups.

**Firefox self-distribution (optional, signed but not listed)**
1. At addons.mozilla.org/developers/addon/api/key, create an API key and secret. Keep them out of
   the repository, for example in environment variables `WEB_EXT_API_KEY` and
   `WEB_EXT_API_SECRET`.
2. `npx web-ext sign --channel unlisted --source-dir <unzipped radar-firefox-self-3.0.0.xpi>`, or
   upload that xpi as "On your own" in the developer hub.
3. Attach the signed file Mozilla returns to the v3.0.0 release, then run
   `node scripts/firefox-updates.mjs <signed.xpi>` and commit `docs/firefox/updates.json`, so
   installed copies find the next version.

## Before each later submission

- Bump the version in `src/ext/manifest.json` and `package.json`.
- `npm test` green; `npm run build` and `npm run pages` leave no diff.
- Cut the release with `npm run release`, attach every file, download them back and run
  `node scripts/verify-release.mjs <folder>`.
- `web-ext lint` on the Firefox package: no errors.
