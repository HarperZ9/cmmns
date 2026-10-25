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
See the evidence behind social media replies: where accounts are based, coordination and fact-checks, each with its source.
<!-- /field -->

**AMO summary**

<!-- field:amo-summary -->
See the evidence behind the replies you read on X, YouTube, Reddit, Facebook, Instagram, Bluesky and more: where the site places an account, signs of coordination and fact-checks. Each sign names its source and what it shows.
<!-- /field -->

**Description**

<!-- field:description -->
Daylight Commons shows you the evidence behind the replies you read, right beside them. Rest the pointer on a reply and see where the site places the account, whether other accounts post the same words, and what fact-checkers said about a similar claim. Each sign names its source, so you can check it and decide for yourself.

Free and open source (AGPL-3.0). It runs in your browser, with no account and no analytics. It asks only the site you are on. What it keeps stays in your browser, and "Clear all Daylight Commons data" deletes it.

Evidence with its source. Never a score.
Every sign says where its data came from and what it shows. Where Daylight Commons has measured a sign against examples people checked by hand, the sign shows how often it was right, with a 95% interval. Other signs say "not measured yet". The transparency page has the full results, the data behind them and their licences.

Rest the pointer on a reply on X, YouTube, Reddit, Facebook, Instagram or Bluesky. A window opens beside it with:
- Place: where the site labels the account as based, and replies that speak as a local of another place.
- Coordination: the same text from several accounts, one upload pushed by many, replies that arrive in bursts, and wording that turns up in other threads you opened.
- Account and posting: the account's age, renames, posting hours and the apps it posts from.
- Sources: outlet owners, state links where a cited report or official document names them, Community Notes, and fact-checks of similar claims with the fact-checker's own rating.
- Language: slurs, calls for violence and dehumanising language, measured on public research data.
- Site cards: rest the pointer on a link to see who owns the site, its owner type, founding date and country from Wikidata, any cited state link, and its fact-check record ("N reviews by M fact-checkers since a date"), with every rating in the fact-checker's own words. Press "Site card for this page" for the news site you are reading. You can also turn on labels under Google, Bing or DuckDuckGo results.
- Other coverage, when you turn it on: on your click, Daylight Commons reads the news feeds of outlets you choose. It finds the ones that cover the same story and labels each by owner and owner type (state media, public broadcaster, nonprofit, commercial). The page itself stays on your device, and the options page names every outlet it asks.
- A thread report: whether the most extreme replies come mostly from flagged accounts, with intervals. It says "skewed" when the intervals stand apart.
- Launch campaigns on X, not measured yet: how a launch post's engagement compares with the account's own posts, shared bio templates and join-date waves among the accounts the page loaded, and Paid partnership labels. It states an inference when two or more independent signs agree, and it names accounts the platform discloses as organisations.
- Evidence receipts, when you turn them on: on your click, a linked repository's creation date, a domain's registration date and its first Internet Archive capture. Each answer is kept as a receipt in a hash chain. You can save the chain and check it offline with the free command line tool.

Tell Daylight Commons when it is wrong. Each sign has "This was right" and "This was wrong". Your marks stay in your browser. After ten marks on one kind of sign, the window shows your own count beside the measured figure. You can save your marks to a file and choose whether to share them.

How Daylight Commons treats people:
- It describes posts and accounts. It leaves labels such as bot, propagandist or extremist to you.
- The same words count the same whoever they target. Political side is never an input, and the transparency page shows how evenly each side is covered.
- It reads what the site shows. Age, gender, ethnicity, religion and politics stay out of it.
- It sends data only where it tells you first. Other coverage asks for the public feeds of outlets you chose. Evidence lookups send the repository names and domains a post links to.

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
Shows the evidence behind the posts and accounts in the social media threads the user is reading: where it comes from, signs of coordination and how it argues, each with its source and what it shows. Its tools for keeping that evidence (saving media with its hash, converting it on the device) and for reading without trackers (optional ad and tracker blocking) serve the same purpose.
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
| `activeTab` | Lets the site card and that one check read the current tab when the user opens the toolbar button, and no other time. The same grant lets "Save media from this page" and the right-click "Save to Daylight" list the images, GIFs, video and audio that tab loaded, once, on that click. |
| `contextMenus` | Adds right-click items on pictures, video and audio, and on the page for media under a clear layer: Download, Download media here, Download as GIF, Copy, Copy link and Save to Daylight. Nothing runs until the user picks one. |
| `downloads` | Saves the file the user chose with Download straight to the Downloads folder, named from the page and typed from the file's own first bytes, with no new tab and no second click. Used only on that click. |
| `clipboardWrite` | Copy and Copy link put the chosen picture (as PNG) or the file's address on the clipboard, only on that click. |
| `declarativeNetRequest` | Ad and tracker blocking, off until the user turns it on: the EasyList and EasyPrivacy filter lists, compiled into two static rulesets the browser matches itself, and one allow rule for the sites where the user allowed ads. Daylight Commons never reads which requests were blocked and needs no host access for it. |
| Host `https://www.threads.com/*`, `https://www.threads.net/*` | Reads the posts and replies Threads shows on the page. |
| Host `https://www.tiktok.com/*` | Reads the comments TikTok shows and the comment list its app already loaded. |
| Optional host `https://*/*` | Asked for one Mastodon server at a time, only when the user clicks "Turn on Daylight Commons here" on that server; the browser shows its own prompt. Never granted for all sites. The options page lists the servers and takes access back. The same optional permission is asked for `https://www.google.com/*`, `https://www.bing.com/*` or `https://duckduckgo.com/*` only when the user turns on result labels for that engine, and for one news feed's host at a time (for example `https://feeds.bbci.co.uk/*`) only when the user chooses that outlet or adds that feed for Other coverage, which on the user's click downloads the feed and sends nothing from the page. It is asked for `https://web.archive.org/*` only when the user turns on Evidence lookups, because the Internet Archive's capture index answers a browser extension only with host access, or ticks "Ask the Internet Archive to keep a copy" on a case save. When the user saves media, it is asked for the one host the file or stream comes from (for example `https://pbs.twimg.com/*`), on the Save click, so the save page can download the file the page already loaded; a stream whose segments sit on another host asks again on a second click. |

The APIs Daylight Commons also calls (`action`, `tabs.create`, `tabs.query`, `tabs.sendMessage`,
`windows.create`) need no manifest permission. `tests/store-listing.test.js` fails when the
manifest asks for a host or permission this table does not justify.

**Remote code:** No, I am not using remote code. Every script ships in the package.

**Data usage.** The CWS user-data FAQ says disclosure applies "even when data is processed or stored
locally". Tick these, because Daylight Commons reads and keeps them in the browser:

| CWS category | Ticked | Why |
|---|---|---|
| Website content | Yes | Reads the replies and account details on the page; keeps summaries and, only when the user ticks it, a post's text with a feedback mark |
| Web browsing activity | Yes | Keeps a summary of each thread the user opened, for the history page, and the page address beside each media file the user saves |
| Website content, sent | Yes | Only with evidence lookups, off by default: on the user's click, the repository names and web domains the post links to go to api.github.com, rdap.org and web.archive.org. Other coverage downloads the feeds of outlets the user chose and sends nothing from the page. A case save with "Ask the Internet Archive" ticked sends the saved file's address to web.archive.org |
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
| Data collection | `"required": ["none"], "optional": ["websiteContent", "browsingActivity"]`. Nothing is sent by default. A case save with "Ask the Internet Archive to keep a copy" ticked (Firefox then asks for browsing activity) sends the saved file's address to web.archive.org. Evidence lookups, when the user turns them on in Options (Firefox then asks for website content), send the repository names and web domains a post links to GitHub, rdap.org and the Internet Archive. Other coverage downloads public news feeds from hosts the user approved one by one and sends nothing from the page |
| Lint | `web-ext lint` 8.10.0 on the 2026-10-21 build: 0 errors, 0 warnings, 0 notices |
| Source code | Upload `docs/store/amo-source-<version>.zip` (`node scripts/amo-source.mjs`): `src/core`, `src/ocr`, the build script and `REVIEWER.md`, whose steps remake both generated files byte for byte; nothing is minified |
| Notes to reviewer | Run `node scripts/serve.mjs` and open `http://127.0.0.1:8742/tests/fixtures/thread.html` to see the window without any account. On a real site, Firefox asks for site access on the first-run page |

Daylight Commons 2.x declared `websiteContent` under `optional` for the GDELT lookup, which sent title
words. 3.0.0 removed that lookup, and declares `websiteContent` under `optional` again for evidence
lookups. Any future feature that sends user data must add its data type here first.

## Screenshots and images

Five screenshots in `docs/store/screenshots/`, each 1280x800 (the size CWS requires and AMO
recommends; use the same files for both stores, in this order). They are of the installed 3.5.0
Chrome package on real public posts, taken signed out on 2026-10-23 by `scripts/qa/store_shots.py`.
Every private person's picture, name and handle is blurred, on the page and in Daylight Commons'
window; the posting organisations (AP, The Guardian, Mastodon) stay readable. Please look through
them before uploading: blurring is checked by eye, not by a test.

| File | Caption to paste |
|---|---|
| `screenshots/01-reply-window-bluesky.png` | Rest the pointer on a reply: the words that carry a technique are marked, and the window names it. (Reading lens, with Every reading technique on.) |
| `screenshots/02-thread-panel-bluesky.png` | The thread panel: how many accounts it read, and the frames the thread repeats, counted across posts and authors. |
| `screenshots/03-site-card-bluesky.png` | Rest the pointer on a link: who owns the site, its owner type and its fact-check record, in the fact-checkers' own words. |
| `screenshots/04-reply-window-mastodon.png` | On any Mastodon server you turn it on for: join dates, coordination and language signs beside each reply. |
| `screenshots/05-comment-window-youtube.png` | YouTube comments: when each comment was posted and how it was received, beside the comment, with coordination and language signs when they appear. |

The 3.0.0 set made on invented accounts (`screenshots/synthetic-3.0.0/`, `docs/demo/README.md` says
how) shows the place, launch-campaign and evidence-receipt findings, which need an X account to see
on real posts. Use it instead, or mix the two, if you prefer every account in the listing invented.

Small promo tile (CWS, 440x280, required): `promo-tile.png` (source `promo-tile.svg`). Marquee
(1400x560): optional, skip. Icon: `src/ext/icons/radar-128.png` inside the package. Video: the CWS
dashboard lists a YouTube link among the listing items; `docs/demo/demo-install-to-verify.webm` is a recording
of under two minutes the author can upload to their own channel if the dashboard asks for one.

## Submission steps for the author

Nothing here has been submitted. Creating the developer accounts, paying the CWS registration fee,
accepting each store's developer agreement and pressing submit are the author's steps.

**Chrome Web Store**
1. Sign in at chrome.google.com/webstore/devconsole with the account that will own the listing.
   Pay the one-time registration fee and accept the developer agreement if this is the first item.
2. New item: upload `radar-chrome-3.6.0.zip` from the GitHub release v3.6.0. Check its SHA-256
   against the release's `SHA256SUMS` first.
3. Store listing tab: the summary comes from the manifest; paste "Description" from above;
   category Social & Communication; language English; upload the five screenshots in order and the
   promo tile; homepage and support URLs from the table above.
4. Privacy practices tab: paste "Single purpose", one justification per permission from the table,
   "Remote code: No", tick the data usage rows as the table says (Website content sent: Yes), tick
   the three certifications, and give the privacy policy URL.
5. Distribution: Public, all regions. Submit for review.

**Firefox Add-ons (listed)**
1. Sign in at addons.mozilla.org/developers with the account that will own the add-on, and accept
   the distribution agreement.
2. Submit a new add-on, "On this site": upload `radar-firefox-3.6.0.xpi` from the release. The
   add-on id `radar@harperz9.github.io` is set in the package; it must never change.
3. Source code: answer yes and upload `docs/store/amo-source-3.6.0.zip` (also attached to the
   release). Its `REVIEWER.md` gives the steps that remake `core.bundle.js` and `ocr.bundle.js` byte
   for byte from `src/core` and `src/ocr`; nothing is minified.
4. Paste the name, the AMO summary and the description; licence AGPL-3.0-only; tags from the table;
   upload the screenshots with their captions; privacy policy URL.
5. Submit. The data collection answer comes from the manifest: nothing required, website content
   optional for evidence lookups.

**Firefox self-distribution (optional, signed but not listed)**
1. At addons.mozilla.org/developers/addon/api/key, create an API key and secret. Keep them out of
   the repository, for example in environment variables `WEB_EXT_API_KEY` and
   `WEB_EXT_API_SECRET`.
2. `npx web-ext sign --channel unlisted --source-dir <unzipped radar-firefox-self-3.6.0.xpi>`, or
   upload that xpi as "On your own" in the developer hub.
3. Attach the signed file Mozilla returns to the v3.6.0 release, then run
   `node scripts/firefox-updates.mjs <signed.xpi>` and commit `docs/firefox/updates.json`, so
   installed copies find the next version.

## Before each later submission

- Bump the version in `src/ext/manifest.json` and `package.json`.
- `npm test` green; `npm run build` and `npm run pages` leave no diff.
- Cut the release with `npm run release`, attach every file, download them back and run
  `node scripts/verify-release.mjs <folder>`.
- `web-ext lint` on the Firefox package: no errors.
